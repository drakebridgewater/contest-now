/**
 * One contract for photos, shared by the picker in the browser and the API.
 *
 * The rule the whole pipeline is built on: **the bytes decide what a file is.**
 * A browser fills in a file part's `Content-Type` by looking the extension up in
 * a table, so an iPhone `.heic` routinely arrives as `application/octet-stream`
 * and a renamed executable arrives as `image/jpeg`. Neither is evidence. The
 * extension and media type are only used to make the file picker friendly; the
 * API sniffs the magic bytes and re-encodes every accepted upload to one format
 * before storing it.
 */

export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/** Longest edge of a stored photo, in pixels. Bigger than any screen shows it. */
export const PHOTO_MAX_EDGE = 1600;

/**
 * Decoded-pixel ceiling, to stop a "decompression bomb": a file that is tiny on
 * disk but expands to gigabytes of bitmap. 100 MP is several times any phone.
 */
export const PHOTO_MAX_PIXELS = 100_000_000;

/**
 * Every accepted upload is re-encoded to this, so the front end only ever has
 * one format to render and `photoUrl` always ends in the same extension.
 */
export const PHOTO_STORED_EXTENSION = 'webp';
export const PHOTO_STORED_MIME = 'image/webp';

/**
 * Container formats the API can decode. Matched against the file's magic bytes,
 * never against its name.
 *
 * Deliberately absent: SVG, which libvips can rasterise but which is markup
 * rather than a photograph, and BMP/ICO, which this build of sharp cannot read.
 */
export const PHOTO_INPUT_FORMATS = ['jpeg', 'png', 'webp', 'heic', 'avif', 'gif', 'tiff'] as const;
export type PhotoInputFormat = (typeof PHOTO_INPUT_FORMATS)[number];

/** Human-readable, for error messages and picker copy: "JPEG, PNG, HEIC, …". */
export const PHOTO_INPUT_FORMAT_LIST = PHOTO_INPUT_FORMATS.map((f) => f.toUpperCase()).join(', ');

/**
 * `accept` for the file input. `image/*` alone is not enough: some Android
 * pickers resolve it through the same extension table and then grey out the very
 * HEIC files the phone just took, so the awkward types are named explicitly, by
 * media type *and* by extension.
 */
export const PHOTO_ACCEPT_ATTRIBUTE = [
  'image/*',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  'image/avif',
  '.heic',
  '.heif',
  '.avif',
  '.jpg',
  '.jpeg',
  '.jfif',
  '.png',
  '.webp',
  '.gif',
  '.tif',
  '.tiff',
].join(',');

/**
 * Whether a multipart part is worth reading to the end. This is a bandwidth
 * filter, not a security check — it only turns away parts that positively
 * declare themselves something other than an image. An empty or generic type is
 * let through precisely because that is what phones send for HEIC.
 */
export function couldBePhotoPart(mimeType: string | undefined): boolean {
  const type = (mimeType ?? '').split(';')[0]!.trim().toLowerCase();
  if (type === '') return true;
  if (type === 'application/octet-stream' || type === 'binary/octet-stream') return true;
  return type.startsWith('image/');
}
