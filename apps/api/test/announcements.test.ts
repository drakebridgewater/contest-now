import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAnnouncement } from '../src/services/announcements.ts';
import { createTestContext, type TestContext } from './helpers.ts';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.close();
});

describe('announcements', () => {
  it('lets only the host send one', async () => {
    const res = await ctx.api.post('/api/admin/announcements').send({ message: 'Hi' });
    expect(res.status).toBe(401);
  });

  it('sends one that everyone sees until it expires', async () => {
    const before = Date.now();
    const sent = await ctx.api
      .post('/api/admin/announcements')
      .set(ctx.admin)
      .send({ message: '  Pizza is here!  ', durationMinutes: 5 });
    expect(sent.status).toBe(201);
    expect(sent.body.message).toBe('Pizza is here!');
    const lifetime = Date.parse(sent.body.expiresAt) - Date.parse(sent.body.createdAt);
    expect(lifetime).toBe(5 * 60_000);
    expect(Date.parse(sent.body.createdAt)).toBeGreaterThanOrEqual(before - 1000);

    // Anyone, signed in or not.
    const seen = await ctx.device().get('/api/announcements');
    expect(seen.status).toBe(200);
    expect(seen.headers['cache-control']).toBe('no-store');
    expect(seen.body.map((a: { id: number }) => a.id)).toContain(sent.body.id);
  });

  it('rejects a duration it does not offer', async () => {
    const res = await ctx.api
      .post('/api/admin/announcements')
      .set(ctx.admin)
      .send({ message: 'Hi', durationMinutes: 7 });
    expect(res.status).toBe(400);
  });

  it('hides expired ones from guests but keeps them in the host history', async () => {
    const old = await createAnnouncement(
      ctx.db,
      { message: 'Old news', durationMinutes: 5 },
      new Date(Date.now() - 10 * 60_000),
    );
    const live = await ctx.api.get('/api/announcements');
    expect(live.body.map((a: { id: number }) => a.id)).not.toContain(old.id);

    const history = await ctx.api.get('/api/admin/announcements').set(ctx.admin);
    expect(history.body.map((a: { id: number }) => a.id)).toContain(old.id);
  });

  it('ends one early', async () => {
    const sent = await ctx.api
      .post('/api/admin/announcements')
      .set(ctx.admin)
      .send({ message: 'Voting closes in 10 minutes' });
    const ended = await ctx.api
      .post(`/api/admin/announcements/${sent.body.id}/expire`)
      .set(ctx.admin);
    expect(ended.status).toBe(200);
    expect(Date.parse(ended.body.expiresAt)).toBeLessThanOrEqual(Date.now());

    const live = await ctx.api.get('/api/announcements');
    expect(live.body.map((a: { id: number }) => a.id)).not.toContain(sent.body.id);

    const missing = await ctx.api.post('/api/admin/announcements/99999/expire').set(ctx.admin);
    expect(missing.status).toBe(404);
  });
});
