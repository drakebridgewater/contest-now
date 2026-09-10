import type { Criterion, VoterVote } from '@contest/shared';
import { describe, expect, it } from 'vitest';
import { ENTRY_FILTERS, matchesEntryFilter, type EntryFilter } from './entryFilter.ts';

const criterion = (id: number): Criterion => ({
  id,
  categoryId: 'dessert',
  slug: `c${id}`,
  name: `Criterion ${id}`,
  helpText: '',
  weight: 1,
  sortOrder: id,
  isActive: true,
});

const criteria = [criterion(1), criterion(2)];

const vote = (scores: VoterVote['scores'], tasted: boolean): VoterVote => ({
  scores,
  comment: '',
  tasted,
});

/** [name, vote] pairs covering every combination the page can show. */
const cases: [string, VoterVote | undefined][] = [
  ['untouched', undefined],
  ['tasted only', vote({}, true)],
  ['tasted and part-rated', vote({ '1': 4 }, true)],
  ['tasted and fully rated', vote({ '1': 4, '2': 5 }, true)],
  ['rated but marked untasted', vote({ '1': 4, '2': 5 }, false)],
];

function shown(filter: EntryFilter): string[] {
  return cases
    .filter(([, vote]) => matchesEntryFilter(filter, vote, criteria))
    .map(([name]) => name);
}

describe('matchesEntryFilter', () => {
  it('shows everything under "all"', () => {
    expect(shown('all')).toHaveLength(cases.length);
  });

  it('"untasted" covers entries never touched and ones explicitly un-marked', () => {
    expect(shown('untasted')).toEqual(['untouched', 'rated but marked untasted']);
  });

  it('"tasted" is the exact complement of "untasted"', () => {
    expect(shown('tasted')).toEqual([
      'tasted only',
      'tasted and part-rated',
      'tasted and fully rated',
    ]);
    expect([...shown('tasted'), ...shown('untasted')].sort()).toEqual(
      cases.map(([name]) => name).sort(),
    );
  });

  it('"unrated" needs every active criterion rated, so a partial rating still counts', () => {
    expect(shown('unrated')).toEqual(['untouched', 'tasted only', 'tasted and part-rated']);
  });

  it('offers the four filters in a fixed order, starting with all', () => {
    expect(ENTRY_FILTERS.map((f) => f.id)).toEqual(['all', 'untasted', 'tasted', 'unrated']);
  });
});
