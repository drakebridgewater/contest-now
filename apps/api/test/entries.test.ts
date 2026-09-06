import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isUploadsDirWritable } from '../src/services/entries.ts';
import {
  createTestContext,
  samplePhoto,
  submitEntry,
  unusableUploadsDir,
  type TestContext,
} from './helpers.ts';

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

  it('refuses submissions when voting is closed', async () => {
    await ctx.api.put('/api/admin/settings').set(ctx.admin).send({ votingOpen: false });
    expect((await submitEntry(ctx)).status).toBe(409);
    await ctx.api.put('/api/admin/settings').set(ctx.admin).send({ votingOpen: true });
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

describe('when the uploads directory cannot be written to', () => {
  // What a bind-mounted volume the container user does not own looks like from
  // the inside: the write is refused however good the photo was.
  let broken: TestContext;

  beforeAll(async () => {
    broken = await createTestContext({ uploadsDir: await unusableUploadsDir() });
  });
  afterAll(async () => {
    await broken.close();
  });

  it('answers a submission with a 503 that blames the server, not the guest', async () => {
    const res = await submitEntry(broken, { entryName: 'Unlucky' });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/uploads folder/i);
    // And nothing half-made was recorded against it.
    expect((await broken.api.get('/api/entries')).body).toHaveLength(0);
  });

  it('is spotted by the start-up probe rather than by the first guest', async () => {
    expect(await isUploadsDirWritable(broken.uploadsDir)).toBe(false);
    expect(await isUploadsDirWritable(ctx.uploadsDir)).toBe(true);
  });

  it('reports it on /api/health, so the container shows unhealthy', async () => {
    broken.state.uploadsStatus = 'unwritable';
    const res = await broken.api.get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', db: 'ready', uploads: 'unwritable' });
  });

  it('leaves a healthy stack reporting ok', async () => {
    const res = await ctx.api.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', uploads: 'ready' });
  });
});
