import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { ADMIN_PASSWORD_HEADER } from '@contest/shared';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import pino from 'pino';
import sharp from 'sharp';
import request from 'supertest';
import type { Db } from '../src/db/client.ts';
import { schema } from '../src/db/schema.ts';
import { seedDefaults } from '../src/db/seed.ts';
import { createApp, type AppState } from '../src/http/app.ts';

export const ADMIN_PASSWORD = 'test-admin-password';

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');

export interface TestContext {
  db: Db;
  api: ReturnType<typeof request>;
  uploadsDir: string;
  admin: Record<string, string>;
  close(): Promise<void>;
}

/** Boots an in-process Postgres (PGlite), applies the real migrations and seeds, and wraps the app in supertest. */
export async function createTestContext(): Promise<TestContext> {
  const client = new PGlite();
  const pglite = drizzle({ client, schema, casing: 'snake_case' });
  await migrate(pglite, { migrationsFolder });
  // PGlite and postgres.js differ only in their result HKT; the query surface is identical.
  const db = pglite as unknown as Db;
  await seedDefaults(db);

  const uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contest-uploads-'));
  const state: AppState = { ready: true, dbStatus: 'ready', version: 'test' };
  const app = createApp({
    db,
    config: {
      adminPassword: ADMIN_PASSWORD,
      corsOrigin: '*',
      uploadsDir,
      uploadsPublicPath: '/uploads',
      trustProxy: false,
      nodeEnv: 'test',
    },
    logger: pino({ level: 'silent' }),
    state,
  });

  return {
    db,
    api: request(app),
    uploadsDir,
    admin: { [ADMIN_PASSWORD_HEADER]: ADMIN_PASSWORD },
    close: async () => {
      await client.close();
      await fs.rm(uploadsDir, { recursive: true, force: true });
    },
  };
}

/** A small valid PNG for upload tests. */
export function samplePhoto(color = '#c0392b'): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: color } })
    .png()
    .toBuffer();
}

export async function submitEntry(
  ctx: TestContext,
  overrides: Partial<{
    entryName: string;
    contestantName: string;
    categoryId: string;
    allergens: string[];
  }> = {},
) {
  const fields = {
    entryName: 'Test Entry',
    contestantName: 'Tester',
    categoryId: 'dessert',
    allergens: [] as string[],
    ...overrides,
  };
  let req = ctx.api
    .post('/api/entries')
    .field('entryName', fields.entryName)
    .field('contestantName', fields.contestantName)
    .field('categoryId', fields.categoryId);
  for (const allergen of fields.allergens) req = req.field('allergens', allergen);
  return req.attach('photo', await samplePhoto(), {
    filename: 'photo.png',
    contentType: 'image/png',
  });
}
