import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { schema, type Schema } from './schema.ts';

/** Any Drizzle Postgres database (postgres.js in production, PGlite in tests) or a transaction on one. */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

export interface DbHandle {
  db: Db;
  /** Applies pending migrations from the folder. */
  migrate(migrationsFolder: string): Promise<void>;
  close(): Promise<void>;
}

export function connectPostgres(databaseUrl: string): DbHandle {
  const client = postgres(databaseUrl, { max: 10, onnotice: () => {} });
  const db = drizzle({ client, schema, casing: 'snake_case' });
  return {
    db,
    migrate: (migrationsFolder) => migrate(db, { migrationsFolder }),
    close: () => client.end({ timeout: 5 }),
  };
}
