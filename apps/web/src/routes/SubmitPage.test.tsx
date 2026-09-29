import type { ContestConfig, GuestName, SessionGuest } from '@contest/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast.tsx';
import { SubmitPage } from './SubmitPage.tsx';

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

afterEach(() => {
  contest.settings.submissionsOpen = true;
  contest.settings.submissionsOpenAt = null;
});

describe('SubmitPage', () => {
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
