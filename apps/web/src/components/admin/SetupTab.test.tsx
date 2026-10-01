import type { ContestConfig } from '@contest/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SetupTab, type SetupActions } from './SetupTab.tsx';

const config: ContestConfig = {
  settings: {
    eventName: 'PDXmas',
    tagline: 'Food & drink',
    photoShareUrl: '',
    location: '',
    startsAt: null,
    faqs: [],
    schedule: [],
    knownAllergies: [],
    votingOpen: true,
    votingOpensAt: null,
    submissionsOpen: true,
    submissionsOpenAt: null,
  },
  categories: [
    {
      id: 'dessert',
      name: 'Desserts',
      emoji: '🍰',
      description: '',
      sortOrder: 10,
      isActive: true,
    },
    {
      id: 'cocktail',
      name: 'Cocktails',
      emoji: '🍹',
      description: '',
      sortOrder: 20,
      isActive: true,
    },
  ],
  criteria: [
    {
      id: 1,
      categoryId: 'dessert',
      slug: 'flavor',
      name: 'Flavor',
      helpText: 'Taste',
      weight: 1,
      sortOrder: 10,
      isActive: true,
    },
  ],
  awards: [
    {
      id: 'best-presented',
      name: 'Best Presented',
      emoji: '🎨',
      description: '',
      categoryIds: [],
      sortOrder: 10,
      isActive: true,
    },
  ],
};

function renderSetup(hasRatings = false) {
  const actions: SetupActions = {
    saveSettings: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    createCriterion: vi.fn(),
    updateCriterion: vi.fn(),
    deleteCriterion: vi.fn(),
    createAward: vi.fn(),
    updateAward: vi.fn(),
    deleteAward: vi.fn(),
  };
  render(<SetupTab config={config} hasRatings={hasRatings} actions={actions} />);
  return actions;
}

describe('SetupTab', () => {
  it('adds a category by name and emoji', async () => {
    const user = userEvent.setup();
    const actions = renderSetup();
    await user.type(screen.getByLabelText('Category emoji'), '🍖');
    await user.type(screen.getByLabelText('Category name'), 'Main dishes');
    await user.click(screen.getByRole('button', { name: /^Add$/ }));
    expect(actions.createCategory).toHaveBeenCalledWith('Main dishes', '🍖');
  });

  it('adds a criterion to the category it belongs to', async () => {
    const user = userEvent.setup();
    const actions = renderSetup();
    await user.type(screen.getByLabelText('New criterion name for Cocktails'), 'Balance');
    await user.type(
      screen.getByLabelText('New criterion help text for Cocktails'),
      'Sweet vs sour',
    );
    await user.click(screen.getAllByRole('button', { name: /Add criterion/ })[1]!);
    expect(actions.createCriterion).toHaveBeenCalledWith('cocktail', 'Balance', 'Sweet vs sour');
  });

  it('adds an award with the selected category scope', async () => {
    const user = userEvent.setup();
    const actions = renderSetup();
    await user.type(screen.getByLabelText('Award name'), 'Most Festive');
    await user.type(screen.getByLabelText('Award description'), 'Christmassy');
    await user.click(screen.getByRole('button', { name: 'Desserts', pressed: false }));
    await user.click(screen.getByRole('button', { name: /Add award/ }));
    expect(actions.createAward).toHaveBeenCalledWith('Most Festive', '', 'Christmassy', [
      'dessert',
    ]);
  });

  it('hides rather than deletes when asked', async () => {
    const user = userEvent.setup();
    const actions = renderSetup();
    await user.click(screen.getAllByRole('button', { name: 'Hide' })[0]!);
    expect(actions.updateCategory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'dessert' }),
      { isActive: false },
    );
  });

  it('warns about adding criteria only once people have rated', () => {
    const { unmount } = render(
      <SetupTab config={config} hasRatings={false} actions={renderSetupActions()} />,
    );
    expect(screen.queryByText(/part-finished/)).not.toBeInTheDocument();
    unmount();

    render(<SetupTab config={config} hasRatings actions={renderSetupActions()} />);
    expect(screen.getAllByText(/part-finished/).length).toBeGreaterThan(0);
  });

  it('saves event details only after something changes', async () => {
    const user = userEvent.setup();
    const actions = renderSetup();
    const save = screen.getByRole('button', { name: /Save event details/ });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText('Event name'), ' 2026');
    expect(save).toBeEnabled();
    await user.click(save);
    expect(actions.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'PDXmas 2026' }),
    );
  });

  describe('event info', () => {
    it('saves the location with the event details', async () => {
      const user = userEvent.setup();
      const actions = renderSetup();
      await user.type(screen.getByLabelText('Location'), '123 Elm St');
      await user.click(screen.getByRole('button', { name: 'Save event details' }));
      expect(actions.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ location: '123 Elm St' }),
      );
    });

    it('saves the host’s known allergies', async () => {
      const user = userEvent.setup();
      const actions = renderSetup();
      const save = screen.getByRole('button', { name: 'Save allergies' });
      expect(save).toBeDisabled();
      await user.click(screen.getByRole('button', { name: 'Dairy' }));
      await user.click(save);
      expect(actions.saveSettings).toHaveBeenCalledWith({ knownAllergies: ['dairy'] });
    });

    it('adds a FAQ and saves it only once it has an answer', async () => {
      const user = userEvent.setup();
      const actions = renderSetup();
      const save = screen.getByRole('button', { name: 'Save FAQ' });
      await user.click(screen.getByRole('button', { name: 'Add question' }));
      await user.type(screen.getByLabelText('Question'), ' Parking? ');
      expect(save).toBeDisabled();
      await user.type(screen.getByLabelText('Answer'), 'On the street.');
      await user.click(save);
      expect(actions.saveSettings).toHaveBeenCalledWith({
        faqs: [{ question: 'Parking?', answer: 'On the street.' }],
      });
    });
  });
});

function renderSetupActions(): SetupActions {
  return {
    saveSettings: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    createCriterion: vi.fn(),
    updateCriterion: vi.fn(),
    deleteCriterion: vi.fn(),
    createAward: vi.fn(),
    updateAward: vi.fn(),
    deleteAward: vi.fn(),
  };
}
