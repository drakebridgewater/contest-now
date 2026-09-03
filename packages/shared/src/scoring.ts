import type { Award, Criterion } from './contest.ts';
import type { Entry } from './entries.ts';
import type { CriterionStats, Distribution, EntrySummary } from './results.ts';
import { RATING_VALUES, type Rating, type Scores, type VoterVote } from './votes.ts';

export function scoreKey(criterionId: number): string {
  return String(criterionId);
}

function bySortOrder<T extends { sortOrder: number; id: number | string }>(a: T, b: T): number {
  return a.sortOrder - b.sortOrder || String(a.id).localeCompare(String(b.id));
}

/** Active criteria of one category, in display order. */
export function activeCriteriaFor(criteria: readonly Criterion[], categoryId: string): Criterion[] {
  return criteria.filter((c) => c.categoryId === categoryId && c.isActive).sort(bySortOrder);
}

/** Categories/awards helper: active items in display order. */
export function activeSorted<
  T extends { sortOrder: number; id: number | string; isActive: boolean },
>(items: readonly T[]): T[] {
  return items.filter((item) => item.isActive).sort(bySortOrder);
}

/** A vote is complete when every active criterion has a rating. Extra scores (for deactivated criteria) are ignored. */
export function isVoteComplete(
  scores: Scores | undefined,
  criteria: readonly Criterion[],
): boolean {
  if (criteria.length === 0) return false;
  if (!scores) return false;
  return criteria.every((c) => scores[scoreKey(c.id)] !== undefined);
}

export function ratedCriteriaCount(
  scores: Scores | undefined,
  criteria: readonly Criterion[],
): number {
  if (!scores) return 0;
  return criteria.filter((c) => scores[scoreKey(c.id)] !== undefined).length;
}

export function emptyDistribution(): Distribution {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Per-criterion averages, histograms and the weighted overall for one entry.
 * `criteria` must be the active criteria of the entry's category. Only complete votes count.
 */
export function summarizeEntry(
  criteria: readonly Criterion[],
  votes: readonly VoterVote[],
): EntrySummary {
  const complete = votes.filter((vote) => isVoteComplete(vote.scores, criteria));
  const partialVoteCount = votes.filter(
    (vote) =>
      !isVoteComplete(vote.scores, criteria) && ratedCriteriaCount(vote.scores, criteria) > 0,
  ).length;

  const stats: CriterionStats[] = criteria.map((criterion) => {
    const distribution = emptyDistribution();
    let sum = 0;
    for (const vote of complete) {
      const rating = vote.scores[scoreKey(criterion.id)] as Rating | undefined;
      if (rating === undefined) continue;
      distribution[rating] += 1;
      sum += rating;
    }
    return {
      criterionId: criterion.id,
      average: complete.length === 0 ? 0 : round(sum / complete.length),
      distribution,
    };
  });

  const totalWeight = criteria.reduce((acc, c) => acc + c.weight, 0);
  const overall =
    complete.length === 0 || totalWeight === 0
      ? 0
      : round(
          criteria.reduce((acc, c, i) => acc + c.weight * (stats[i]?.average ?? 0), 0) /
            totalWeight,
        );

  return { voteCount: complete.length, partialVoteCount, overall, criteria: stats };
}

/**
 * Sorts by overall (desc), then vote count (desc), then id (asc) for determinism.
 * Entries with equal overall and vote count share a rank (1, 1, 3).
 */
export function rankEntries<T extends { id: number; overall: number; voteCount: number }>(
  rows: readonly T[],
): (T & { rank: number })[] {
  const sorted = [...rows].sort(
    (a, b) => b.overall - a.overall || b.voteCount - a.voteCount || a.id - b.id,
  );
  let rank = 0;
  return sorted.map((row, index) => {
    const previous = sorted[index - 1];
    const tied =
      previous !== undefined &&
      previous.overall === row.overall &&
      previous.voteCount === row.voteCount;
    if (!tied) rank = index + 1;
    return { ...row, rank };
  });
}

export function isEntryInAwardScope(
  award: Pick<Award, 'categoryIds'>,
  entry: Pick<Entry, 'categoryId'>,
): boolean {
  return award.categoryIds.length === 0 || award.categoryIds.includes(entry.categoryId);
}

export interface BallotTally {
  counts: Map<number, number>;
  totalBallots: number;
  /** Entry ids with the highest count; several on a tie, none without ballots. */
  winnerEntryIds: number[];
}

export function tallyBallots(ballots: readonly { entryId: number }[]): BallotTally {
  const counts = new Map<number, number>();
  for (const ballot of ballots) {
    counts.set(ballot.entryId, (counts.get(ballot.entryId) ?? 0) + 1);
  }
  let best = 0;
  for (const count of counts.values()) best = Math.max(best, count);
  const winnerEntryIds =
    best === 0
      ? []
      : [...counts.entries()]
          .filter(([, count]) => count === best)
          .map(([entryId]) => entryId)
          .sort((a, b) => a - b);
  return { counts, totalBallots: ballots.length, winnerEntryIds };
}

export { RATING_VALUES };
