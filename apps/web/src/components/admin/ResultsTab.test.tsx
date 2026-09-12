import type { CategoryResults, Distribution, EntryResult } from '@contest/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ResultsTab } from './ResultsTab.tsx';

const distribution = (counts: Partial<Distribution> = {}): Distribution => ({
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
  ...counts,
});

const entry = (overrides: Partial<EntryResult> & Pick<EntryResult, 'id' | 'entryName'>) =>
  ({
    contestantName: 'Sam',
    categoryId: 'dessert',
    photoUrl: `/uploads/${overrides.id}.webp`,
    allergens: [],
    createdAt: new Date().toISOString(),
    voteCount: 0,
    partialVoteCount: 0,
    tastedCount: 0,
    overall: 0,
    criteria: [{ criterionId: 1, average: 0, distribution: distribution() }],
    rank: 1,
    comments: [],
    tasters: [],
    ...overrides,
  }) satisfies EntryResult;

/** Settled, thin, single-vote and untouched — the four states the header can show. */
const settled = entry({
  id: 1,
  entryName: 'Bourbon Pecan Pie',
  voteCount: 6,
  overall: 4.32,
  rank: 1,
  criteria: [{ criterionId: 1, average: 4.3, distribution: distribution({ 4: 4, 5: 2 }) }],
});
const thin = entry({ id: 2, entryName: 'Pavlova', voteCount: 3, overall: 4.0, rank: 2 });
const single = entry({ id: 3, entryName: 'Brownies', voteCount: 1, overall: 5.0, rank: 3 });
const untouched = entry({ id: 4, entryName: 'Mulled Cider', voteCount: 0, overall: 0, rank: 4 });

const results: CategoryResults[] = [
  {
    category: {
      id: 'dessert',
      name: 'Desserts',
      emoji: '🍰',
      description: '',
      sortOrder: 1,
      isActive: true,
    },
    criteria: [
      {
        id: 1,
        categoryId: 'dessert',
        slug: 'flavor',
        name: 'Flavor',
        helpText: '',
        weight: 1,
        sortOrder: 1,
        isActive: true,
      },
    ],
    entries: [settled, thin, single, untouched],
  },
];

function renderTab(categories: CategoryResults[] = results) {
  const onDeleteEntry = vi.fn();
  return {
    ...render(<ResultsTab results={categories} onDeleteEntry={onDeleteEntry} />),
    onDeleteEntry,
  };
}

/** The accordion header for one entry, found by the name its aria-label starts with. */
function header(name: string) {
  return screen.getByRole('button', { name: new RegExp(`^${name},`) });
}

describe('ResultsTab', () => {
  it('starts every card collapsed, so the tab opens as a scoreboard', () => {
    renderTab();
    expect(screen.getAllByRole('button', { name: /,/ })).toHaveLength(4);
    // The expensive half of each card is not mounted at all.
    expect(screen.queryByText('Flavor')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete entry/ })).not.toBeInTheDocument();
    expect(header('Bourbon Pecan Pie')).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens only the card whose header was tapped', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(header('Bourbon Pecan Pie'));
    expect(header('Bourbon Pecan Pie')).toHaveAttribute('aria-expanded', 'true');
    expect(header('Pavlova')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('button', { name: /Delete entry/ })).toHaveLength(1);

    await user.click(header('Bourbon Pecan Pie'));
    expect(header('Bourbon Pecan Pie')).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the contestant name, which only the old header carried', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(header('Bourbon Pecan Pie'));
    expect(screen.getByText(/by Sam/)).toBeInTheDocument();
  });

  it('flags a score built on fewer than five votes', () => {
    renderTab();
    expect(within(header('Pavlova')).getByText(/3 votes/)).toBeInTheDocument();
    expect(header('Pavlova').querySelector('svg.lucide-triangle-alert')).not.toBeNull();
  });

  it('leaves a score with enough votes unflagged', () => {
    renderTab();
    expect(within(header('Bourbon Pecan Pie')).getByText(/6 votes/)).toBeInTheDocument();
    expect(header('Bourbon Pecan Pie').querySelector('svg.lucide-triangle-alert')).toBeNull();
  });

  it('explains the thin score once the card is open', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(header('Pavlova'));
    expect(screen.getByText(/Only 3 votes counted so far/)).toBeInTheDocument();
  });

  it('shows an unrated entry as having no score rather than a score of zero', () => {
    renderTab();
    const row = header('Mulled Cider');
    expect(within(row).getByText('No votes')).toBeInTheDocument();
    // Both the rank badge and the score read as absent, not as zero.
    expect(within(row).getAllByText('—')).toHaveLength(2);
    expect(within(row).queryByText('0.00')).not.toBeInTheDocument();
    // Not rated is not the same as thinly rated, so it must not wear the warning.
    expect(row.querySelector('svg.lucide-triangle-alert')).toBeNull();
  });

  it('withholds the rank from an entry nobody has rated', () => {
    renderTab();
    // rankEntries gives every unrated entry rank 1; showing it would be a fake standing.
    expect(header('Mulled Cider')).toHaveAccessibleName('Mulled Cider, no votes yet');
    expect(header('Bourbon Pecan Pie')).toHaveAccessibleName(
      'Bourbon Pecan Pie, rank 1, score 4.32, 6 votes',
    );
  });

  it('reads — for a criterion nobody rated, not 0.0', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(header('Mulled Cider'));
    const bar = screen.getByText('Flavor').closest('div')!;
    expect(within(bar).getByText('—')).toBeInTheDocument();
  });

  it('expands and collapses every card at once', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getAllByRole('button', { name: /Delete entry/ })).toHaveLength(4);

    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.queryByRole('button', { name: /Delete entry/ })).not.toBeInTheDocument();
  });

  it('offers no expand-all when there is nothing to expand', () => {
    renderTab([{ ...results[0]!, entries: [] }]);
    expect(screen.queryByRole('button', { name: /Expand all/ })).not.toBeInTheDocument();
    expect(screen.getByText('No entries in this category.')).toBeInTheDocument();
  });
});
