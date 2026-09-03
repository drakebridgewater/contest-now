import { z } from 'zod';

export const VOTER_NAME_MIN = 2;
export const VOTER_NAME_MAX = 60;
export const COMMENT_MAX = 500;

/** Voters identify themselves by name only; the API stores the normalized form. */
export const VoterName = z
  .string()
  .trim()
  .min(VOTER_NAME_MIN, 'Enter at least 2 characters')
  .max(VOTER_NAME_MAX);

export function normalizeVoterName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const RATING_VALUES = [1, 2, 3, 4, 5] as const;
export type Rating = (typeof RATING_VALUES)[number];
export const Rating = z.literal(RATING_VALUES);

/** Keyed by String(criterion.id). */
export const ScoresSchema = z.record(z.string(), Rating);
export type Scores = z.infer<typeof ScoresSchema>;

export const VoterVoteSchema = z.object({
  scores: ScoresSchema,
  comment: z.string(),
});
export type VoterVote = z.infer<typeof VoterVoteSchema>;

/** Merge semantics: only the keys present are changed; null removes a star. */
export const UpsertVoteSchema = z.object({
  voterName: VoterName,
  scores: z.record(z.string(), Rating.nullable()).optional(),
  comment: z.string().max(COMMENT_MAX).optional(),
});
export type UpsertVote = z.infer<typeof UpsertVoteSchema>;

export const VoterStateSchema = z.object({
  /** Keyed by String(entry.id). */
  votes: z.record(z.string(), VoterVoteSchema),
  /** Keyed by award id, value is the nominated entry id. */
  ballots: z.record(z.string(), z.number().int().positive()),
});
export type VoterState = z.infer<typeof VoterStateSchema>;

export const UpsertBallotSchema = z.object({
  voterName: VoterName,
  entryId: z.number().int().positive(),
});
export type UpsertBallot = z.infer<typeof UpsertBallotSchema>;

export const VoterInfoSchema = z.object({
  voterName: z.string(),
  voteCount: z.number().int(),
  completeVoteCount: z.number().int(),
  ballotCount: z.number().int(),
  firstActivity: z.string(),
  lastActivity: z.string(),
});
export type VoterInfo = z.infer<typeof VoterInfoSchema>;

export const RenameVoterSchema = z.object({ newName: VoterName });
export type RenameVoter = z.infer<typeof RenameVoterSchema>;
