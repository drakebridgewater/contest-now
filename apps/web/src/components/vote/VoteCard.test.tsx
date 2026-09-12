import type { Criterion, Entry, VoterVote } from '@contest/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VoteCard } from './VoteCard.tsx';

const entry: Entry = {
  id: 7,
  entryName: 'Bourbon Pecan Pie',
  contestantName: 'Sam',
  categoryId: 'dessert',
  photoUrl: '/uploads/pie.webp',
  allergens: ['tree-nuts', 'gluten-free'],
  createdAt: new Date().toISOString(),
};

const criterion = (id: number, name: string): Criterion => ({
  id,
  categoryId: 'dessert',
  slug: name.toLowerCase(),
  name,
  helpText: `${name} help`,
  weight: 1,
  sortOrder: id,
  isActive: true,
});

const criteria = [criterion(1, 'Appearance'), criterion(2, 'Texture'), criterion(3, 'Flavor')];

const voted = (
  scores: Record<string, 1 | 2 | 3 | 4 | 5>,
  comment = '',
  tasted = true,
): VoterVote => ({ scores, comment, tasted });

function renderCard(props: Partial<Parameters<typeof VoteCard>[0]> = {}) {
  const onScoreChange = vi.fn();
  const onCommentChange = vi.fn();
  const onCommentFlush = vi.fn();
  const onTastedChange = vi.fn();
  const view = render(
    <VoteCard
      entry={entry}
      criteria={criteria}
      vote={undefined}
      onScoreChange={onScoreChange}
      onCommentChange={onCommentChange}
      onCommentFlush={onCommentFlush}
      onTastedChange={onTastedChange}
      {...props}
    />,
  );
  return { ...view, onScoreChange, onCommentChange, onCommentFlush, onTastedChange };
}

