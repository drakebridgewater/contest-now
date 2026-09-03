import type { ApiError, HealthStatus } from '@contest/shared';
import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from '../config.ts';
import type { Db } from '../db/client.ts';
import type { Logger } from '../logger.ts';
import type { PhotoStorage } from '../services/entries.ts';
import { requireAdmin } from './middleware/adminAuth.ts';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.ts';
import { adminRoutes } from './routes/admin.ts';
import { publicRoutes } from './routes/public.ts';

export interface AppState {
  /** Flips to true once migrations and seeding are done. */
  ready: boolean;
  dbStatus: HealthStatus['db'];
  version: string;
}

export interface AppDeps {
  db: Db;
  config: Pick<
    AppConfig,
    'adminPassword' | 'corsOrigin' | 'uploadsDir' | 'uploadsPublicPath' | 'trustProxy' | 'nodeEnv'
  >;
  logger: Logger;
  state: AppState;
}

export function createApp({ db, config, logger, state }: AppDeps): Express {
  const app = express();
  const storage: PhotoStorage = {
    uploadsDir: config.uploadsDir,
    publicPath: config.uploadsPublicPath,
  };

  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((s) => s.trim()),
    }),
  );
  if (config.nodeEnv !== 'test') {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/api/health' },
        // One compact line per request. The defaults serialize every request and
        // response header, which buries real problems and would write the admin
        // password (sent as x-admin-password) into the logs.
        serializers: {
          req: (req) => ({ id: req.id, method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      }),
    );
  }
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    const body: HealthStatus = {
      status: state.ready ? 'ok' : state.dbStatus === 'unavailable' ? 'error' : 'starting',
      db: state.dbStatus,
      version: state.version,
    };
    res.status(state.ready ? 200 : 503).json(body);
  });

  // Everything else waits for the database.
  app.use('/api', (_req, res, next) => {
    if (state.ready) {
      next();
      return;
    }
    res.status(503).json({
      error: 'The server is still starting up. Try again in a moment.',
    } satisfies ApiError);
  });

  app.use(
    config.uploadsPublicPath,
    express.static(config.uploadsDir, {
      maxAge: '7d',
      immutable: true,
      index: false,
      fallthrough: true,
    }),
  );

  app.use('/api', publicRoutes(db, storage));

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Wait a few minutes and try again.' } satisfies ApiError,
  });
  app.use('/api/admin/login', loginLimiter);
  app.use('/api/admin', requireAdmin(config.adminPassword), adminRoutes(db, storage));

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
