import { z } from 'zod';
import { AllergenId } from './allergens.ts';
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

export const FAQS_MAX = 50;

export const FaqSchema = z.object({
  question: ShortText(200).min(1, 'Enter a question'),
  answer: ShortText(2000).min(1, 'Enter an answer'),
});
export type Faq = z.infer<typeof FaqSchema>;

export const SCHEDULE_MAX = 30;

/** One line of the evening's timeline, added by the host. */
export const ScheduleItemSchema = z.object({
  at: z.iso.datetime({ offset: true }),
  title: ShortText(80).min(1, 'Name this item'),
  details: ShortText(300),
});
export type ScheduleItem = z.infer<typeof ScheduleItemSchema>;

export const EventSettingsSchema = z.object({
  eventName: ShortText(80).min(1),
  tagline: ShortText(160),
  photoShareUrl: z.union([z.url(), z.literal('')]),
  /** Where the party is, shown on the details page. Empty = not announced yet. */
  location: ShortText(200),
  /** When the party starts (ISO). Null = not announced yet. */
  startsAt: z.iso.datetime({ offset: true }).nullable(),
  /** The FAQ page, in display order. */
  faqs: z.array(FaqSchema).max(FAQS_MAX),
  /** The host's timeline items, in time order. The start, entry and voting times are added to it for guests. */
  schedule: z.array(ScheduleItemSchema).max(SCHEDULE_MAX),
  /** Allergies the host lists on the details page, on top of what guests report. */
  knownAllergies: z.array(AllergenId).max(40),
  /** Manual switch: when false, votes and award ballots are read-only. */
  votingOpen: z.boolean(),
  /** Voting stays shut until this moment (ISO). Null = no wait. */
  votingOpensAt: z.iso.datetime({ offset: true }).nullable(),
  /** Manual switch: when false, new entries are refused. */
  submissionsOpen: z.boolean(),
  /** Submissions stay shut until this moment (ISO). Null = no wait. */
  submissionsOpenAt: z.iso.datetime({ offset: true }).nullable(),
});
export type EventSettings = z.infer<typeof EventSettingsSchema>;

export type PhaseStatus = 'open' | 'scheduled' | 'closed';

/**
 * Whether voting or submissions are accepting input right now. The manual switch
 * wins: a host who closes early stays closed whatever the schedule says.
 */
export function phaseStatus(
  open: boolean,
  opensAt: string | null,
  now: Date = new Date(),
): PhaseStatus {
  if (!open) return 'closed';
  if (opensAt !== null && new Date(opensAt).getTime() > now.getTime()) return 'scheduled';
  return 'open';
}

export function votingStatus(settings: EventSettings, now?: Date): PhaseStatus {
  return phaseStatus(settings.votingOpen, settings.votingOpensAt, now);
}

export function submissionsStatus(settings: EventSettings, now?: Date): PhaseStatus {
  return phaseStatus(settings.submissionsOpen, settings.submissionsOpenAt, now);
}

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