describe('VoteCard', () => {
  it('renders one star row per criterion, with its help text', () => {
    renderCard();
    for (const c of criteria) {
      expect(screen.getByRole('group', { name: c.name })).toBeInTheDocument();
      expect(screen.getByText(`${c.name} help`)).toBeInTheDocument();
    }
  });

  it('shows allergen and dietary labels', () => {
    renderCard();
    expect(screen.getByText(/Tree nuts/)).toBeInTheDocument();
    expect(screen.getByText('Gluten-free')).toBeInTheDocument();
  });

  it('reports progress and completion from the criteria of the category', () => {
    const { rerender } = render(
      <VoteCard
        entry={entry}
        criteria={criteria}
        vote={voted({ '1': 4 })}
        onScoreChange={vi.fn()}
        onCommentChange={vi.fn()}
        onCommentFlush={vi.fn()}
        onTastedChange={vi.fn()}
      />,
    );
    expect(screen.getByText('1 of 3')).toBeInTheDocument();

    rerender(
      <VoteCard
        entry={entry}
        criteria={criteria}
        vote={voted({ '1': 4, '2': 5, '3': 3 })}
        onScoreChange={vi.fn()}
        onCommentChange={vi.fn()}
        onCommentFlush={vi.fn()}
        onTastedChange={vi.fn()}
      />,
    );
    // Three weight-1 criteria at 4, 5 and 3: the voter's own weighted mean.
    expect(screen.getByText('4.0')).toBeInTheDocument();
  });

  it('sends the rating when a star is tapped', async () => {
    const user = userEvent.setup();
    const { onScoreChange } = renderCard();
    await user.click(screen.getAllByRole('button', { name: /^4 stars/ })[0]!);
    expect(onScoreChange).toHaveBeenCalledWith(1, 4);
  });

  it('clears the rating when the chosen star is tapped again', async () => {
    const user = userEvent.setup();
    const { onScoreChange } = renderCard({ vote: voted({ '1': 4 }) });
    await user.click(screen.getByRole('button', { name: /^4 stars \(tap to clear\)/ }));
    expect(onScoreChange).toHaveBeenCalledWith(1, null);
  });

  it('flushes the comment on blur rather than on every keystroke', async () => {
    const user = userEvent.setup();
    const { onCommentChange, onCommentFlush } = renderCard();
    await user.click(screen.getByRole('button', { name: /^Add a comment/ }));
    const box = screen.getByLabelText(/Comment/);
    await user.click(box);
    await user.keyboard('Yum');
    expect(onCommentChange).toHaveBeenCalled();
    expect(onCommentFlush).not.toHaveBeenCalled();
    await user.tab();
    expect(onCommentFlush).toHaveBeenCalledTimes(1);
  });

  it('disables rating when voting is closed', () => {
    renderCard({ disabled: true });
    expect(screen.getAllByRole('button', { name: /^3 stars/ })[0]!).toBeDisabled();
  });

  it('offers to mark an untasted entry, and reports one that is tasted', () => {
    const { unmount } = render(
      <VoteCard
        entry={entry}
        criteria={criteria}
        vote={undefined}
        onScoreChange={vi.fn()}
        onCommentChange={vi.fn()}
        onCommentFlush={vi.fn()}
        onTastedChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Mark as tasted' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    unmount();

    renderCard({ vote: voted({}, '', true) });
    expect(screen.getByRole('button', { name: 'Tasted' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles tasted both ways', async () => {
    const user = userEvent.setup();
    const { onTastedChange, unmount } = renderCard();
    await user.click(screen.getByRole('button', { name: 'Mark as tasted' }));
    expect(onTastedChange).toHaveBeenCalledWith(true);
    unmount();

    const second = renderCard({ vote: voted({}, '', true) });
    await user.click(screen.getByRole('button', { name: 'Tasted' }));
    expect(second.onTastedChange).toHaveBeenCalledWith(false);
  });

  it('disables the tasted toggle when voting is closed', () => {
    renderCard({ disabled: true });
    expect(screen.getByRole('button', { name: 'Mark as tasted' })).toBeDisabled();
  });

  it('keeps a comment that was already written visible, with nothing to tap', () => {
    renderCard({ vote: voted({}, 'Too much nutmeg') });
    expect(screen.getByLabelText(/Comment/)).toHaveValue('Too much nutmeg');
    expect(screen.queryByRole('button', { name: /^Add a comment/ })).not.toBeInTheDocument();
  });

  it('leaves the comment box in place once opened, even when emptied again', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: /^Add a comment/ }));
    await user.type(screen.getByLabelText(/Comment/), 'Yum');
    await user.clear(screen.getByLabelText(/Comment/));
    expect(screen.getByLabelText(/Comment/)).toBeInTheDocument();
  });

  it('collapses to a photo, a title, the score and a way back in', () => {
    renderCard({ vote: voted({ '1': 4, '2': 5, '3': 3 }), collapsed: true });

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Bourbon Pecan Pie');
    expect(screen.getByRole('img')).toHaveAttribute('src', '/uploads/pie.webp');
    expect(screen.getByText('4.0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Edit/ })).toBeInTheDocument();

    // The expensive half of the card is not mounted at all.
    expect(screen.queryByRole('group', { name: 'Appearance' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Comment/)).not.toBeInTheDocument();
  });

  it('names the collapse and expand controls after the entry', async () => {
    const user = userEvent.setup();
    const onCollapsedChange = vi.fn();
    const { rerender } = render(
      <VoteCard
        entry={entry}
        criteria={criteria}
        vote={voted({ '1': 4, '2': 5, '3': 3 })}
        collapsed={true}
        onCollapsedChange={onCollapsedChange}
        onScoreChange={vi.fn()}
        onCommentChange={vi.fn()}
        onCommentFlush={vi.fn()}
        onTastedChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Edit Bourbon Pecan Pie' }));
    expect(onCollapsedChange).toHaveBeenCalledWith(false);

    rerender(
      <VoteCard
        entry={entry}
        criteria={criteria}
        vote={voted({ '1': 4, '2': 5, '3': 3 })}
        collapsed={false}
        onCollapsedChange={onCollapsedChange}
        onScoreChange={vi.fn()}
        onCommentChange={vi.fn()}
        onCommentFlush={vi.fn()}
        onTastedChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Collapse Bourbon Pecan Pie' }));
    expect(onCollapsedChange).toHaveBeenLastCalledWith(true);
  });

  it('still reports the tasted state from the collapsed row', () => {
    renderCard({ vote: voted({}, '', true), collapsed: true });
    expect(screen.getByRole('button', { name: 'Tasted' })).toHaveAttribute('aria-pressed', 'true');
  });
});
