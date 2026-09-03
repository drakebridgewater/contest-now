import type { Award, Entry } from '@contest/shared';
import { render, screen, within, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AwardPicker } from './AwardPicker.tsx';

const entry = (id: number, entryName: string, categoryId: string): Entry => ({
  id,
  entryName,
  contestantName: 'Someone',
  categoryId,
  photoUrl: `/uploads/${id}.webp`,
  allergens: [],
  createdAt: new Date().toISOString(),
});

const entries = [
  entry(1, 'Pie', 'dessert'),
  entry(2, 'Negroni', 'cocktail'),
  entry(3, 'Dip', 'appetizer'),
];

const categoryNames = new Map([
  ['dessert', 'Desserts'],
  ['cocktail', 'Cocktails'],
  ['appetizer', 'Appetizers'],
]);

const award = (categoryIds: string[]): Award => ({
  id: 'most-festive',
  name: 'Most Festive',
  emoji: '🎄',
  description: 'The most Christmassy thing on the table',
  categoryIds,
  sortOrder: 10,
  isActive: true,
});

beforeAll(() => {
  // jsdom does not implement <dialog>.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

describe('AwardPicker', () => {
  it('offers only entries inside the award scope', async () => {
    const user = userEvent.setup();
    render(
      <AwardPicker
        award={award(['dessert'])}
        entries={entries}
        categoryNames={categoryNames}
        pickedEntryId={undefined}
        onPick={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Most Festive' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Choose an entry/ }));

    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Pie')).toBeInTheDocument();
    expect(within(sheet).queryByText('Negroni')).not.toBeInTheDocument();
    expect(within(sheet).queryByText('Dip')).not.toBeInTheDocument();
  });

  it('offers every entry when the scope is empty', async () => {
    const user = userEvent.setup();
    render(
      <AwardPicker
        award={award([])}
        entries={entries}
        categoryNames={categoryNames}
        pickedEntryId={undefined}
        onPick={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText('Any category')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Choose an entry/ }));
    const sheet = screen.getByRole('dialog');
    for (const name of ['Pie', 'Negroni', 'Dip']) {
      expect(within(sheet).getByText(name)).toBeInTheDocument();
    }
  });

  it('reports the chosen entry and allows changing or clearing it', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onClear = vi.fn();
    const view: RenderResult = render(
      <AwardPicker
        award={award([])}
        entries={entries}
        categoryNames={categoryNames}
        pickedEntryId={2}
        onPick={onPick}
        onClear={onClear}
      />,
    );
    // Scope to the card itself: the (closed) sheet also lists every entry.
    const card = view.container.firstElementChild as HTMLElement;
    const picked = within(card).getByText('Your pick').closest('div')!;
    expect(within(picked).getByText('Negroni')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change' }));
    await user.click(within(screen.getByRole('dialog')).getByText('Pie'));
    expect(onPick).toHaveBeenCalledWith(1);

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('explains when nothing is eligible yet', () => {
    render(
      <AwardPicker
        award={award(['side-dishes'])}
        entries={entries}
        categoryNames={categoryNames}
        pickedEntryId={undefined}
        onPick={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /No eligible entries yet/ })).toBeDisabled();
  });
});
