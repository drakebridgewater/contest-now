import type { ContestConfig, GuestName, SessionGuest } from '@contest/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast.tsx';
import { SubmitPage } from './SubmitPage.tsx';

const contest: ContestConfig = {
  settings: {
    eventName: 'Party',
    tagline: '',
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
      kind: 'tasting',
      noun: '',
      sortOrder: 1,
      isActive: true,
    },
  ],
  criteria: [],
  awards: [],
};

vi.mock('../lib/api.ts', () => ({
  api: {
    getContest: () => Promise.resolve(contest),
    me: () => Promise.resolve(null as SessionGuest | null),
    guestNames: () => Promise.resolve([] as GuestName[]),
  },
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <SubmitPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const dessert = contest.categories[0]!;

afterEach(() => {
  contest.categories = [dessert];
  contest.settings.submissionsOpen = true;
  contest.settings.submissionsOpenAt = null;
});

const costumes = {
  id: 'costume',
  name: 'Costumes',
  emoji: '🎃',
  description: '',
  kind: 'showcase' as const,
  noun: 'costume',
  sortOrder: 2,
  isActive: true,
};

describe('SubmitPage', () => {
  it('skips the category picker when there is only one category', async () => {
    renderPage();
    expect(await screen.findByLabelText('Entry name')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Category' })).not.toBeInTheDocument();
    expect(screen.getByText(/whole dish/)).toBeInTheDocument();
  });

  it('asks for no allergens in a costume-only contest, and talks about costumes', async () => {
    contest.categories = [costumes];
    renderPage();
    expect(await screen.findByLabelText('Entry name')).toBeInTheDocument();
    expect(screen.getByText(/The Headless Horseman/)).toBeInTheDocument();
    expect(screen.getByText(/whole costume/)).toBeInTheDocument();
    expect(screen.queryByText(/allergen/i)).not.toBeInTheDocument();
  });

  it('offers allergens once a food category is picked, and not for costumes', async () => {
    const user = userEvent.setup();
    contest.categories = [dessert, costumes];
    renderPage();
    const picker = await screen.findByRole('group', { name: 'Category' });
    await user.click(within(picker).getByRole('button', { name: /Costumes/ }));
    expect(screen.queryByText(/Tap everything your dish contains/)).not.toBeInTheDocument();
    await user.click(within(picker).getByRole('button', { name: /Desserts/ }));
    expect(screen.getByText(/Tap everything your dish contains/)).toBeInTheDocument();
  });

  it('shows the form while entries are open', async () => {
    renderPage();
    expect(await screen.findByLabelText('Entry name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit entry/ })).toBeEnabled();
  });

  it('shows only a countdown before entries open', async () => {
    contest.settings.submissionsOpenAt = new Date(Date.now() + 90 * 60 * 1000).toISOString();
    renderPage();
    await waitFor(() => expect(screen.getByText(/Entries open at/)).toBeInTheDocument());
    expect(screen.queryByLabelText('Entry name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Submit entry/ })).not.toBeInTheDocument();
  });

  it('shows only the notice while entries are closed', async () => {
    contest.settings.submissionsOpen = false;
    renderPage();
    await waitFor(() => expect(screen.getByText(/Submissions are closed/)).toBeInTheDocument());
    expect(screen.queryByLabelText('Entry name')).not.toBeInTheDocument();
  });
});
