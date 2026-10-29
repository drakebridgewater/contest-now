import type { AwardResults, Entry } from '@contest/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AwardsTab } from './AwardsTab.tsx';
import type { Prize } from './prizes.ts';

const entry = (id: number, entryName: string, contestantName: string): Entry => ({
  id,
  entryName,
  contestantName,
  categoryId: 'dessert',
  photoUrl: `/uploads/${id}.webp`,
  allergens: [],
  createdAt: new Date().toISOString(),
});

const pie = entry(1, 'Pecan Pie', 'Sam');
const cake = entry(2, 'Carrot Cake', 'Ann');

const award = (chosenWinnerEntryId: number | null): AwardResults => ({
  award: {
    id: 'best-presented',
    name: 'Best Presented',
    emoji: '🎨',
    description: '',
    sortOrder: 1,
    isActive: true,
    categoryIds: [],
  },
  totalBallots: 5,
  tally: [
    { entry: pie, count: 3 },
    { entry: cake, count: 2 },
  ],
  winnerEntryIds: [1],
  chosenWinnerEntryId,
});

const prize = (key: string, name: string, winner: Entry | null): Prize => ({
  key,
  kind: key.startsWith('award:') ? 'award' : 'category',
  id: key.split(':')[1]!,
  name,
  emoji: '🏆',
  winner,
});

describe('AwardsTab', () => {
  it('picks the runner-up when the leader already won elsewhere', async () => {
    const user = userEvent.setup();
    const onSetWinner = vi.fn();
    render(
      <AwardsTab
        awards={[award(null)]}
        prizes={[
          prize('category:dessert', 'Desserts', pie),
          prize('award:best-presented', 'Best Presented', null),
        ]}
        onSetWinner={onSetWinner}
      />,
    );
    // The leader's row says Sam already has a prize.
    const pieRow = screen
      .getByRole('button', { name: 'Pecan Pie wins Best Presented' })
      .closest('li')!;
    expect(within(pieRow).getByText('Won Desserts')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Carrot Cake wins Best Presented' }));
    expect(onSetWinner).toHaveBeenCalledWith('best-presented', 2);
  });

  it('shows the pick, toggles it off, and lists every prize for announcing', async () => {
    const user = userEvent.setup();
    const onSetWinner = vi.fn();
    render(
      <AwardsTab
        awards={[award(2)]}
        prizes={[
          prize('category:dessert', 'Desserts', pie),
          prize('category:cocktail', 'Cocktails', null),
          prize('award:best-presented', 'Best Presented', cake),
        ]}
        onSetWinner={onSetWinner}
      />,
    );
    expect(screen.getByText('2 of 3 picked.', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Not picked yet')).toBeInTheDocument();

    const picked = screen.getByRole('button', { name: 'Carrot Cake wins Best Presented' });
    expect(picked).toHaveAttribute('aria-pressed', 'true');
    await user.click(picked);
    expect(onSetWinner).toHaveBeenCalledWith('best-presented', null);
  });

  it('warns in the winners list when one guest is picked twice', () => {
    render(
      <AwardsTab
        awards={[award(1)]}
        prizes={[
          prize('category:dessert', 'Desserts', pie),
          prize('award:best-presented', 'Best Presented', pie),
        ]}
        onSetWinner={vi.fn()}
      />,
    );
    expect(screen.getByText('Also won Best Presented')).toBeInTheDocument();
    expect(screen.getByText('Also won Desserts')).toBeInTheDocument();
  });
});
