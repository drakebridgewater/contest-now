import { describe, expect, it } from 'vitest';
import { Slug, slugify } from './slug.ts';

describe('slugify', () => {
  it('lowercases, strips accents and collapses separators', () => {
    expect(slugify('Best Presented!')).toBe('best-presented');
    expect(slugify('  Crème  Brûlée  ')).toBe('creme-brulee');
    expect(slugify('Healthiest (without sacrificing flavor)')).toBe(
      'healthiest-without-sacrificing-flavor',
    );
  });

  it('always produces a valid Slug or an empty string', () => {
    expect(Slug.safeParse(slugify('A'.repeat(80))).success).toBe(true);
    expect(slugify('!!!')).toBe('');
  });
});

describe('Slug', () => {
  it('rejects uppercase, spaces and leading dashes', () => {
    expect(Slug.safeParse('Best').success).toBe(false);
    expect(Slug.safeParse('best presented').success).toBe(false);
    expect(Slug.safeParse('-best').success).toBe(false);
    expect(Slug.safeParse('best-presented').success).toBe(true);
  });
});
