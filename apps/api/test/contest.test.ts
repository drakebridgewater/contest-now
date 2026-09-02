import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, submitEntry, type TestContext } from './helpers.ts';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.close();
});

describe('GET /api/contest', () => {
  it('returns the seeded contest', async () => {
    const res = await ctx.api.get('/api/contest');
    expect(res.status).toBe(200);
    expect(res.body.settings.eventName).toBe('Holiday Contest');
    expect(res.body.categories.map((c: { id: string }) => c.id)).toEqual([
      'appetizer',
      'cocktail',
      'dessert',
    ]);
    expect(res.body.criteria).toHaveLength(9);
    expect(res.body.awards).toHaveLength(3);
    expect(res.body.awards[0].categoryIds).toEqual([]);
  });

  it('health reports ok', async () => {
    const res = await ctx.api.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('admin auth', () => {
  it('rejects missing and wrong passwords', async () => {
    expect((await ctx.api.get('/api/admin/config')).status).toBe(401);
    expect((await ctx.api.get('/api/admin/config').set('x-admin-password', 'nope')).status).toBe(
      401,
    );
    expect((await ctx.api.post('/api/admin/login').set('x-admin-password', 'nope')).status).toBe(
      401,
    );
  });

  it('accepts the right password', async () => {
    expect((await ctx.api.post('/api/admin/login').set(ctx.admin)).status).toBe(204);
    expect((await ctx.api.get('/api/admin/config').set(ctx.admin)).status).toBe(200);
  });
});

describe('admin setup', () => {
  it('updates settings', async () => {
    const res = await ctx.api
      .put('/api/admin/settings')
      .set(ctx.admin)
      .send({ eventName: 'PDXmas 2026', photoShareUrl: 'https://photos.example/x' });
    expect(res.status).toBe(200);
    expect(res.body.eventName).toBe('PDXmas 2026');
    const pub = await ctx.api.get('/api/contest');
    expect(pub.body.settings.photoShareUrl).toBe('https://photos.example/x');
  });

  it('rejects an invalid photo url', async () => {
    const res = await ctx.api
      .put('/api/admin/settings')
      .set(ctx.admin)
      .send({ photoShareUrl: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.details[0].path).toBe('photoShareUrl');
  });

  it('creates a category with a derived id and next sort order', async () => {
    const res = await ctx.api
      .post('/api/admin/categories')
      .set(ctx.admin)
      .send({ name: 'Side Dishes', emoji: '🥔' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('side-dishes');
    expect(res.body.sortOrder).toBe(40);
    const dup = await ctx.api
      .post('/api/admin/categories')
      .set(ctx.admin)
      .send({ name: 'Side Dishes' });
    expect(dup.status).toBe(409);
  });

  it('adds criteria to the new category and rejects duplicate slugs', async () => {
    const first = await ctx.api
      .post('/api/admin/criteria')
      .set(ctx.admin)
      .send({ categoryId: 'side-dishes', name: 'Flavor', helpText: 'Yum?' });
    expect(first.status).toBe(201);
    expect(first.body.slug).toBe('flavor');
    const dup = await ctx.api
      .post('/api/admin/criteria')
      .set(ctx.admin)
      .send({ categoryId: 'side-dishes', name: 'Flavor' });
    expect(dup.status).toBe(409);
    const unknown = await ctx.api
      .post('/api/admin/criteria')
      .set(ctx.admin)
      .send({ categoryId: 'nope', name: 'X' });
    expect(unknown.status).toBe(400);

    const updated = await ctx.api
      .put(`/api/admin/criteria/${first.body.id}`)
      .set(ctx.admin)
      .send({ weight: 2, isActive: false });
    expect(updated.status).toBe(200);
    expect(updated.body.weight).toBe(2);
    expect(updated.body.isActive).toBe(false);

    const pub = await ctx.api.get('/api/contest');
    expect(pub.body.criteria.some((c: { id: number }) => c.id === first.body.id)).toBe(false);
    const adminCfg = await ctx.api.get('/api/admin/config').set(ctx.admin);
    expect(adminCfg.body.criteria.some((c: { id: number }) => c.id === first.body.id)).toBe(true);
  });

  it('creates a scoped award and validates the scope', async () => {
    const bad = await ctx.api
      .post('/api/admin/awards')
      .set(ctx.admin)
      .send({ name: 'Most Festive', categoryIds: ['nope'] });
    expect(bad.status).toBe(400);
    const res = await ctx.api
      .post('/api/admin/awards')
      .set(ctx.admin)
      .send({ name: 'Most Festive', emoji: '🎄', categoryIds: ['dessert', 'dessert'] });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('most-festive');
    expect(res.body.categoryIds).toEqual(['dessert']);

    const widened = await ctx.api
      .put('/api/admin/awards/most-festive')
      .set(ctx.admin)
      .send({ name: 'Most Festive', categoryIds: [] });
    expect(widened.body.categoryIds).toEqual([]);
  });

  it('deletes unused things and blocks deletes that would lose data', async () => {
    expect((await ctx.api.delete('/api/admin/awards/most-festive').set(ctx.admin)).status).toBe(
      204,
    );
    expect((await ctx.api.delete('/api/admin/categories/side-dishes').set(ctx.admin)).status).toBe(
      204,
    );

    const entry = await submitEntry(ctx, { categoryId: 'appetizer' });
    expect(entry.status).toBe(201);
    const blocked = await ctx.api.delete('/api/admin/categories/appetizer').set(ctx.admin);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatch(/Deactivate/);

    const deactivated = await ctx.api
      .put('/api/admin/categories/appetizer')
      .set(ctx.admin)
      .send({ name: 'Appetizers', isActive: false });
    expect(deactivated.status).toBe(200);
    const pub = await ctx.api.get('/api/contest');
    expect(pub.body.categories.some((c: { id: string }) => c.id === 'appetizer')).toBe(false);
    expect(
      pub.body.criteria.some((c: { categoryId: string }) => c.categoryId === 'appetizer'),
    ).toBe(false);
  });
});
