// Applies migrations and seeds defaults against DATABASE_URL, then exits. Used by `npm run db:migrate`.
import { loadConfig } from '../config.ts';
import { connectPostgres } from './client.ts';
import { seedDefaults } from './seed.ts';

const config = loadConfig();
const handle = connectPostgres(config.databaseUrl);
try {
  await handle.migrate(config.migrationsDir);
  const { seeded } = await seedDefaults(handle.db);
  console.warn(
    seeded ? 'Migrated and seeded default contest.' : 'Migrated; existing contest kept.',
  );
} finally {
  await handle.close();
}
