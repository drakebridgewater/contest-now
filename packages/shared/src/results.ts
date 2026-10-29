import { z } from 'zod';
import type { Award, Category, Criterion } from './contest.ts';
import type { Entry } from './entries.ts';
import type { Rating } from './votes.ts';

export type Distribution = Record<Rating, number>;

export interface CriterionStats {
  criterionId: number;
  /** Mean rating over complete votes; 0 when there are none. */
  average: number;
  distribution: Distribution;
}

export interface EntrySummary {
  /** Votes that rated every active criterion. Only these count toward scores. */
  voteCount: number;
  /** Votes that rated some but not all active criteria. */
  partialVoteCount: number;
  /** Voters who marked the entry tasted, rated or not. */
  tastedCount: number;
  /** Weighted mean of the criterion averages, 0..5. */
  overall: number;
  criteria: CriterionStats[];
}

export interface EntryResult extends Entry, EntrySummary {
  /** 1-based rank inside its category; ties share a rank. */
  rank: number;
  comments: { voterName: string; comment: string }[];
  /** Names of the voters who marked it tasted, sorted. */
  tasters: string[];
}

export interface CategoryResults {
  category: Category;
  criteria: Criterion[];
  entries: EntryResult[];
  /** The entry the host marked as this category's winner, if any. */
  chosenWinnerEntryId: number | null;
}

export interface AwardTally {
  entry: Entry;
  count: number;
}

export interface AwardResults {
  award: Award;
  totalBallots: number;
  tally: AwardTally[];
  /** More than one id means a tie. Empty when nobody has voted. */
  winnerEntryIds: number[];
  /** The entry the host marked as the winner, if any. Need not lead the tally. */
  chosenWinnerEntryId: number | null;
}

export interface ContestResults {
  categories: CategoryResults[];
  awards: AwardResults[];
  summary: {
    voterCount: number;
    entryCount: number;
    completeVoteCount: number;
    tastedCount: number;
    ballotCount: number;
  };
}

/** Marks an entry as a prize's winner; `null` clears the pick. */
export const SetWinnerSchema = z.object({
  entryId: z.number().int().positive().nullable(),
});
export type SetWinner = z.infer<typeof SetWinnerSchema>;
