import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, submitEntry, type TestContext } from './helpers.ts';

let ctx: TestContext;
let dessertId: number;
let cocktailId: number;
let dessertCriteria: number[];

beforeAll(async () => {
  ctx = await createTestContext();
  dessertId = (await submitEntry(ctx, { entryName: 'Trifle', categoryId: 'dessert' })).body.id;
  cocktailId = (await submitEntry(ctx, { entryName: 'Negroni', categoryId: 'cocktail' })).body.id;
  const config = await ctx.api.get('/api/contest');
  dessertCriteria = config.body.criteria
    .filter((c: { categoryId: string }) => c.categoryId === 'dessert')
    .map((c: { id: number }) => c.id);
});
afterAll(async () => {
  await ctx.close();
});

describe('votes', () => {
  it('saves partial scores, merges later ones and clears with null', async () => {
    const [a, b, c] = dessertCriteria as [number, number, number];
    const first = await ctx.api
      .put(`/api/votes/${dessertId}`)
      .send({ voterName: ' Alice ', scores: { [a]: 4 } });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ scores: { [a]: 4 }, comment: '' });

    const second = await ctx.api
      .put(`/api/votes/${dessertId}`)
      .send({ voterName: 'alice', scores: { [b]: 5, [c]: 3 }, comment: 'Lovely: really' });
    expect(second.body.scores).toEqual({ [a]: 4, [b]: 5, [c]: 3 });
    expect(second.body.comment).toBe('Lovely: really');

    const cleared = await ctx.api
      .put(`/api/votes/${dessertId}`)
      .send({ voterName: 'ALICE', scores: { [b]: null } });
    expect(cleared.body.scores).toEqual({ [a]: 4, [c]: 3 });
    expect(cleared.body.comment).toBe('Lovely: really');

    const state = await ctx.api.get('/api/voters/Alice');
    expect(state.status).toBe(200);
    expect(state.body.votes[String(dessertId)].scores).toEqual({ [a]: 4, [c]: 3 });
  });

  it('rejects criteria from another category, bad ratings and unknown entries', async () => {
    const [a] = dessertCriteria as [number];
    const wrong = await ctx.api
      .put(`/api/votes/${cocktailId}`)
      .send({ voterName: 'alice', scores: { [a]: 4 } });
    expect(wrong.status).toBe(400);
    const bad = await ctx.api
      .put(`/api/votes/${dessertId}`)
      .send({ voterName: 'alice', scores: { [a]: 6 } });
    expect(bad.status).toBe(400);
    const missing = await ctx.api
      .put('/api/votes/9999')
      .send({ voterName: 'alice', scores: { [a]: 4 } });
    expect(missing.status).toBe(404);
    const shortName = await ctx.api
      .put(`/api/votes/${dessertId}`)
      .send({ voterName: 'a', scores: {} });
    expect(shortName.status).toBe(400);
  });

  it('refuses votes while voting is closed', async () => {
    const [a] = dessertCriteria as [number];
    await ctx.api.put('/api/admin/settings').set(ctx.admin).send({ votingOpen: false });
    const res = await ctx.api
      .put(`/api/votes/${dessertId}`)
      .send({ voterName: 'bob', scores: { [a]: 4 } });
    expect(res.status).toBe(409);
    await ctx.api.put('/api/admin/settings').set(ctx.admin).send({ votingOpen: true });
  });
});

describe('award ballots', () => {
  it('records, changes and clears a nomination', async () => {
    const res = await ctx.api
      .put('/api/award-ballots/best-presented')
      .send({ voterName: 'Bob', entryId: dessertId });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ awardId: 'best-presented', entryId: dessertId });

    const changed = await ctx.api
      .put('/api/award-ballots/best-presented')
      .send({ voterName: 'bob', entryId: cocktailId });
    expect(changed.body.entryId).toBe(cocktailId);
    expect((await ctx.api.get('/api/voters/bob')).body.ballots).toEqual({
      'best-presented': cocktailId,
    });

    expect((await ctx.api.delete('/api/award-ballots/best-presented/bob')).status).toBe(204);
    expect((await ctx.api.get('/api/voters/bob')).body.ballots).toEqual({});
  });

  it('enforces award scope and existence', async () => {
    await ctx.api
      .post('/api/admin/awards')
      .set(ctx.admin)
      .send({ name: 'Most Festive', categoryIds: ['dessert'] });
    const ok = await ctx.api
      .put('/api/award-ballots/most-festive')
      .send({ voterName: 'bob', entryId: dessertId });
    expect(ok.status).toBe(200);
    const out = await ctx.api
      .put('/api/award-ballots/most-festive')
      .send({ voterName: 'bob', entryId: cocktailId });
    expect(out.status).toBe(400);
    const none = await ctx.api
      .put('/api/award-ballots/nope')
      .send({ voterName: 'bob', entryId: dessertId });
    expect(none.status).toBe(404);
  });
});

describe('admin voters', () => {
  it('lists, renames and deletes voters with their votes and ballots', async () => {
    const list = await ctx.api.get('/api/admin/voters').set(ctx.admin);
    expect(list.status).toBe(200);
    const names = list.body.map((v: { voterName: string }) => v.voterName);
    expect(names).toEqual(['alice', 'bob']);
    const alice = list.body.find((v: { voterName: string }) => v.voterName === 'alice');
    expect(alice.voteCount).toBe(1);
    expect(alice.completeVoteCount).toBe(0);
    const bob = list.body.find((v: { voterName: string }) => v.voterName === 'bob');
    expect(bob.ballotCount).toBe(1);

    const clash = await ctx.api
      .put('/api/admin/voters/bob')
      .set(ctx.admin)
      .send({ newName: 'Alice' });
    expect(clash.status).toBe(409);
    const renamed = await ctx.api
      .put('/api/admin/voters/bob')
      .set(ctx.admin)
      .send({ newName: 'Robert' });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toEqual({ votes: 0, ballots: 1 });
    expect((await ctx.api.get('/api/voters/robert')).body.ballots).toEqual({
      'most-festive': dessertId,
    });

    const deleted = await ctx.api.delete('/api/admin/voters/alice').set(ctx.admin);
    expect(deleted.status).toBe(200);
    expect(deleted.body.votes).toBe(1);
    expect((await ctx.api.get('/api/voters/alice')).body).toEqual({ votes: {}, ballots: {} });
    expect((await ctx.api.delete('/api/admin/voters/alice').set(ctx.admin)).status).toBe(404);
  });
});
