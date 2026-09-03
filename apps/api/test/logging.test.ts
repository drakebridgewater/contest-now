import { Writable } from 'node:stream';
import { ADMIN_PASSWORD_HEADER } from '@contest/shared';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/http/app.ts';
import { ADMIN_PASSWORD, createTestContext, type TestContext } from './helpers.ts';

/**
 * The admin password travels in a request header on every admin call. pino-http's
 * default serializer logs the whole header set, which would write it into the
 * container logs in plaintext at the default `info` level. These tests exercise
 * the real logging path (nodeEnv other than 'test', so pinoHttp is installed).
 */
let ctx: TestContext;
let lines: string[];
let api: ReturnType<typeof request>;

beforeAll(async () => {
  ctx = await createTestContext();
  lines = [];

  const captured = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });

  const app = createApp({
    db: ctx.db,
    logger: pino({ level: 'info' }, captured),
    state: { ready: true, dbStatus: 'ready', version: 'test' },
    config: {
      adminPassword: ADMIN_PASSWORD,
      corsOrigin: '*',
      uploadsDir: ctx.uploadsDir,
      uploadsPublicPath: '/uploads',
      trustProxy: false,
      // Anything but 'test' so request logging is actually installed.
      nodeEnv: 'development',
    },
  });
  api = request(app);
});

afterAll(async () => {
  await ctx.close();
});

describe('request logging', () => {
  it('never writes the admin password, however the request carries it', async () => {
    const res = await api.get('/api/admin/results').set(ctx.admin);
    expect(res.status).toBe(200);

    // Also send it somewhere the serializer does not reach, to exercise redaction.
    await api.get('/api/admin/voters').set({ [ADMIN_PASSWORD_HEADER]: ADMIN_PASSWORD });

    const output = lines.join('');
    expect(output).not.toContain(ADMIN_PASSWORD);
    expect(output.toLowerCase()).not.toContain('x-admin-password');
  });

  it('still records what each request was and how it ended', async () => {
    lines.length = 0;
    await api.get('/api/contest');

    const output = lines.join('');
    expect(output).toContain('/api/contest');
    expect(output).toContain('"statusCode":200');
    expect(output).toContain('responseTime');
  });

  it('logs no headers at all, so a new secret header cannot leak by default', async () => {
    lines.length = 0;
    await api
      .get('/api/entries')
      .set({ cookie: 'session=super-secret', authorization: 'Bearer tok' });

    const output = lines.join('');
    expect(output).not.toContain('super-secret');
    expect(output).not.toContain('Bearer tok');
    expect(output).not.toContain('headers');
  });

  it('keeps health checks out of the log', async () => {
    lines.length = 0;
    await api.get('/api/health');
    expect(lines.join('')).toBe('');
  });
});
