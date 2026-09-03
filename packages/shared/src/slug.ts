import { z } from 'zod';

export const SLUG_MAX_LENGTH = 40;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Stable, URL-safe identifier used for categories, criteria and awards. */
export const Slug = z
  .string()
  .min(1)
  .max(SLUG_MAX_LENGTH)
  .regex(SLUG_PATTERN, 'Use lowercase letters, numbers and single dashes (e.g. "best-presented")');

export type Slug = z.infer<typeof Slug>;

/** Turn a human name into a slug: "Best Presented!" -> "best-presented". */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
}
