import { describe, expect, it } from 'vitest';
import type { Criterion } from './contest.ts';
import {
  activeCriteriaFor,
  isEntryInAwardScope,
  isVoteComplete,
  rankEntries,
  summarizeEntry,
  tallyBallots,
} from './scoring.ts';
import type { VoterVote } from './votes.ts';

const criterion = (id: number, overrides: Partial<Criterion> = {}): Criterion => ({
  id,
  categoryId: 'dessert',
  slug: `c${id}`,
  name: `Criterion ${id}`,
  helpText: '',
  weight: 1,
  sortOrder: id,
  isActive: true,
  ...overrides,
});

const vote = (scores: Record<string, 1 | 2 | 3 | 4 | 5>, comment = ''): VoterVote => ({
  scores,
  comment,
});

describe('activeCriteriaFor', () => {
  it('filters by category and active flag and sorts by sortOrder', () => {
    const list = [
      criterion(3, { sortOrder: 1 }),
      criterion(1, { sortOrder: 2 }),
      criterion(2, { isActive: false }),
      criterion(4, { categoryId: 'cocktail' }),
    ];
    expect(activeCriteriaFor(list, 'dessert').map((c) => c.id)).toEqual([3, 1]);
  });
});

describe('isVoteComplete', () => {
  const criteria = [criterion(1), criterion(2)];

  it('requires every active criterion', () => {
    expect(isVoteComplete({ '1': 5 }, criteria)).toBe(false);
    expect(isVoteComplete({ '1': 5, '2': 3 }, criteria)).toBe(true);
  });

  it('ignores scores for criteria that are no longer active', () => {
    expect(isVoteComplete({ '1': 5, '2': 3, '99': 1 }, criteria)).toBe(true);
  });

  it('is never complete without criteria or scores', () => {
    expect(isVoteComplete({ '1': 5 }, [])).toBe(false);
    expect(isVoteComplete(undefined, criteria)).toBe(false);
  });
});

describe('summarizeEntry', () => {
  const criteria = [criterion(1, { weight: 1 }), criterion(2, { weight: 3 })];

  it('averages only complete votes and counts partial ones separately', () => {
    const summary = summarizeEntry(criteria, [
      vote({ '1': 4, '2': 2 }),
      vote({ '1': 2, '2': 4 }),
      vote({ '1': 5 }), // partial
      vote({}), // untouched, ignored
    ]);
    expect(summary.voteCount).toBe(2);
    expect(summary.partialVoteCount).toBe(1);
    expect(summary.criteria[0]?.average).toBe(3);
    expect(summary.criteria[1]?.average).toBe(3);
    expect(summary.criteria[0]?.distribution).toEqual({ 1: 0, 2: 1, 3: 0, 4: 1, 5: 0 });
  });

  it('weights the overall score', () => {
    const summary = summarizeEntry(criteria, [vote({ '1': 5, '2': 1 })]);
    // (1*5 + 3*1) / 4 = 2
    expect(summary.overall).toBe(2);
  });

  it('returns zeros without complete votes', () => {
    const summary = summarizeEntry(criteria, [vote({ '1': 5 })]);
    expect(summary.overall).toBe(0);
    expect(summary.voteCount).toBe(0);
    expect(summary.criteria.every((c) => c.average === 0)).toBe(true);
  });
});

describe('rankEntries', () => {
  it('orders by overall then vote count and shares ranks on ties', () => {
    const ranked = rankEntries([
      { id: 1, overall: 4, voteCount: 3 },
      { id: 2, overall: 4.5, voteCount: 1 },
      { id: 3, overall: 4, voteCount: 3 },
      { id: 4, overall: 4, voteCount: 2 },
    ]);
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      [2, 1],
      [1, 2],
      [3, 2],
      [4, 4],
    ]);
  });
});

describe('isEntryInAwardScope', () => {
  it('treats an empty scope as every category', () => {
    expect(isEntryInAwardScope({ categoryIds: [] }, { categoryId: 'dessert' })).toBe(true);
    expect(isEntryInAwardScope({ categoryIds: ['dessert'] }, { categoryId: 'dessert' })).toBe(true);
    expect(isEntryInAwardScope({ categoryIds: ['dessert'] }, { categoryId: 'cocktail' })).toBe(
      false,
    );
  });
});

describe('tallyBallots', () => {
  it('finds the winner and reports ties', () => {
    expect(tallyBallots([{ entryId: 1 }, { entryId: 2 }, { entryId: 1 }]).winnerEntryIds).toEqual([
      1,
    ]);
    expect(tallyBallots([{ entryId: 2 }, { entryId: 1 }]).winnerEntryIds).toEqual([1, 2]);
    expect(tallyBallots([]).winnerEntryIds).toEqual([]);
  });
});
