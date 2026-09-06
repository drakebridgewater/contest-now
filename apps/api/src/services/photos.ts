import {
  PHOTO_INPUT_FORMAT_LIST,
  PHOTO_MAX_EDGE,
  PHOTO_MAX_PIXELS,
  type PhotoInputFormat,
} from '@contest/shared';
import sharp, { type Metadata } from 'sharp';
import { badRequest, unsupportedMedia } from '../http/errors.ts';

/** Container formats sharp decodes directly, keyed by the name it reports. */
const DIRECT_FORMATS: Partial<Record<string, PhotoInputFormat>> = {
  jpeg: 'jpeg',
  jpg: 'jpeg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
  tif: 'tiff',
  tiff: 'tiff',
};

/** Names we show people for formats we recognise but will not store. */
const REFUSED_FORMATS: Partial<Record<string, string>> = {
  svg: 'SVG',
  pdf: 'PDF',
};

export interface PhotoPlan {
  format: PhotoInputFormat;
  /**
   * True for HEIC. sharp's prebuilt libvips parses the HEIF container but ships
   * libheif without an HEVC decoder, so it reads an iPhone photo's dimensions
   * and then fails on the pixels. AVIF is also HEIF but uses AV1, which is
   * built in, so it needs no help.
   */
  needsHeicDecoder: boolean;
}

/**
 * Decides how to handle an upload from what sharp made of its magic bytes.
 * Split out from the pipeline because this routing — especially telling HEIC
 * and AVIF apart inside the shared HEIF container — is the part worth testing
 * without a binary fixture for every format.
 */
export function planForMetadata(metadata: Metadata): PhotoPlan {
  const format = metadata.format ?? '';

  if (format === 'heif') {
    const isHeic = metadata.compression === 'hevc';
    return { format: isHeic ? 'heic' : 'avif', needsHeicDecoder: isHeic };
  }

  const direct = DIRECT_FORMATS[format];
  if (direct) return { format: direct, needsHeicDecoder: false };

  const refused = REFUSED_FORMATS[format];
  throw unsupportedMedia(
    refused
      ? `${refused} files can't be used as an entry photo. Please upload a photo: ${PHOTO_INPUT_FORMAT_LIST}.`
      : `That file isn't a photo we can read. Please upload one of: ${PHOTO_INPUT_FORMAT_LIST}.`,
  );
}

/** Reads the magic bytes. Anything unreadable is a broken or non-image file. */
async function readMetadata(buffer: Buffer): Promise<Metadata> {
  try {
    return await sharp(buffer, { failOn: 'error' }).metadata();
  } catch {
    throw badRequest(
      `Could not read that photo. Please upload one of: ${PHOTO_INPUT_FORMAT_LIST}.`,
    );
  }
}

function assertWithinPixelBudget(metadata: Metadata): void {
  const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
  if (pixels > PHOTO_MAX_PIXELS) {
    throw badRequest('That photo has too many pixels. Try one straight from your camera.');
  }
}

/**
 * Decodes HEIC to JPEG with a WebAssembly decoder, filling the gap sharp leaves.
 * Imported on demand: the decoder carries megabytes of wasm that most uploads —
 * and every start-up — never need.
 */
async function decodeHeic(buffer: Buffer): Promise<Buffer> {
  const { default: convert } = await import('heic-convert');
  try {
    // Quality is high because this is an intermediate; the WebP encode below is
    // what actually decides the stored file's size.
    return Buffer.from(await convert({ buffer, format: 'JPEG', quality: 0.92 }));
  } catch {
    throw badRequest('Could not read that HEIC photo. Please try taking a new one.');
  }
}

/**
 * Re-encodes a decodable image to a bounded WebP.
 *
 * `rotate()` with no argument bakes in the EXIF orientation phones record, so a
 * photo taken sideways is stored upright. Nothing else from EXIF survives: sharp
 * drops metadata unless asked to keep it, which also means the GPS coordinates a
 * phone attaches never reach the uploads directory. Animated GIF and WebP inputs
 * come through as their first frame, which is what an entry photo should be.
 */
async function encodeWebp(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer, { failOn: 'error', limitInputPixels: PHOTO_MAX_PIXELS })
      .rotate()
      .resize({
        width: PHOTO_MAX_EDGE,
        height: PHOTO_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw badRequest('Could not read that photo. Please try taking a new one.');
  }
}

/**
 * Turns any supported upload into the one format entries are stored in.
 *
 * The name and `Content-Type` the browser sent are ignored entirely — this works
 * from the bytes, so a `.heic` announced as `application/octet-stream` and a
 * `.jpg` that is really a PNG both land in the right place.
 */
export async function toStoredPhoto(buffer: Buffer): Promise<Buffer> {
  const metadata = await readMetadata(buffer);
  const plan = planForMetadata(metadata);
  assertWithinPixelBudget(metadata);
  return encodeWebp(plan.needsHeicDecoder ? await decodeHeic(buffer) : buffer);
}
