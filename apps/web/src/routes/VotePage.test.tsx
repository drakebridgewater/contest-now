import type { ContestConfig, Entry, UpsertVote, VoterState, VoterVote } from '@contest/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast.tsx';
import { VotePage } from './VotePage.tsx';

const criterion = (id: number, name: string) => ({
  id,
  categoryId: 'dessert',
  slug: name.toLowerCase(),
  name,
  helpText: '',
  weight: 1,
  sortOrder: id,
  isActive: true,
});

const contest: ContestConfig = {
  settings: {
    eventName: 'Party',
    tagline: '',
    photoShareUrl: '',
    votingOpen: true,
  },
  categories: [
    { id: 'dessert', name: 'Desserts', emoji: '🍰', description: '', sortOrder: 1, isActive: true },
  ],
  criteria: [criterion(1, 'Appearance'), criterion(2, 'Flavor')],
  awards: [],
};

const entry = (id: number, entryName: string): Entry => ({
  id,
  entryName,
  contestantName: 'Sam',
  categoryId: 'dessert',
  photoUrl: `/uploads/${id}.webp`,
  allergens: [],
  createdAt: new Date().toISOString(),
});

const entries = [entry(1, 'Trifle'), entry(2, 'Pavlova'), entry(3, 'Brownies')];

/** The voter has fully rated Trifle, tasted Pavlova, and not touched Brownies. */
const voterState: VoterState = {
  votes: {
    '1': { scores: { '1': 4, '2': 5 }, comment: '', tasted: true },
    '2': { scores: {}, comment: '', tasted: true },
  },
  ballots: {},
};

const saveVote = vi.fn<(entryId: number, input: UpsertVote) => Promise<VoterVote>>();

vi.mock('../lib/api.ts', () => ({
  api: {
    getContest: () => Promise.resolve(contest),
    getEntries: () => Promise.resolve(entries),
    getVoterState: () => Promise.resolve(voterState),
    saveVote: (entryId: number, input: UpsertVote) => saveVote(entryId, input),
  },
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <VotePage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** The entry names currently rendered as cards. */
function visibleEntryNames(): string[] {
  return screen
    .getAllByRole('article')
    .map((card) => within(card).getByRole('heading', { level: 3 }).textContent ?? '');
}

/** Scoped to the Show row: a card's status badge can carry the same wording. */
async function chooseFilter(user: ReturnType<typeof userEvent.setup>, label: string) {
  const group = screen.getByRole('group', { name: 'Show' });
  await user.click(within(group).getByRole('button', { name: label }));
}

beforeEach(() => {
  localStorage.setItem('contest.voterName', JSON.stringify('Ada'));
  saveVote.mockReset();
  saveVote.mockResolvedValue({ scores: {}, comment: '', tasted: true });
});

describe('VotePage tasting filter', () => {
  it('shows every entry until a filter is chosen', async () => {
    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));
    expect(visibleEntryNames()).toEqual(['Trifle', 'Pavlova', 'Brownies']);
  });

  it('narrows to what the voter has not tasted', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));

    await chooseFilter(user, 'Not tasted');
    await waitFor(() => expect(visibleEntryNames()).toEqual(['Brownies']));
  });

  it('narrows to what the voter has tasted', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));

    await chooseFilter(user, 'Tasted');
    await waitFor(() => expect(visibleEntryNames()).toEqual(['Trifle', 'Pavlova']));
  });

  it('keeps "Not rated" separate from tasting: a tasted entry can still need stars', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));

    await chooseFilter(user, 'Not rated');
    await waitFor(() => expect(visibleEntryNames()).toEqual(['Pavlova', 'Brownies']));
  });

  it('explains an empty result rather than showing a bare page', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));

    await chooseFilter(user, 'Not tasted');
    await waitFor(() => expect(visibleEntryNames()).toEqual(['Brownies']));

    // Mark the last untasted entry; nothing is left under this filter.
    await user.click(screen.getByRole('button', { name: 'Mark as tasted' }));
    await waitFor(() =>
      expect(screen.getByText('You have tasted everything here')).toBeInTheDocument(),
    );
  });

  it('sends a bare tasted flag, with no scores, when the toggle is tapped', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));

    await user.click(screen.getByRole('button', { name: 'Mark as tasted' }));
    await waitFor(() => expect(saveVote).toHaveBeenCalledTimes(1));
    expect(saveVote).toHaveBeenCalledWith(3, { voterName: 'Ada', tasted: true });
  });

  it('counts tasted entries in the progress line', async () => {
    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));
    expect(screen.getByText(/2 of 3 tasted/)).toBeInTheDocument();
  });
});
