import type { AdminGuest, GuestProfile, RsvpSummary } from '@contest/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestContext,
  lastLinkTo,
  PUBLIC_URL,
  submitEntry,
  type Agent,
  type TestContext,
} from './helpers.ts';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.close();
});

/** Follows a mailed sign-in or invite link on a fresh device, as tapping it would. */
async function openMagicLink(email: string): Promise<Agent> {
  const url = new URL(lastLinkTo(ctx, email));
  expect(url.origin).toBe(PUBLIC_URL);
  const device = ctx.device();
  const res = await device.get(url.pathname + url.search);
  expect(res.status).toBe(302);
  expect(res.headers.location).toBe(`${PUBLIC_URL}/event`);
  return device;
}

async function openInvite(url: string): Promise<Agent> {
  const token = new URL(url).searchParams.get('invite');
  const device = ctx.device();
  const res = await device.post('/api/auth/guest/invite').send({ token });
  expect(res.status).toBe(200);
  return device;
}

async function adminGuest(name: string): Promise<AdminGuest> {
  const res = await ctx.api.get('/api/admin/guests').set(ctx.admin);
  const row = (res.body as AdminGuest[]).find((g) => g.name === name);
  if (!row) throw new Error(`no guest ${name}`);
  return row;
}

describe('vote-page sign-in', () => {
  it('needs only a name, and cannot open the RSVP', async () => {
    const tablet = await ctx.voter('Walk In');
    const me = await tablet.get('/api/me');
    expect(me.body).toEqual({
      id: expect.any(String),
      name: 'Walk In',
      scope: 'vote',
      allergies: [],
    });
    expect((await tablet.get('/api/me/profile')).status).toBe(403);
    expect((await tablet.put('/api/me/profile').send({ rsvpStatus: 'yes' })).status).toBe(403);
  });

  it('signs out through Better Auth', async () => {
    const tablet = await ctx.voter('Short Stay');
    expect((await tablet.post('/api/auth/sign-out').send({})).status).toBe(200);
    expect((await tablet.get('/api/me')).status).toBe(401);
  });
});

describe('RSVP by magic link', () => {
  it('creates the guest, mails a link, and the link opens a full session', async () => {
    const asked = await ctx.api
      .post('/api/rsvp/request-link')
      .send({ email: 'Nora@Example.com', name: 'Nora Park' });
    expect(asked.status).toBe(202);
    const phone = await openMagicLink('nora@example.com');

    const me = await phone.get('/api/me');
    expect(me.body).toMatchObject({ name: 'Nora Park', scope: 'full' });
    const profile = await phone.get('/api/me/profile');
    expect(profile.body).toMatchObject({
      name: 'Nora Park',
      email: 'nora@example.com',
      rsvpStatus: 'pending',
    });

    const updated = await phone.put('/api/me/profile').send({
      rsvpStatus: 'yes',
      plusOneFirstName: 'Ike',
      plusOneLastName: 'Park',
      allergies: ['peanuts'],
      preregistrations: ['dessert', 'cocktail'],
      phone: '555-0100',
    });
    expect(updated.status).toBe(200);
    expect(updated.body as GuestProfile).toMatchObject({
      rsvpStatus: 'yes',
      plusOneFirstName: 'Ike',
      allergies: ['peanuts'],
      preregistrations: ['cocktail', 'dessert'],
    });
    // Allergies reach the vote page's view of the guest.
    expect((await phone.get('/api/me')).body.allergies).toEqual(['peanuts']);
  });

  it('a known email needs no name; an unknown one does', async () => {
    expect(
      (await ctx.api.post('/api/rsvp/request-link').send({ email: 'nora@example.com' })).status,
    ).toBe(202);
    const unknown = await ctx.api.post('/api/rsvp/request-link').send({ email: 'x@example.com' });
    expect(unknown.status).toBe(400);
    expect(unknown.body.details).toEqual({ needsName: true });
  });

  it('a link works once', async () => {
    await ctx.api.post('/api/rsvp/request-link').send({ email: 'nora@example.com' });
    const url = new URL(lastLinkTo(ctx, 'nora@example.com'));
    await ctx.device().get(url.pathname + url.search);
    const again = await ctx.device().get(url.pathname + url.search);
    expect(again.headers.location).toContain('error=');
  });

  it('claims the name-only guest who already voted, keeping their votes and entries', async () => {
    const entry = (await submitEntry(ctx, { contestantName: 'Omar Diaz', entryName: 'Flan' })).body
      .id as number;
    const tablet = await ctx.voter('omar diaz');
    await tablet.put(`/api/votes/${entry}`).send({ tasted: true });

    await ctx.api
      .post('/api/rsvp/request-link')
      .send({ email: 'omar@example.com', name: 'Omar Diaz' });
    const phone = await openMagicLink('omar@example.com');
    const state = await phone.get('/api/me/state');
    expect(state.body.votes[String(entry)].tasted).toBe(true);
    const row = await adminGuest('Omar Diaz');
    expect(row).toMatchObject({ email: 'omar@example.com', entryCount: 1, tastedCount: 1 });
    // The old tablet session was revoked when the email was proven.
    expect((await tablet.get('/api/me')).status).toBe(401);
  });

  it("refuses to hand someone else's RSVP to a new email", async () => {
    const res = await ctx.api
      .post('/api/rsvp/request-link')
      .send({ email: 'impostor@example.com', name: 'nora park' });
    expect(res.status).toBe(409);
  });

  it('validates plus-ones, categories and allergens', async () => {
    const phone = await openMagicLink('nora@example.com').catch(async () => {
      await ctx.api.post('/api/rsvp/request-link').send({ email: 'nora@example.com' });
      return openMagicLink('nora@example.com');
    });
    expect(
      (await phone.put('/api/me/profile').send({ plusOneFirstName: 'Solo', plusOneLastName: '' }))
        .status,
    ).toBe(400);
    expect((await phone.put('/api/me/profile').send({ preregistrations: ['nope'] })).status).toBe(
      400,
    );
    expect((await phone.put('/api/me/profile').send({ allergies: ['vegan'] })).status).toBe(400);
  });
});

