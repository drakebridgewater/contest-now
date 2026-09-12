import { isVoteComplete, type Criterion, type VoterVote } from '@contest/shared';

/**
 * Which entries the vote page shows. One toggle rather than a row of chips: on a
 * phone the only question worth asking mid-party is "what do I still owe?", and
 * every card now carries its own state, so filtering by it as well was noise.
 */

/**
 * "Still needs you": not tasted, or tasted but not yet rated on every active
 * criterion — the same bar the ranking uses.
 */
export function needsAttention(
  vote: VoterVote | undefined,
  criteria: readonly Criterion[],
): boolean {
  if (!vote?.tasted) return true;
  // A category with no criteria can never be "rated", so tasting it is all there is
  // to do. Without this the toggle could never empty for such a category.
  if (criteria.length === 0) return false;
  return !isVoteComplete(vote.scores, criteria);
}

/** Shown when the toggle has hidden everything the voter has already finished. */
export const NOTHING_REMAINING = {
  title: 'You are all caught up',
  body: 'Turn off “Only what’s left” to look back over the entries, or nominate your favourites below.',
};

/** Shown when a category genuinely has nothing in it. */
export const NOTHING_HERE = {
  title: 'Nothing to show',
  body: 'No entries match this category yet.',
};
