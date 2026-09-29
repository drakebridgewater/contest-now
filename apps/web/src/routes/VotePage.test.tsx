import type {
  ContestConfig,
  Entry,
  SessionGuest,
  UpsertVote,
  VoterState,
  VoterVote,
} from '@contest/shared';
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
    votingOpensAt: null,
    submissionsOpen: true,
    submissionsOpenAt: null,
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

let me: SessionGuest | null;

vi.mock('../lib/api.ts', () => ({
  api: {
    me: () => Promise.resolve(me),
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

/** A card's entry name: the article is labelled by it. */
function nameOf(card: HTMLElement): string {
  return document.getElementById(card.getAttribute('aria-labelledby') ?? '')?.textContent ?? '';
}

/** The entry names currently rendered as cards. */
function visibleEntryNames(): string[] {
  return screen.queryAllByRole('article').map(nameOf);
}

/** Entries whose card is open for rating. */
function openEntryNames(): string[] {
  return screen
    .getAllByRole('article')
    .filter(
      (card) => within(card).getAllByRole('button')[0]!.getAttribute('aria-expanded') === 'true',
    )
    .map(nameOf);
}

function card(name: string): HTMLElement {
  return screen.getAllByRole('article').find((c) => nameOf(c) === name)!;
}

beforeEach(() => {
  // The toggle is persisted now, so a stale key would leak into the next test.
  localStorage.clear();
  me = { id: 'g-ada', name: 'Ada', scope: 'vote', allergies: [] };
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

  it('starts every card collapsed, finished or not', async () => {
    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));
    expect(openEntryNames()).toEqual([]);
    // Closed cards do not mount their stars.
    expect(screen.queryAllByRole('group', { name: 'Appearance' })).toHaveLength(0);
    // Each closed row still says where the voter stands.
    expect(within(card('Trifle')).getByText(/Scored: 4\.5/)).toBeInTheDocument();
    expect(within(card('Pavlova')).getByText('Tasted')).toBeInTheDocument();
    expect(within(card('Brownies')).getByText('Not tasted')).toBeInTheDocument();
  });

  it('opens and closes a card by tapping its header', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));

    await user.click(within(card('Trifle')).getAllByRole('button')[0]!);
    await waitFor(() => expect(openEntryNames()).toEqual(['Trifle']));
    await user.click(within(card('Trifle')).getAllByRole('button')[0]!);
    await waitFor(() => expect(openEntryNames()).toEqual([]));
  });

  it('does not close a card the moment its last criterion is rated', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));

    await user.click(within(card('Pavlova')).getAllByRole('button')[0]!);
    // Pavlova is tasted with no stars; rating both criteria completes it.
    await user.click(
      within(card('Pavlova')).getByRole('group', { name: 'Appearance' }).children[3]!,
    );
    await user.click(within(card('Pavlova')).getByRole('group', { name: 'Flavor' }).children[4]!);

    await waitFor(() => expect(saveVote).toHaveBeenCalledTimes(2));
    expect(openEntryNames()).toEqual(['Pavlova']);
  });

  it('expands and collapses every card at once', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));

    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    await waitFor(() => expect(openEntryNames()).toEqual(['Trifle', 'Pavlova', 'Brownies']));

    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    await waitFor(() => expect(openEntryNames()).toEqual([]));
  });

  it('switches open cards to the medium layout and remembers it', async () => {
    const user = userEvent.setup();
    const first = renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));
    await user.click(screen.getByRole('button', { name: 'Medium cards' }));
    await user.click(within(card('Brownies')).getAllByRole('button')[0]!);
    expect(within(card('Brownies')).getByLabelText('Flavor').tagName).toBe('SELECT');
    first.unmount();

    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));
    expect(screen.getByRole('button', { name: 'Medium cards' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('hides entries with the voter’s allergens until asked, then warns on them', async () => {
    const user = userEvent.setup();
    me = { id: 'g-ada', name: 'Ada', scope: 'vote', allergies: ['peanuts'] };
    entries[2] = { ...entries[2]!, allergens: ['peanuts', 'eggs'] };
    try {
      renderPage();
      await waitFor(() => expect(visibleEntryNames()).toEqual(['Trifle', 'Pavlova']));
      await user.click(screen.getByRole('button', { name: /Show 1 with your allergens/ }));
      await waitFor(() => expect(visibleEntryNames()).toEqual(['Trifle', 'Pavlova', 'Brownies']));
      expect(within(card('Brownies')).getByRole('note')).toHaveTextContent(
        /Contains Peanuts — on your allergy list/,
      );
    } finally {
      entries[2] = { ...entries[2]!, allergens: [] };
    }
  });

  it('asks for a name when signed out, and shows a countdown before voting opens', async () => {
    me = null;
    const opensAt = new Date(Date.now() + 42 * 60 * 1000).toISOString();
    contest.settings.votingOpensAt = opensAt;
    try {
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /What.s your name/ })).toBeInTheDocument(),
      );
      expect(screen.getByText(/Voting opens at/).closest('[role="status"]')).toHaveTextContent(
        /in 42 min/,
      );
    } finally {
      contest.settings.votingOpensAt = null;
    }
  });

  it('shows a signed-in voter only the countdown until voting opens', async () => {
    contest.settings.votingOpensAt = new Date(Date.now() + 42 * 60 * 1000).toISOString();
    try {
      renderPage();
      await waitFor(() => expect(screen.getByText(/Voting opens at/)).toBeInTheDocument());
      expect(screen.getByText('Ada')).toBeInTheDocument();
      expect(screen.queryAllByRole('article')).toHaveLength(0);
      expect(screen.queryByRole('button', { name: /Only what/ })).not.toBeInTheDocument();
      expect(screen.queryByText('Special awards')).not.toBeInTheDocument();
    } finally {
      contest.settings.votingOpensAt = null;
    }
  });

  it('hides the cards once voting is closed', async () => {
    contest.settings.votingOpen = false;
    try {
      renderPage();
      await waitFor(() => expect(screen.getByText(/Voting is closed/)).toBeInTheDocument());
      expect(screen.queryAllByRole('article')).toHaveLength(0);
    } finally {
      contest.settings.votingOpen = true;
    }
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

    await user.click(within(card('Brownies')).getByRole('button', { name: /Tap to mark tasted/ }));
    await waitFor(() => expect(saveVote).toHaveBeenCalledTimes(1));
    expect(saveVote).toHaveBeenCalledWith(3, { tasted: true });
  });

  it('counts tasted entries in the progress line', async () => {
    renderPage();
    await waitFor(() => expect(visibleEntryNames()).toHaveLength(3));
    expect(screen.getByText(/2 of 3 tasted/)).toBeInTheDocument();
  });
});
