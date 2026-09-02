import { z } from 'zod';
import { Slug } from './slug.ts';

const ShortText = (max: number) => z.string().trim().max(max);

export const CategorySchema = z.object({
  id: Slug,
  name: ShortText(60).min(1),
  emoji: ShortText(8),
  description: ShortText(200),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});
export type Category = z.infer<typeof CategorySchema>;

export const CriterionSchema = z.object({
  id: z.number().int().positive(),
  categoryId: Slug,
  slug: Slug,
  name: ShortText(60).min(1),
  /** One line shown under the stars so guests know what they are rating. */
  helpText: ShortText(200),
  /** Relative weight in the category's overall score. 1 = equal. */
  weight: z.number().positive().max(10),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});
export type Criterion = z.infer<typeof CriterionSchema>;

export const AwardSchema = z.object({
  id: Slug,
  name: ShortText(80).min(1),
  emoji: ShortText(8),
  description: ShortText(240),
  /** Categories whose entries can be nominated. Empty = every category. */
  categoryIds: z.array(Slug),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});
export type Award = z.infer<typeof AwardSchema>;

export const EventSettingsSchema = z.object({
  eventName: ShortText(80).min(1),
  tagline: ShortText(160),
  photoShareUrl: z.union([z.url(), z.literal('')]),
  /** When false, voting and award ballots are read-only and new entries are refused. */
  votingOpen: z.boolean(),
});
export type EventSettings = z.infer<typeof EventSettingsSchema>;

export const ContestConfigSchema = z.object({
  settings: EventSettingsSchema,
  categories: z.array(CategorySchema),
  criteria: z.array(CriterionSchema),
  awards: z.array(AwardSchema),
});
export type ContestConfig = z.infer<typeof ContestConfigSchema>;

// ---- admin inputs -------------------------------------------------------------

export const CategoryInputSchema = CategorySchema.omit({ id: true })
  .partial({ emoji: true, description: true, sortOrder: true, isActive: true })
  .extend({ id: Slug.optional() });
export type CategoryInput = z.infer<typeof CategoryInputSchema>;

export const CriterionInputSchema = CriterionSchema.omit({ id: true }).partial({
  slug: true,
  helpText: true,
  weight: true,
  sortOrder: true,
  isActive: true,
});
export type CriterionInput = z.infer<typeof CriterionInputSchema>;

export const AwardInputSchema = AwardSchema.omit({ id: true })
  .partial({ emoji: true, description: true, categoryIds: true, sortOrder: true, isActive: true })
  .extend({ id: Slug.optional() });
export type AwardInput = z.infer<typeof AwardInputSchema>;

export const SettingsInputSchema = EventSettingsSchema.partial();
export type SettingsInput = z.infer<typeof SettingsInputSchema>;
