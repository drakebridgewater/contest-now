import type { ApiError, HealthStatus } from '@contest/shared';
import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { toNodeHandler } from 'better-auth/node';
import { AUTH_BASE_PATH, createAuth } from '../auth.ts';
import type { AppConfig } from '../config.ts';
import type { Db } from '../db/client.ts';
import type { Logger } from '../logger.ts';
import type { PhotoStorage } from '../services/entries.ts';
import { createMailer, type Mailer } from '../services/mailer.ts';
import { requireAdmin } from './middleware/adminAuth.ts';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.ts';
import { adminRoutes } from './routes/admin.ts';
import { guestRoutes } from './routes/guests.ts';
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
    | 'adminPassword'
    | 'corsOrigin'
    | 'uploadsDir'
    | 'uploadsPublicPath'
    | 'trustProxy'
    | 'nodeEnv'
    | 'authSecret'
    | 'publicUrl'
    | 'smtp'
  >;
  logger: Logger;
  state: AppState;
  /** Defaults to SMTP from config (or logging when unset). Tests pass a memory mailer. */
  mailer?: Mailer;
}

export function createApp({ db, config, logger, state, mailer: givenMailer }: AppDeps): Express {
  const app = express();
  const storage: PhotoStorage = {
    uploadsDir: config.uploadsDir,
    publicPath: config.uploadsPublicPath,
  };
  const mailer = givenMailer ?? createMailer(config.smtp, logger);
  const auth = createAuth(db, config, mailer);

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

  const linkLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests. Wait a few minutes and try again.' } satisfies ApiError,
  });
  app.use('/api/rsvp/request-link', linkLimiter);
  if (config.nodeEnv !== 'test') app.use('/api/auth/guest/vote', linkLimiter);

  // Better Auth reads the raw body itself, so it goes before express.json().
  app.all(`${AUTH_BASE_PATH}/*splat`, toNodeHandler(auth));
  app.use(express.json({ limit: '1mb' }));

  app.use(
    config.uploadsPublicPath,
    express.static(config.uploadsDir, {
      maxAge: '7d',
      immutable: true,
      index: false,
      fallthrough: true,
    }),
  );

  app.use('/api', publicRoutes(db, auth, storage));
  app.use('/api', guestRoutes(db, auth));

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Wait a few minutes and try again.' } satisfies ApiError,
  });
  app.use('/api/admin/login', loginLimiter);
  app.use(
    '/api/admin',
    requireAdmin(config.adminPassword),
    adminRoutes(db, storage, { mailer, publicUrl: config.publicUrl }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