describe('host invites', () => {
  it('adds guests, skipping duplicates', async () => {
    const res = await ctx.api
      .post('/api/admin/guests')
      .set(ctx.admin)
      .send({
        guests: [
          { name: 'Pat Lee', email: 'pat@example.com' },
          { name: 'Quinn', email: '' },
          { name: 'nora park', email: '' },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.added).toBe(2);
    expect(res.body.skipped).toHaveLength(1);
  });

  it('emails invites to guests with an address and not yet invited', async () => {
    const res = await ctx.api
      .post('/api/admin/guests/invite')
      .set(ctx.admin)
      .send({ uninvited: true });
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(3); // Pat, Nora and Omar; name-only guests are skipped
    expect(res.body.skipped).toBeGreaterThan(0);
    expect((await adminGuest('Pat Lee')).inviteStatus).toBe('sent');
    const again = await ctx.api
      .post('/api/admin/guests/invite')
      .set(ctx.admin)
      .send({ uninvited: true });
    expect(again.body.sent).toBe(0);
  });

  it('an invite link signs the guest in with a pre-filled RSVP, and stays usable', async () => {
    const url = lastLinkTo(ctx, 'pat@example.com');
    expect(url.startsWith(`${PUBLIC_URL}/event?invite=`)).toBe(true);
    const phone = await openInvite(url);
    expect((await phone.get('/api/me/profile')).body).toMatchObject({
      name: 'Pat Lee',
      email: 'pat@example.com',
    });
    expect((await adminGuest('Pat Lee')).inviteStatus).toBe('opened');
    // Opened again later from the same email, it still works.
    await openInvite(url);
  });

  it('a new copied link revokes the old one', async () => {
    const pat = await adminGuest('Pat Lee');
    const oldUrl = lastLinkTo(ctx, 'pat@example.com');
    const fresh = await ctx.api.post(`/api/admin/guests/${pat.id}/invite-link`).set(ctx.admin);
    expect(fresh.status).toBe(200);
    await openInvite(fresh.body.url);
    const token = new URL(oldUrl).searchParams.get('invite');
    const stale = await ctx.device().post('/api/auth/guest/invite').send({ token });
    expect(stale.status).toBe(401);
  });

  it('reports whether email is configured', async () => {
    expect((await ctx.api.get('/api/admin/mail-status').set(ctx.admin)).body).toEqual({
      configured: true,
    });
  });
});

describe('event location', () => {
  it('is shown only to guests signed in from their email, never to the tablet', async () => {
    await ctx.api.put('/api/admin/settings').set(ctx.admin).send({ location: '123 Elm St' });
    const location = async (agent: Agent) =>
      (await agent.get('/api/contest')).body.settings.location as string;

    expect(await location(ctx.device())).toBe('');
    expect(await location(await ctx.voter('Tablet Tess'))).toBe('');
    await ctx.api
      .post('/api/rsvp/request-link')
      .send({ email: 'lena@example.com', name: 'Lena Ruiz' });
    expect(await location(await openMagicLink('lena@example.com'))).toBe('123 Elm St');
    // The host still sees it on the manage page.
    const admin = await ctx.api.get('/api/admin/config').set(ctx.admin);
    expect(admin.body.settings.location).toBe('123 Elm St');
  });
});

describe('RSVP summary', () => {
  it('counts statuses, plus-ones and pre-registrations, never declined guests', async () => {
    const summary = (await ctx.api.get('/api/rsvp/summary')).body as RsvpSummary;
    expect(summary.yes).toBe(1);
    expect(summary.plusOnes).toBe(1);
    expect(summary.headcount).toBe(2);
    expect(summary.preregistered).toEqual({ cocktail: 1, dessert: 1 });
    expect(summary.allergies).toEqual(['peanuts']);

    await ctx.api.post('/api/rsvp/request-link').send({ email: 'nora@example.com' });
    const nora = await openMagicLink('nora@example.com');
    await nora.put('/api/me/profile').send({ rsvpStatus: 'no' });
    const after = (await ctx.api.get('/api/rsvp/summary')).body as RsvpSummary;
    expect(after).toMatchObject({
      yes: 0,
      no: 1,
      plusOnes: 0,
      headcount: 0,
      preregistered: {},
      allergies: [],
    });
    // Guests who declined drop out of the submit autocomplete.
    const names = (await ctx.api.get('/api/guests/names')).body as { name: string }[];
    expect(names.map((n) => n.name)).not.toContain('Nora Park');
  });
});

describe('origin checks', () => {
  it('accepts the page’s own host even when PUBLIC_URL names another, and refuses other sites', async () => {
    const byIp = await ctx.api
      .post('/api/auth/guest/vote')
      .set('Host', '192.168.1.20:3099')
      .set('Origin', 'http://192.168.1.20:3099')
      .send({ name: 'Tablet User' });
    expect(byIp.status).toBe(200);

    const evil = await ctx.api
      .post('/api/auth/guest/vote')
      .set('Host', '192.168.1.20:3099')
      .set('Origin', 'https://evil.example')
      .set('Cookie', 'contest.session_token=x')
      .send({ name: 'Tablet User' });
    expect(evil.status).toBe(403);
  });
});
