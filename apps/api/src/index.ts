import { loadConfig } from './config.ts';
import { connectPostgres } from './db/client.ts';
import { seedDefaults } from './db/seed.ts';
import { createApp, type AppState } from './http/app.ts';
import { createLogger } from './logger.ts';
import { isUploadsDirWritable } from './services/entries.ts';

const config = loadConfig();
const logger = createLogger(config.logLevel, config.nodeEnv === 'development');
const state: AppState = {
  ready: false,
  dbStatus: 'migrating',
  uploadsStatus: 'ready',
  version: process.env.APP_VERSION ?? 'dev',
};

const handle = connectPostgres(config.databaseUrl);
const app = createApp({ db: handle.db, config, logger, state });

const server = app.listen(config.port, config.host, () => {
  logger.info({ port: config.port, host: config.host }, 'API listening');
});

async function checkUploads(): Promise<void> {
  if (await isUploadsDirWritable(config.uploadsDir)) {
    state.uploadsStatus = 'ready';
    return;
  }
  state.uploadsStatus = 'unwritable';
  logger.error(
    { uploadsDir: config.uploadsDir },
    'Cannot write to the uploads directory, so photo submissions will fail. ' +
      'It is a mounted volume, and the ownership it has on the host wins over ' +
      'the image, so give the container user access to it — for this stack: ' +
      'docker exec -u 0 contest-api chown -R app:app /data/uploads',
  );
}

async function prepare(): Promise<void> {
  await checkUploads();
  const attempts = 30;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await handle.migrate(config.migrationsDir);
      const { seeded } = await seedDefaults(handle.db);
      state.dbStatus = 'ready';
      state.ready = true;
      logger.info({ seeded }, 'Database ready');
      return;
    } catch (error) {
      logger.warn({ err: error, attempt }, 'Database not ready yet, retrying in 2s');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  state.dbStatus = 'unavailable';
  logger.error('Could not prepare the database; giving up');
}

void prepare();

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down');
  server.close();
  await handle.close().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
