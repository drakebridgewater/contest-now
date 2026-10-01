import type { AdminGuest } from '@contest/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, lastLinkTo, PUBLIC_URL, type TestContext } from './helpers.ts';

let ctx: TestContext;
let ids: Record<string, string>;

beforeAll(async () => {
  ctx = await createTestContext();
  await ctx.api
    .post('/api/admin/guests')
    .set(ctx.admin)
    .send({
      guests: [
        { name: 'Pat <b>Lee</b>', email: 'pat@example.com' },
        { name: 'Robin', email: 'robin@example.com' },
        { name: 'No Email', email: '' },
      ],
    });
  const list = (await ctx.api.get('/api/admin/guests').set(ctx.admin)).body as AdminGuest[];
  ids = Object.fromEntries(list.map((g) => [g.name, g.id]));
});
afterAll(async () => {
  await ctx.close();
});

async function guest(name: string): Promise<AdminGuest> {
  const list = (await ctx.api.get('/api/admin/guests').set(ctx.admin)).body as AdminGuest[];
  return list.find((g) => g.name === name)!;
}

function send(body: object) {
  return ctx.api.post('/api/admin/email/send').set(ctx.admin).send(body);
}

describe('custom email', () => {
  it('needs the admin password', async () => {
    const res = await ctx.api.post('/api/admin/email/send').send({});
    expect(res.status).toBe(401);
  });

  it('fills in the guest name, escaped, and strips unsafe HTML', async () => {
    const res = await send({
      subject: 'Hello {{ guest_name }}',
      html: '<p>Hi {{ guest_name }}!</p><script>alert(1)</script><p onclick="x()">Bye</p>',
      guestIds: [ids['Pat <b>Lee</b>'], ids['No Email']],
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sent: 1, skipped: 1, failed: [] });
    const message = ctx.mail.sent.at(-1)!;
    expect(message.to).toBe('pat@example.com');
    expect(message.subject).toBe('Hello Pat <b>Lee</b>');
    expect(message.html).toContain('Hi Pat &lt;b&gt;Lee&lt;/b&gt;!');
    expect(message.html).not.toContain('<script');
    expect(message.html).not.toContain('onclick');
    expect(message.text).toContain('Hi Pat <b>Lee</b>!');
    // No RSVP link in the email, so nobody's invite changed.
    expect((await guest('Pat <b>Lee</b>')).inviteStatus).toBe('none');
  });

  it('makes a working personal RSVP link when the email uses one', async () => {
    const res = await send({
      subject: 'RSVP please',
      html: '<p><a href="{{ rsvp_link }}">RSVP here</a></p>',
      guestIds: [ids['Robin']],
    });
    expect(res.body.sent).toBe(1);
    const message = ctx.mail.sent.at(-1)!;
    const url = lastLinkTo(ctx, 'robin@example.com');
    expect(url.startsWith(`${PUBLIC_URL}/event?invite=`)).toBe(true);
    expect(message.html).toContain(`href="${url}"`);
    expect((await guest('Robin')).inviteStatus).toBe('sent');

    const device = ctx.device();
    const token = new URL(url).searchParams.get('invite');
    expect((await device.post('/api/auth/guest/invite').send({ token })).status).toBe(200);
    expect((await device.get('/api/me/profile')).body.name).toBe('Robin');
  });

  it('refuses unknown merge tags and broken syntax', async () => {
    const unknown = await send({
      subject: 'Hi',
      html: '<p>{{ guest_nmae }}</p>',
      guestIds: [ids['Robin']],
    });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error ?? unknown.body.message).toMatch(/guest_nmae/);

    const broken = await send({
      subject: 'Hi',
      html: '<p>{{ guest_name </p>',
      guestIds: [ids['Robin']],
    });
    expect(broken.status).toBe(400);
  });

  it('cannot read files from the server', async () => {
    const res = await send({
      subject: 'Hi',
      html: "<p>{% include '/etc/passwd' %}</p>",
      guestIds: [ids['Robin']],
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/include/);
  });

  it('needs a photo album link before using it', async () => {
    const body = {
      subject: 'Photos',
      html: '<p><a href="{{ photo_album_link }}">Photos</a></p>',
      guestIds: [ids['Robin']],
    };
    expect((await send(body)).status).toBe(400);

    await ctx.api
      .put('/api/admin/settings')
      .set(ctx.admin)
      .send({ photoShareUrl: 'https://photos.example.com/album' });
    const res = await send(body);
    expect(res.body.sent).toBe(1);
    expect(ctx.mail.sent.at(-1)!.html).toContain('href="https://photos.example.com/album"');
  });

  it('previews without touching anyone’s invite link', async () => {
    const before = (await guest('Robin')).inviteStatus;
    const sentBefore = ctx.mail.sent.length;
    const res = await ctx.api
      .post('/api/admin/email/preview')
      .set(ctx.admin)
      .send({ subject: 'Hi {{ guest_name }}', html: '<p><a href="{{ rsvp_link }}">RSVP</a></p>' });
    expect(res.status).toBe(200);
    expect(res.body.subject).toBe('Hi Sam Sample');
    expect(res.body.html).toContain(`${PUBLIC_URL}/event?invite=preview`);
    expect(ctx.mail.sent.length).toBe(sentBefore);
    expect((await guest('Robin')).inviteStatus).toBe(before);
  });
});
