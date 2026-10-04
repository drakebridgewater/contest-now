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
import { createMemoryMailer } from '../src/services/mailer.ts';

export const ADMIN_PASSWORD = 'test-admin-password';

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');

export const PUBLIC_URL = 'http://party.test';

export type Agent = ReturnType<typeof request.agent>;

export interface TestContext {
  db: Db;
  api: ReturnType<typeof request>;
  /** A fresh cookie jar, i.e. another device. */
  device(): Agent;
  /** A device signed in on the vote page as `name` (a `vote`-scope session). */
  voter(name: string): Promise<Agent>;
  /** Every email the app tried to send. */
  mail: ReturnType<typeof createMemoryMailer>;
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
  const mail = createMemoryMailer();
  const app = createApp({
    mailer: mail,
    db,
    config: {
      adminPassword: ADMIN_PASSWORD,
      corsOrigin: '*',
      uploadsDir,
      uploadsPublicPath: '/uploads',
      trustProxy: false,
      nodeEnv: 'test',
      authSecret: 'test-secret-that-is-at-least-32-characters-long',
      publicUrl: PUBLIC_URL,
      smtp: null,
    },
    logger: pino({ level: 'silent' }),
    state,
  });

  return {
    db,
    api: request(app),
    // A browser sends Origin on every POST; Better Auth refuses cookie-bearing ones without it.
    device: () => request.agent(app).set('Origin', PUBLIC_URL),
    voter: async (name: string) => {
      const agent = request.agent(app).set('Origin', PUBLIC_URL);
      const response = await agent.post('/api/auth/guest/vote').send({ name });
      if (response.status !== 200) {
        throw new Error(`vote sign-in failed: ${response.status} ${JSON.stringify(response.body)}`);
      }
      return agent;
    },
    mail,
    uploadsDir,
    admin: { [ADMIN_PASSWORD_HEADER]: ADMIN_PASSWORD },
    close: async () => {
      await client.close();
      await fs.rm(uploadsDir, { recursive: true, force: true });
    },
  };
}

/** The last link mailed to `to`, pulled out of the plain-text body. */
export function lastLinkTo(ctx: TestContext, to: string): string {
  const message = ctx.mail.sent.filter((m) => m.to === to).at(-1);
  if (!message) throw new Error(`no email to ${to}`);
  const match = /https?:\/\/\S+/.exec(message.text);
  if (!match) throw new Error('no link in email');
  return match[0];
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
    /** Null leaves the field out, as the form does when the contest has no categories. */
    categoryId: string | null;
    allergens: string[];
    /** The photo part, for tests about how a file is named and announced. */
    photo: Buffer;
    filename: string;
    contentType: string;
    guestId: string;
  }> = {},
) {
  const fields = {
    entryName: 'Test Entry',
    contestantName: 'Tester',
    categoryId: 'dessert',
    allergens: [] as string[],
    filename: 'photo.png',
    contentType: 'image/png',
    ...overrides,
  };
  let req = ctx.api
    .post('/api/entries')
    .field('entryName', fields.entryName)
    .field('contestantName', fields.contestantName);
  if (fields.categoryId !== null) req = req.field('categoryId', fields.categoryId);
  for (const allergen of fields.allergens) req = req.field('allergens', allergen);
  if (overrides.guestId) req = req.field('guestId', overrides.guestId);
  return req.attach('photo', fields.photo ?? (await samplePhoto()), {
    filename: fields.filename,
    contentType: fields.contentType,
  });
}
