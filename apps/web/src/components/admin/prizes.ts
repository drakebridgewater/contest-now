import { normalizeVoterName, type ContestResults, type Entry } from '@contest/shared';

/** A category or an award: anything the host hands a prize out for. */
export interface Prize {
  /** `category:<id>` or `award:<id>`, unique across both kinds. */
  key: string;
  kind: 'category' | 'award';
  id: string;
  name: string;
  emoji: string;
  /** The host's pick, or null while it is still open. */
  winner: Entry | null;
}

/** Every prize in announcing order (categories, then awards), with the host's pick. */
export function listPrizes(results: ContestResults): Prize[] {
  const categories = results.categories.map(({ category, entries, chosenWinnerEntryId }) => ({
    key: `category:${category.id}`,
    kind: 'category' as const,
    id: category.id,
    name: category.name,
    emoji: category.emoji,
    winner: entries.find((entry) => entry.id === chosenWinnerEntryId) ?? null,
  }));
  const awards = results.awards.map(({ award, tally, chosenWinnerEntryId }) => ({
    key: `award:${award.id}`,
    kind: 'award' as const,
    id: award.id,
    name: award.name,
    emoji: award.emoji || '🏆',
    // A pick is normally a nominated entry, but it need not be.
    winner:
      tally.find((row) => row.entry.id === chosenWinnerEntryId)?.entry ??
      results.categories
        .flatMap((category) => category.entries)
        .find((entry) => entry.id === chosenWinnerEntryId) ??
      null,
  }));
  return [...categories, ...awards];
}

/**
 * The prizes this contestant has already been picked for, other than `exceptKey`.
 * Entries carry only the typed name, so names are compared the way the vote page
 * matches them.
 */
export function otherWins(prizes: Prize[], contestantName: string, exceptKey: string): Prize[] {
  const name = normalizeVoterName(contestantName);
  return prizes.filter(
    (prize) =>
      prize.key !== exceptKey &&
      prize.winner !== null &&
      normalizeVoterName(prize.winner.contestantName) === name,
  );
}
