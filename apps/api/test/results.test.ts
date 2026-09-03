import type { ContestResults } from '@contest/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, submitEntry, type TestContext } from './helpers.ts';

let ctx: TestContext;
let pie: number;
let cake: number;
let fudge: number;
let ids: [number, number, number];

async function vote(
  voter: string,
  entryId: number,
  ratings: [number, number, number] | [number],
  comment?: string,
) {
  const scores: Record<string, number> = {};
  ratings.forEach((r, i) => {
    scores[String(ids[i])] = r;
  });
  const res = await ctx.api
    .put(`/api/votes/${entryId}`)
    .send({ voterName: voter, scores, comment });
  expect(res.status).toBe(200);
}

beforeAll(async () => {
  ctx = await createTestContext();
  pie = (await submitEntry(ctx, { entryName: 'Pie', categoryId: 'dessert' })).body.id;
  cake = (await submitEntry(ctx, { entryName: 'Cake', categoryId: 'dessert' })).body.id;
  fudge = (await submitEntry(ctx, { entryName: 'Fudge', categoryId: 'dessert' })).body.id;
  const config = await ctx.api.get('/api/contest');
  ids = config.body.criteria
    .filter((c: { categoryId: string }) => c.categoryId === 'dessert')
    .map((c: { id: number }) => c.id);

  await vote('ann', pie, [5, 5, 5], 'Best pie: ever');
  await vote('ben', pie, [3, 3, 3]);
  await vote('ann', cake, [4, 4, 4]);
  await vote('ben', cake, [4, 4, 4]);
  await vote('cal', cake, [4]); // partial, must not count
  await vote('ann', fudge, [4, 4, 4]);

  await ctx.api.put('/api/award-ballots/best-presented').send({ voterName: 'ann', entryId: pie });
  await ctx.api.put('/api/award-ballots/best-presented').send({ voterName: 'ben', entryId: cake });
});
afterAll(async () => {
  await ctx.close();
});

describe('GET /api/admin/results', () => {
  it('ranks entries on complete votes only, with ties and comments', async () => {
    const res = await ctx.api.get('/api/admin/results').set(ctx.admin);
    expect(res.status).toBe(200);
    const results = res.body as ContestResults;
    const dessert = results.categories.find((c) => c.category.id === 'dessert')!;
    const byName = Object.fromEntries(dessert.entries.map((e) => [e.entryName, e]));

    expect(byName.Pie?.overall).toBe(4);
    expect(byName.Pie?.voteCount).toBe(2);
    expect(byName.Cake?.overall).toBe(4);
    expect(byName.Cake?.voteCount).toBe(2);
    expect(byName.Cake?.partialVoteCount).toBe(1);
    expect(byName.Fudge?.overall).toBe(4);
    expect(byName.Fudge?.voteCount).toBe(1);

    // Pie and Cake tie on overall and vote count -> shared rank 1; Fudge is rank 3.
    expect(byName.Pie?.rank).toBe(1);
    expect(byName.Cake?.rank).toBe(1);
    expect(byName.Fudge?.rank).toBe(3);
    expect(byName.Pie?.comments).toEqual([{ voterName: 'ann', comment: 'Best pie: ever' }]);
    expect(byName.Pie?.criteria[0]?.distribution).toEqual({ 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 });

    const award = results.awards.find((a) => a.award.id === 'best-presented')!;
    expect(award.totalBallots).toBe(2);
    expect(award.winnerEntryIds.sort()).toEqual([pie, cake].sort());
    expect(award.tally.map((t) => t.count)).toEqual([1, 1]);

    expect(results.summary).toEqual({
      voterCount: 3,
      entryCount: 3,
      completeVoteCount: 5,
      ballotCount: 2,
    });
  });

  it('deactivating a criterion makes partial votes complete', async () => {
    const [, , third] = ids;
    const res = await ctx.api
      .put(`/api/admin/criteria/${third}`)
      .set(ctx.admin)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    // cal rated only the first criterion; still incomplete (2 active remain)
    let results = (await ctx.api.get('/api/admin/results').set(ctx.admin)).body as ContestResults;
    let cakeRow = results.categories[2]!.entries.find((e) => e.entryName === 'Cake')!;
    expect(cakeRow.partialVoteCount).toBe(1);

    const [, second] = ids;
    await ctx.api.put(`/api/admin/criteria/${second}`).set(ctx.admin).send({ isActive: false });
    results = (await ctx.api.get('/api/admin/results').set(ctx.admin)).body as ContestResults;
    cakeRow = results.categories[2]!.entries.find((e) => e.entryName === 'Cake')!;
    expect(cakeRow.voteCount).toBe(3);
    expect(cakeRow.partialVoteCount).toBe(0);
  });

  it('blocks deleting a criterion that has ratings', async () => {
    const res = await ctx.api.delete(`/api/admin/criteria/${ids[0]}`).set(ctx.admin);
    expect(res.status).toBe(409);
  });
});
