import type { Criterion, VoterVote } from '@contest/shared';
import { describe, expect, it } from 'vitest';
import { needsAttention } from './entryFilter.ts';

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

function remaining(list: readonly Criterion[] = criteria): string[] {
  return cases.filter(([, vote]) => needsAttention(vote, list)).map(([name]) => name);
}

describe('needsAttention', () => {
  it('keeps anything not yet tasted, however it was rated', () => {
    expect(remaining()).toContain('untouched');
    expect(remaining()).toContain('rated but marked untasted');
  });

  it('keeps a tasted entry until every active criterion has a star', () => {
    expect(remaining()).toContain('tasted only');
    expect(remaining()).toContain('tasted and part-rated');
  });

  it('drops only the entries that are finished', () => {
    expect(remaining()).toEqual([
      'untouched',
      'tasted only',
      'tasted and part-rated',
      'rated but marked untasted',
    ]);
  });

  it('asks only for a tasting mark when the category has no criteria to rate', () => {
    // isVoteComplete is false for an empty criteria list, so without the special
    // case here "Only what's left" could never empty for such a category.
    expect(remaining([])).toEqual(['untouched', 'rated but marked untasted']);
  });
});
