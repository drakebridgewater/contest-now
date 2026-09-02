import fs from 'node:fs/promises';
import { loadConfig } from './config.ts';
import { connectPostgres } from './db/client.ts';
import { seedDefaults } from './db/seed.ts';
import { createApp, type AppState } from './http/app.ts';
import { createLogger } from './logger.ts';

const config = loadConfig();
const logger = createLogger(config.logLevel, config.nodeEnv === 'development');
const state: AppState = {
  ready: false,
  dbStatus: 'migrating',
  version: process.env.APP_VERSION ?? 'dev',
};

const handle = connectPostgres(config.databaseUrl);
const app = createApp({ db: handle.db, config, logger, state });

const server = app.listen(config.port, config.host, () => {
  logger.info({ port: config.port, host: config.host }, 'API listening');
});

async function prepare(): Promise<void> {
  await fs.mkdir(config.uploadsDir, { recursive: true });
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
