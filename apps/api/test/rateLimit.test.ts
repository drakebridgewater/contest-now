import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/http/app.ts';
import { ADMIN_PASSWORD, createTestContext, type TestContext } from './helpers.ts';

/**
 * Guests reach the API through two proxies (a reverse proxy, then the web
 * container's nginx), so X-Forwarded-For carries two addresses. Rate limits must
 * still tell guests apart, or one busy party locks everyone out at once.
 * Better Auth's limiter only runs in production, hence the nodeEnv here.
 */
let ctx: TestContext;
let api: ReturnType<typeof request>;

beforeAll(async () => {
  ctx = await createTestContext();
  const app = createApp({
    db: ctx.db,
    logger: pino({ level: 'silent' }),
    state: { ready: true, dbStatus: 'ready', version: 'test' },
    config: {
      adminPassword: ADMIN_PASSWORD,
      corsOrigin: '*',
      uploadsDir: ctx.uploadsDir,
      uploadsPublicPath: '/uploads',
      trustProxy: true,
      nodeEnv: 'production',
      authSecret: 'test-secret-that-is-at-least-32-characters-long',
      publicUrl: 'http://party.test',
      smtp: null,
    },
  });
  api = request(app);
});

afterAll(async () => {
  await ctx.close();
});

/** A request as nginx forwards it: the client, then the outer proxy's private address. */
const fromClient = (ip: string) =>
  api.post('/api/auth/guest/vote').set({
    'X-Forwarded-For': `${ip}, 172.18.0.3`,
    Origin: 'http://party.test',
  });

describe('vote sign-in rate limit', () => {
  it('limits each client on its own, not everyone behind the proxies together', async () => {
    let status = 0;
    for (let i = 0; i < 250 && status !== 429; i++) {
      status = (await fromClient('203.0.113.7').send({})).status;
    }
    expect(status).toBe(429);

    // Another guest is unaffected by the first one hitting the limit.
    const other = await fromClient('198.51.100.20').send({ name: 'Ann Lee' });
    expect(other.status).toBe(200);
  });

  it('ignores a client-supplied copy of the internal IP header', async () => {
    const res = await fromClient('203.0.113.7')
      .set('x-contest-client-ip', '192.0.2.99')
      .send({ name: 'Ben' });
    expect(res.status).toBe(429);
  });
});
