import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedDefaults } from '../src/db/seed.ts';
import { createTestContext, submitEntry, type TestContext } from './helpers.ts';

// A Halloween party: a costume contest beside the food.
let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.close();
});

describe('category kinds', () => {
  it('seeds food categories as tasting', async () => {
    const contest = await ctx.api.get('/api/contest');
    for (const category of contest.body.categories as { kind: string; noun: string }[]) {
      expect(category).toMatchObject({ kind: 'tasting', noun: '' });
    }
  });

  it('creates a showcase category with its own noun, and edits both', async () => {
    const res = await ctx.api
      .post('/api/admin/categories')
      .set(ctx.admin)
      .send({ name: 'Costumes', emoji: '🎃', kind: 'showcase', noun: 'costume' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'costumes', kind: 'showcase', noun: 'costume' });

    const bad = await ctx.api
      .post('/api/admin/categories')
      .set(ctx.admin)
      .send({ name: 'Raffle', kind: 'raffle' });
    expect(bad.status).toBe(400);

    const edited = await ctx.api
      .put('/api/admin/categories/costumes')
      .set(ctx.admin)
      .send({ ...res.body, noun: 'outfit' });
    expect(edited.status).toBe(200);
    expect(edited.body.noun).toBe('outfit');
  });

  it('drops allergens from a showcase entry, and keeps them on food', async () => {
    const costume = await submitEntry(ctx, {
      entryName: 'Headless Horseman',
      categoryId: 'costumes',
      allergens: ['peanuts'],
    });
    expect(costume.status).toBe(201);
    expect(costume.body.allergens).toEqual([]);

    const pie = await submitEntry(ctx, { categoryId: 'dessert', allergens: ['peanuts'] });
    expect(pie.body.allergens).toEqual(['peanuts']);
  });

  it('takes a seen mark and stars on a costume once it has criteria', async () => {
    const criterion = await ctx.api
      .post('/api/admin/criteria')
      .set(ctx.admin)
      .send({ categoryId: 'costumes', name: 'Scariness' });
    expect(criterion.status).toBe(201);
    const entries = await ctx.api.get('/api/entries');
    const costume = (entries.body as { id: number; categoryId: string }[]).find(
      (e) => e.categoryId === 'costumes',
    )!;

    const voter = await ctx.voter('Morticia');
    const res = await voter
      .put(`/api/votes/${costume.id}`)
      .send({ scores: { [criterion.body.id]: 5 } });
    expect(res.status).toBe(200);
    expect(res.body.tasted).toBe(true);
  });
});

describe('seeding', () => {
  it('does not bring the defaults back after the host deletes every category', async () => {
    const fresh = await createTestContext();
    try {
      const contest = await fresh.api.get('/api/contest');
      for (const { id } of contest.body.categories as { id: string }[]) {
        expect(
          (await fresh.api.delete(`/api/admin/categories/${id}`).set(fresh.admin)).status,
        ).toBe(204);
      }
      expect(await seedDefaults(fresh.db)).toEqual({ seeded: false });
      expect((await fresh.api.get('/api/contest')).body.categories).toEqual([]);
    } finally {
      await fresh.close();
    }
  });
});
