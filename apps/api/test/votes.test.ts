import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalizeVoterName } from '@contest/shared';
import { createTestContext, submitEntry, type Agent, type TestContext } from './helpers.ts';

let ctx: TestContext;
const devices = new Map<string, Agent>();

/** One signed-in device per voter, however the name is typed. */
async function as(name: string): Promise<Agent> {
  const key = normalizeVoterName(name);
  let agent = devices.get(key);
  if (!agent) {
    agent = await ctx.voter(name);
    devices.set(key, agent);
  }
  return agent;
}
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
    const first = await (
      await as(' Alice ')
    )
      .put(`/api/votes/${dessertId}`)
      .send({ scores: { [a]: 4 } });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ scores: { [a]: 4 }, comment: '', tasted: true });

    const second = await (
      await as('alice')
    )
      .put(`/api/votes/${dessertId}`)
      .send({ scores: { [b]: 5, [c]: 3 }, comment: 'Lovely: really' });
    expect(second.body.scores).toEqual({ [a]: 4, [b]: 5, [c]: 3 });
    expect(second.body.comment).toBe('Lovely: really');

    const cleared = await (
      await as('ALICE')
    )
      .put(`/api/votes/${dessertId}`)
      .send({ scores: { [b]: null } });
    expect(cleared.body.scores).toEqual({ [a]: 4, [c]: 3 });
    expect(cleared.body.comment).toBe('Lovely: really');

    const state = await (await as('Alice')).get('/api/me/state');
    expect(state.status).toBe(200);
    expect(state.body.votes[String(dessertId)].scores).toEqual({ [a]: 4, [c]: 3 });
  });

  it('rejects criteria from another category, bad ratings and unknown entries', async () => {
    const [a] = dessertCriteria as [number];
    const wrong = await (
      await as('alice')
    )
      .put(`/api/votes/${cocktailId}`)
      .send({ scores: { [a]: 4 } });
    expect(wrong.status).toBe(400);
    const bad = await (
      await as('alice')
    )
      .put(`/api/votes/${dessertId}`)
      .send({ scores: { [a]: 6 } });
    expect(bad.status).toBe(400);
    const missing = await (await as('alice')).put('/api/votes/9999').send({ scores: { [a]: 4 } });
    expect(missing.status).toBe(404);
    const shortName = await ctx.device().post('/api/auth/guest/vote').send({ name: 'a' });
    expect(shortName.status).toBe(400);
    const anonymous = await ctx.api.put(`/api/votes/${dessertId}`).send({ scores: { [a]: 4 } });
    expect(anonymous.status).toBe(401);
  });

  it('marks tasted on its own, without any rating', async () => {
    const marked = await (await as('dana')).put(`/api/votes/${cocktailId}`).send({ tasted: true });
    expect(marked.status).toBe(200);
    expect(marked.body).toEqual({ scores: {}, comment: '', tasted: true });

    const state = await (await as('dana')).get('/api/me/state');
    expect(state.body.votes[String(cocktailId)]).toEqual({
      scores: {},
      comment: '',
      tasted: true,
    });
  });

  it('un-tasting keeps the ratings, and clearing stars keeps tasted', async () => {
    const [a] = dessertCriteria as [number];
    const rated = await (
      await as('erin')
    )
      .put(`/api/votes/${dessertId}`)
      .send({ scores: { [a]: 5 } });
    expect(rated.body.tasted).toBe(true);

    const untasted = await (
      await as('erin')
    )
      .put(`/api/votes/${dessertId}`)
      .send({ tasted: false });
    expect(untasted.body).toEqual({ scores: { [a]: 5 }, comment: '', tasted: false });

    // Clearing the last star is not a statement about having tried it.
    const cleared = await (
      await as('erin')
    )
      .put(`/api/votes/${dessertId}`)
      .send({ scores: { [a]: null } });
    expect(cleared.body).toEqual({ scores: {}, comment: '', tasted: false });

    // An explicit tasted in the same request wins over the rating's implication.
    const both = await (
      await as('erin')
    )
      .put(`/api/votes/${dessertId}`)
      .send({ scores: { [a]: 3 }, tasted: false });
    expect(both.body).toEqual({ scores: { [a]: 3 }, comment: '', tasted: false });
  });

  it('counts tasted per voter without a bare taste counting as a vote', async () => {
    await (await as('finn')).put(`/api/votes/${dessertId}`).send({ tasted: true });
    const res = await ctx.api.get('/api/admin/guests').set(ctx.admin);
    expect(res.status).toBe(200);
    const finn = (res.body as { name: string }[]).find((v) => v.name === 'finn');
    expect(finn).toMatchObject({ tastedCount: 1, voteCount: 0, completeVoteCount: 0 });
  });

  it('refuses votes while voting is closed', async () => {
    const [a] = dessertCriteria as [number];
    await ctx.api.put('/api/admin/settings').set(ctx.admin).send({ votingOpen: false });
    const res = await (await as('bob')).put(`/api/votes/${dessertId}`).send({ scores: { [a]: 4 } });
    expect(res.status).toBe(409);
    await ctx.api.put('/api/admin/settings').set(ctx.admin).send({ votingOpen: true });
  });

  it('refuses votes until the scheduled opening time', async () => {
    const [a] = dessertCriteria as [number];
    const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await ctx.api.put('/api/admin/settings').set(ctx.admin).send({ votingOpensAt: soon });
    const early = await (
      await as('bob')
    )
      .put(`/api/votes/${dessertId}`)
      .send({ scores: { [a]: 4 } });
    expect(early.status).toBe(409);
    expect(early.body.details).toEqual({ opensAt: soon });
    await ctx.api.put('/api/admin/settings').set(ctx.admin).send({ votingOpensAt: null });
  });
});

