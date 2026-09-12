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
let voterState: VoterState;

function resetVoterState() {
  voterState = {
    votes: {
      '1': { scores: { '1': 4, '2': 5 }, comment: '', tasted: true },
      '2': { scores: {}, comment: '', tasted: true },
    },
    ballots: {},
  };
}

const saveVote = vi.fn<(entryId: number, input: UpsertVote) => Promise<VoterVote>>();

/**
 * Stands in for the server's merge: only the keys present in the request change,
 * and a star implies tasted. Returning a bare empty vote instead (as this mock
 * once did) means no entry can ever reach "fully rated".
 */
function mergeVote(entryId: number, input: UpsertVote): VoterVote {
  const current = voterState.votes[String(entryId)] ?? { scores: {}, comment: '', tasted: false };
  const scores = { ...current.scores };
  for (const [key, rating] of Object.entries(input.scores ?? {})) {
    if (rating === null) delete scores[key];
    else scores[key] = rating;
  }
  return {
    scores,
    comment: input.comment ?? current.comment,
    tasted: input.tasted ?? (current.tasted || Object.keys(input.scores ?? {}).length > 0),
  };
}

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

/** Entries that are shown collapsed rather than open for rating. */
function collapsedEntryNames(): string[] {
  return screen
    .getAllByRole('article')
    .filter((card) => within(card).queryByRole('button', { name: /^Edit/ }) !== null)
    .map((card) => within(card).getByRole('heading', { level: 3 }).textContent ?? '');
}

beforeEach(() => {
  // The toggle is persisted now, so a stale key would leak into the next test.
  localStorage.clear();
  localStorage.setItem('contest.voterName', JSON.stringify('Ada'));
  resetVoterState();
  saveVote.mockReset();
  saveVote.mockImplementation((entryId, input) => Promise.resolve(mergeVote(entryId, input)));
});

describe('VotePage', () => {
  it('shows every entry until the toggle is turned on', async () => {
    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));
    expect(visibleEntryNames()).toEqual(['Trifle', 'Pavlova', 'Brownies']);
  });

  it('starts a fully rated entry collapsed and everything else open', async () => {
    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));

    // Ada has rated every criterion on Trifle and nothing else.
    expect(collapsedEntryNames()).toEqual(['Trifle']);
    // Only the two open cards mount their stars.
    expect(screen.getAllByRole('group', { name: 'Appearance' })).toHaveLength(2);
  });

  it('reopens a collapsed entry for editing', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(collapsedEntryNames()).toEqual(['Trifle']));

    await user.click(screen.getByRole('button', { name: 'Edit Trifle' }));
    await waitFor(() => expect(collapsedEntryNames()).toEqual([]));
  });

  it('does not collapse a card the moment its last criterion is rated', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));

    // Pavlova is tasted with no stars; rating both criteria completes it.
    const pavlova = screen
      .getAllByRole('article')
      .find((card) => within(card).getByRole('heading', { level: 3 }).textContent === 'Pavlova')!;
    await user.click(within(pavlova).getByRole('group', { name: 'Appearance' }).children[3]!);
    await user.click(within(pavlova).getByRole('group', { name: 'Flavor' }).children[4]!);

    await waitFor(() => expect(saveVote).toHaveBeenCalledTimes(2));
    expect(collapsedEntryNames()).toEqual(['Trifle']);
  });

  it('collapses and expands every card at once', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(collapsedEntryNames()).toEqual(['Trifle']));

    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    await waitFor(() => expect(collapsedEntryNames()).toEqual(['Trifle', 'Pavlova', 'Brownies']));

    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    await waitFor(() => expect(collapsedEntryNames()).toEqual([]));
  });

  it('narrows to what the voter still owes', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));

    // Trifle is done; Pavlova is tasted but unrated and Brownies untouched.
    await user.click(screen.getByRole('button', { name: /Only what/ }));
    await waitFor(() => expect(visibleEntryNames()).toEqual(['Pavlova', 'Brownies']));
  });

  it('remembers the toggle across a reload', async () => {
    const user = userEvent.setup();
    const first = renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));
    await user.click(screen.getByRole('button', { name: /Only what/ }));
    await waitFor(() => expect(visibleEntryNames()).toEqual(['Pavlova', 'Brownies']));
    first.unmount();

    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toEqual(['Pavlova', 'Brownies']));
  });

  it('explains an empty result rather than showing a bare page', async () => {
    const user = userEvent.setup();
    // Everything already tasted and fully rated.
    voterState = {
      votes: {
        '1': { scores: { '1': 4, '2': 5 }, comment: '', tasted: true },
        '2': { scores: { '1': 3, '2': 3 }, comment: '', tasted: true },
        '3': { scores: { '1': 5, '2': 4 }, comment: '', tasted: true },
      },
      ballots: {},
    };
    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));

    await user.click(screen.getByRole('button', { name: /Only what/ }));
    await waitFor(() => expect(screen.getByText('You are all caught up')).toBeInTheDocument());
  });

  it('sends a bare tasted flag, with no scores, when the status box is tapped', async () => {
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
