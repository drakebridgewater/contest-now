import type { ContestResults } from '@contest/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedDefaults } from '../src/db/seed.ts';
import { createTestContext, submitEntry, type TestContext } from './helpers.ts';

// A costume contest: no categories, no criteria, only awards.
let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.close();
});

describe('a contest with no categories', () => {
  it('still requires a category while the contest has some', async () => {
    const res = await submitEntry(ctx, { categoryId: null });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Pick a category');
  });

  it('lets the host delete every category, and a restart does not seed them back', async () => {
    const contest = await ctx.api.get('/api/contest');
    for (const { id } of contest.body.categories as { id: string }[]) {
      const res = await ctx.api.delete(`/api/admin/categories/${id}`).set(ctx.admin);
      expect(res.status).toBe(204);
    }

    expect(await seedDefaults(ctx.db)).toEqual({ seeded: false });
    const after = await ctx.api.get('/api/contest');
    expect(after.body.categories).toEqual([]);
    expect(after.body.criteria).toEqual([]);
    expect(after.body.awards.length).toBeGreaterThan(0);
  });

  it('files entries under no category, and refuses one that names a category', async () => {
    const res = await submitEntry(ctx, { entryName: 'Headless Horseman', categoryId: null });
    expect(res.status).toBe(201);
    expect(res.body.categoryId).toBeNull();

    const named = await submitEntry(ctx, { categoryId: 'dessert' });
    expect(named.status).toBe(400);
  });

  it('takes tasted marks, comments and award ballots, but no stars', async () => {
    const entries = await ctx.api.get('/api/entries');
    const entryId = entries.body[0].id as number;
    const voter = await ctx.voter('Morticia');

    const marked = await voter.put(`/api/votes/${entryId}`).send({ tasted: true, comment: 'Eek' });
    expect(marked.status).toBe(200);
    const starred = await voter.put(`/api/votes/${entryId}`).send({ scores: { '1': 5 } });
    expect(starred.status).toBe(400);

    const contest = await ctx.api.get('/api/contest');
    const awardId = contest.body.awards[0].id as string;
    const ballot = await voter.put(`/api/award-ballots/${awardId}`).send({ entryId });
    expect(ballot.status).toBe(200);

    const results = (await ctx.api.get('/api/admin/results').set(ctx.admin)).body as ContestResults;
    expect(results.categories).toHaveLength(1);
    expect(results.categories[0]?.category).toBeNull();
    expect(results.categories[0]?.criteria).toEqual([]);
    expect(results.categories[0]?.entries[0]?.comments).toEqual([
      { voterName: 'Morticia', comment: 'Eek' },
    ]);
    const award = results.awards.find((a) => a.award.id === awardId);
    expect(award?.winnerEntryIds).toEqual([entryId]);
  });
});
