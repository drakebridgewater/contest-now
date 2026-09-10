import { isVoteComplete, type Criterion, type VoterVote } from '@contest/shared';

/**
 * Which entries the vote page shows. One filter at a time rather than stacking
 * toggles: on a phone, a single row of chips beats guessing which combination
 * of switches is hiding a dish.
 */
export type EntryFilter = 'all' | 'untasted' | 'tasted' | 'unrated';

export const ENTRY_FILTERS: { id: EntryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'untasted', label: 'Not tasted' },
  { id: 'tasted', label: 'Tasted' },
  { id: 'unrated', label: 'Not rated' },
];

/**
 * `unrated` means "still needs stars": an entry counts as rated only once every
 * active criterion has one, which is the same bar the ranking uses.
 */
export function matchesEntryFilter(
  filter: EntryFilter,
  vote: VoterVote | undefined,
  criteria: readonly Criterion[],
): boolean {
  switch (filter) {
    case 'untasted':
      return !vote?.tasted;
    case 'tasted':
      return Boolean(vote?.tasted);
    case 'unrated':
      return !isVoteComplete(vote?.scores, criteria);
    case 'all':
      return true;
  }
}

/** The empty-state wording, which depends on why nothing is showing. */
export function emptyFilterMessage(filter: EntryFilter): { title: string; body: string } {
  switch (filter) {
    case 'untasted':
      return {
        title: 'You have tasted everything here',
        body: 'Tap “All” to look back over the entries, or nominate your favourites below.',
      };
    case 'tasted':
      return {
        title: 'Nothing marked tasted yet',
        body: 'Mark a dish tasted on its card as you work your way around the table.',
      };
    case 'unrated':
      return {
        title: 'You have rated everything here',
        body: 'Tap “All” to review your ratings, or nominate your favourites below.',
      };
    case 'all':
      return {
        title: 'Nothing to show',
        body: 'No entries match this category yet.',
      };
  }
}
