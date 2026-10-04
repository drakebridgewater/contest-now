import { z } from 'zod';
import { AllergenOrDietaryId } from './allergens.ts';
import { Slug } from './slug.ts';

export const ENTRY_NAME_MAX = 120;
export const CONTESTANT_NAME_MAX = 80;

export const EntrySchema = z.object({
  id: z.number().int().positive(),
  entryName: z.string().min(1).max(ENTRY_NAME_MAX),
  contestantName: z.string().min(1).max(CONTESTANT_NAME_MAX),
  /** Null when the contest has no categories; such an entry is only up for awards. */
  categoryId: Slug.nullable(),
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
  /** Required while the contest has active categories, omitted when it has none. */
  categoryId: Slug.optional(),
  allergens: z.array(AllergenOrDietaryId).max(40).default([]),
  /** The guest picked from the name autocomplete. Without it the name is matched or a guest created. */
  guestId: z.string().min(1).max(64).optional(),
});
export type CreateEntryFields = z.infer<typeof CreateEntryFieldsSchema>;