describe('award ballots', () => {
  it('records, changes and clears a nomination', async () => {
    const res = await (
      await as('Bob')
    )
      .put('/api/award-ballots/best-presented')
      .send({ entryId: dessertId });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ awardId: 'best-presented', entryId: dessertId });

    const changed = await (
      await as('bob')
    )
      .put('/api/award-ballots/best-presented')
      .send({ entryId: cocktailId });
    expect(changed.body.entryId).toBe(cocktailId);
    expect((await (await as('bob')).get('/api/me/state')).body.ballots).toEqual({
      'best-presented': cocktailId,
    });

    expect((await (await as('bob')).delete('/api/award-ballots/best-presented')).status).toBe(204);
    expect((await (await as('bob')).get('/api/me/state')).body.ballots).toEqual({});
  });

  it('enforces award scope and existence', async () => {
    await ctx.api
      .post('/api/admin/awards')
      .set(ctx.admin)
      .send({ name: 'Most Festive', categoryIds: ['dessert'] });
    const ok = await (
      await as('bob')
    )
      .put('/api/award-ballots/most-festive')
      .send({ entryId: dessertId });
    expect(ok.status).toBe(200);
    const out = await (
      await as('bob')
    )
      .put('/api/award-ballots/most-festive')
      .send({ entryId: cocktailId });
    expect(out.status).toBe(400);
    const none = await (
      await as('bob')
    )
      .put('/api/award-ballots/nope')
      .send({ entryId: dessertId });
    expect(none.status).toBe(404);
  });
});

describe('admin guests', () => {
  it('lists, renames and deletes guests with their votes and ballots', async () => {
    const list = await ctx.api.get('/api/admin/guests').set(ctx.admin);
    expect(list.status).toBe(200);
    type Row = {
      id: string;
      name: string;
      voteCount: number;
      completeVoteCount: number;
      ballotCount: number;
    };
    const rows = list.body as Row[];
    // Every name typed on the vote page is a guest, as is the cook the entries were filed under.
    expect(rows.map((v) => v.name)).toEqual(['Alice', 'bob', 'dana', 'erin', 'finn', 'Tester']);
    const alice = rows.find((v) => v.name === 'Alice')!;
    expect(alice.voteCount).toBe(1);
    expect(alice.completeVoteCount).toBe(0);
    const bob = rows.find((v) => v.name === 'bob')!;
    expect(bob.ballotCount).toBe(1);

    const clash = await ctx.api
      .put(`/api/admin/guests/${bob.id}`)
      .set(ctx.admin)
      .send({ newName: 'Alice' });
    expect(clash.status).toBe(409);
    const renamed = await ctx.api
      .put(`/api/admin/guests/${bob.id}`)
      .set(ctx.admin)
      .send({ newName: 'Robert' });
    expect(renamed.status).toBe(204);
    // Bob's device is still signed in as the same guest, whose ballots moved with the name.
    expect((await as('bob')).get('/api/me/state').then((r) => r.body.ballots)).resolves.toEqual({
      'most-festive': dessertId,
    });

    const deleted = await ctx.api.delete(`/api/admin/guests/${alice.id}`).set(ctx.admin);
    expect(deleted.status).toBe(200);
    expect(deleted.body.votes).toBe(1);
    // Deleting the guest ends their sessions too.
    expect((await (await as('alice')).get('/api/me/state')).status).toBe(401);
    expect((await ctx.api.delete(`/api/admin/guests/${alice.id}`).set(ctx.admin)).status).toBe(404);
  });
});
