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
