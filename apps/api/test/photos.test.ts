import { PHOTO_MAX_EDGE } from '@contest/shared';
import sharp, { type Metadata } from 'sharp';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../src/http/errors.ts';
import { planForMetadata, toStoredPhoto } from '../src/services/photos.ts';

/** A real file in the given format, so the pipeline is fed magic bytes, not fixtures. */
function encode(
  format: 'jpeg' | 'png' | 'webp' | 'gif' | 'tiff' | 'avif',
  { width = 2400, height = 1600 } = {},
): Promise<Buffer> {
  const image = sharp({ create: { width, height, channels: 3, background: '#c0392b' } });
  return format === 'avif'
    ? image.avif({ effort: 0 }).toBuffer()
    : image.toFormat(format).toBuffer();
}

describe('planForMetadata', () => {
  // HEIC and AVIF are both "heif" to sharp and are told apart only by codec.
  // These are the fields sharp really reports for each; getting this wrong sends
  // an iPhone photo down a path that cannot decode it.
  it('routes an HEVC-coded HEIF file (an iPhone HEIC) to the wasm decoder', () => {
    expect(planForMetadata({ format: 'heif', compression: 'hevc' } as Metadata)).toEqual({
      format: 'heic',
      needsHeicDecoder: true,
    });
  });

  it('lets an AV1-coded HEIF file (AVIF) go straight to sharp', () => {
    expect(planForMetadata({ format: 'heif', compression: 'av1' } as Metadata)).toEqual({
      format: 'avif',
      needsHeicDecoder: false,
    });
  });

  it('refuses formats it recognises but will not store, naming them', () => {
    expect(() => planForMetadata({ format: 'svg' } as Metadata)).toThrow(/SVG/);
    try {
      planForMetadata({ format: 'svg' } as Metadata);
    } catch (error) {
      expect((error as HttpError).status).toBe(415);
    }
  });
});

describe('toStoredPhoto', () => {
  it.each(['jpeg', 'png', 'webp', 'gif', 'tiff', 'avif'] as const)(
    'converts %s to a bounded WebP',
    async (format) => {
      const stored = await sharp(await toStoredPhoto(await encode(format))).metadata();
      expect(stored.format).toBe('webp');
      expect(stored.width).toBe(PHOTO_MAX_EDGE);
      expect(stored.height).toBe(Math.round((PHOTO_MAX_EDGE * 1600) / 2400));
    },
  );

  it('leaves a photo smaller than the bound at its own size', async () => {
    const stored = await sharp(
      await toStoredPhoto(await encode('jpeg', { width: 320, height: 240 })),
    ).metadata();
    expect(stored.width).toBe(320);
  });

  it('applies the EXIF orientation instead of passing it along', async () => {
    // Orientation 6 means "rotate 90° clockwise to display", so a 400x200 file
    // has to come out 200x400 with the tag gone.
    const sideways = await sharp({
      create: { width: 400, height: 200, channels: 3, background: '#fff' },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const stored = await sharp(await toStoredPhoto(sideways)).metadata();
    expect([stored.width, stored.height]).toEqual([200, 400]);
    expect(stored.orientation).toBeUndefined();
  });

  it('drops the EXIF a phone attaches, GPS included', async () => {
    const located = await sharp({
      create: { width: 64, height: 48, channels: 3, background: '#fff' },
    })
      .withExif({ IFD0: { Copyright: 'contest-now' }, IFD3: { GPSLatitudeRef: 'N' } })
      .jpeg()
      .toBuffer();
    expect((await sharp(located).metadata()).exif).toBeDefined();
    expect((await sharp(await toStoredPhoto(located)).metadata()).exif).toBeUndefined();
  });

  it('rejects bytes that are not an image at all', async () => {
    await expect(toStoredPhoto(Buffer.from('this is not a photo'))).rejects.toThrow(HttpError);
  });
});
