import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, samplePhoto, submitEntry, type TestContext } from './helpers.ts';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.close();
});

describe('entries', () => {
  it('stores a re-encoded photo and returns the entry', async () => {
    const res = await submitEntry(ctx, {
      entryName: 'Pavlova',
      allergens: ['eggs', 'dairy', 'gluten-free'],
    });
    expect(res.status).toBe(201);
    expect(res.body.photoUrl).toMatch(/^\/uploads\/.+\.webp$/);
    expect(res.body.allergens).toEqual(['eggs', 'dairy', 'gluten-free']);

    const file = path.join(ctx.uploadsDir, path.basename(res.body.photoUrl));
    const meta = await sharp(await fs.readFile(file)).metadata();
    expect(meta.format).toBe('webp');

    const served = await ctx.api.get(res.body.photoUrl);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/webp');

    const list = await ctx.api.get('/api/entries');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].entryName).toBe('Pavlova');
  });

  it('accepts allergens as a JSON array field too', async () => {
    const res = await ctx.api
      .post('/api/entries')
      .field('entryName', 'Nutty')
      .field('contestantName', 'Sam')
      .field('categoryId', 'appetizer')
      .field('allergens', JSON.stringify(['peanuts']))
      .attach('photo', await samplePhoto('#27ae60'), {
        filename: 'p.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(201);
    expect(res.body.allergens).toEqual(['peanuts']);
  });

  // The submit form used to gate on the part's Content-Type, which browsers fill
  // in from the file extension. That turned away phone photos whose extension the
  // browser had no entry for, and it trusted any file that was merely named .jpg.
  describe('accepts a photo whatever the browser called it', () => {
    it('takes a file announced as application/octet-stream, as phones send HEIC', async () => {
      const res = await submitEntry(ctx, {
        photo: await samplePhoto(),
        filename: 'IMG_4213.HEIC',
        contentType: 'application/octet-stream',
      });
      expect(res.status).toBe(201);
      expect(res.body.photoUrl).toMatch(/\.webp$/);
    });

    it('takes a file with no extension at all', async () => {
      const res = await submitEntry(ctx, {
        photo: await samplePhoto(),
        filename: 'image',
        contentType: 'application/octet-stream',
      });
      expect(res.status).toBe(201);
    });

    it('takes a JPEG that its extension claims is a PNG', async () => {
      const jpeg = await sharp(await samplePhoto())
        .jpeg()
        .toBuffer();
      const res = await submitEntry(ctx, {
        photo: jpeg,
        filename: 'mislabelled.png',
        contentType: 'image/png',
      });
      expect(res.status).toBe(201);
    });

    it.each(['webp', 'gif', 'tiff', 'avif'] as const)(
      'stores a %s upload as WebP like every other format',
      async (format) => {
        const source = sharp(await samplePhoto());
        const photo = await (
          format === 'avif' ? source.avif({ effort: 0 }) : source.toFormat(format)
        ).toBuffer();
        const res = await submitEntry(ctx, {
          photo,
          filename: `dish.${format}`,
          contentType: `image/${format}`,
        });
        expect(res.status).toBe(201);
        expect(res.body.photoUrl).toMatch(/\.webp$/);
      },
    );
  });

  it('rejects missing photo, bad types, unknown categories and unknown allergens', async () => {
    const noPhoto = await ctx.api
      .post('/api/entries')
      .field('entryName', 'X')
      .field('contestantName', 'Y')
      .field('categoryId', 'dessert');
    expect(noPhoto.status).toBe(400);

    const badType = await ctx.api
      .post('/api/entries')
      .field('entryName', 'X')
      .field('contestantName', 'Y')
      .field('categoryId', 'dessert')
      .attach('photo', Buffer.from('hello'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(badType.status).toBe(415);

    const notImage = await ctx.api
      .post('/api/entries')
      .field('entryName', 'X')
      .field('contestantName', 'Y')
      .field('categoryId', 'dessert')
      .attach('photo', Buffer.from('not really a png'), {
        filename: 'x.png',
        contentType: 'image/png',
      });
    expect(notImage.status).toBe(400);

    expect((await submitEntry(ctx, { categoryId: 'nope' })).status).toBe(400);
    expect((await submitEntry(ctx, { allergens: ['plutonium'] })).status).toBe(400);
  });

  it('refuses submissions while they are closed, whatever voting is doing', async () => {
    await ctx.api.put('/api/admin/settings').set(ctx.admin).send({ submissionsOpen: false });
    expect((await submitEntry(ctx)).status).toBe(409);
    await ctx.api
      .put('/api/admin/settings')
      .set(ctx.admin)
      .send({ submissionsOpen: true, votingOpen: false });
    expect((await submitEntry(ctx)).status).toBe(201);
    await ctx.api.put('/api/admin/settings').set(ctx.admin).send({ votingOpen: true });
  });

  it('refuses submissions until the scheduled time, then accepts them', async () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const set = await ctx.api
      .put('/api/admin/settings')
      .set(ctx.admin)
      .send({ submissionsOpenAt: soon });
    expect(set.body.submissionsOpenAt).toBe(soon);
    const early = await submitEntry(ctx);
    expect(early.status).toBe(409);
    expect(early.body.details).toEqual({ opensAt: soon });

    const past = new Date(Date.now() - 1000).toISOString();
    await ctx.api.put('/api/admin/settings').set(ctx.admin).send({ submissionsOpenAt: past });
    expect((await submitEntry(ctx)).status).toBe(201);
    await ctx.api.put('/api/admin/settings').set(ctx.admin).send({ submissionsOpenAt: null });
  });

  it('files each entry under a guest: the one picked, or one made from the name', async () => {
    const typed = await submitEntry(ctx, { contestantName: '  Gran  Smith ' });
    expect(typed.status).toBe(201);
    const names = await ctx.api.get('/api/guests/names');
    const gran = (names.body as { id: string; name: string }[]).find(
      (g) => g.name === 'Gran Smith',
    );
    expect(gran).toBeDefined();
    // No email ever leaves this endpoint.
    expect(Object.keys(names.body[0]).sort()).toEqual(['id', 'name']);

    const picked = await submitEntry(ctx, {
      contestantName: 'whatever the box said',
      guestId: gran!.id,
    });
    expect(picked.status).toBe(201);
    expect(picked.body.contestantName).toBe('Gran Smith');
    const guests = await ctx.api.get('/api/admin/guests').set(ctx.admin);
    const row = (guests.body as { name: string; entryCount: number }[]).find(
      (g) => g.name === 'Gran Smith',
    );
    expect(row?.entryCount).toBe(2);

    expect((await submitEntry(ctx, { guestId: 'gone' })).status).toBe(400);
  });

  it('admin can delete an entry, which removes the photo file', async () => {
    const res = await submitEntry(ctx, { entryName: 'Doomed' });
    const file = path.join(ctx.uploadsDir, path.basename(res.body.photoUrl));
    await expect(fs.access(file)).resolves.toBeUndefined();

    expect((await ctx.api.delete(`/api/admin/entries/${res.body.id}`)).status).toBe(401);
    expect((await ctx.api.delete(`/api/admin/entries/${res.body.id}`).set(ctx.admin)).status).toBe(
      204,
    );
    await expect(fs.access(file)).rejects.toThrow();
    expect((await ctx.api.delete(`/api/admin/entries/${res.body.id}`).set(ctx.admin)).status).toBe(
      404,
    );
  });
});
