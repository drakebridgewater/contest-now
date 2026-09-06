import { z } from 'zod';
import { AllergenOrDietaryId } from './allergens.ts';
import { Slug } from './slug.ts';

export const ENTRY_NAME_MAX = 120;
export const CONTESTANT_NAME_MAX = 80;

export const EntrySchema = z.object({
  id: z.number().int().positive(),
  entryName: z.string().min(1).max(ENTRY_NAME_MAX),
  contestantName: z.string().min(1).max(CONTESTANT_NAME_MAX),
  categoryId: Slug,
  /** Absolute or root-relative URL of the photo. Always a WebP; see `photos.ts`. */
  photoUrl: z.string(),
  allergens: z.array(z.string()),
  createdAt: z.string(),
});
export type Entry = z.infer<typeof EntrySchema>;

/** Text fields of the multipart submit request; the photo travels as a file part named "photo". */
export const CreateEntryFieldsSchema = z.object({
  entryName: z.string().trim().min(1, 'Give your entry a name').max(ENTRY_NAME_MAX),
  contestantName: z.string().trim().min(1, 'Tell us who made it').max(CONTESTANT_NAME_MAX),
  categoryId: Slug,
  allergens: z.array(AllergenOrDietaryId).max(40).default([]),
});
export type CreateEntryFields = z.infer<typeof CreateEntryFieldsSchema>;
