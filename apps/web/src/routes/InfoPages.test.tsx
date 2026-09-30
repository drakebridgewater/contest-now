import type { ContestConfig, RsvpSummary } from '@contest/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../lib/api.ts';
import { DetailsPage } from './DetailsPage.tsx';
import { FaqPage } from './FaqPage.tsx';

const contest: ContestConfig = {
  settings: {
    eventName: 'PDXmas',
    tagline: '',
    photoShareUrl: '',
    location: 'Matt & Mar’s Home',
    startsAt: '2026-12-19T18:00:00.000Z',
    faqs: [{ question: 'When are the winners announced?', answer: 'Around 8–9 pm.' }],
    knownAllergies: ['cashews', 'fish'],
    votingOpen: true,
    votingOpensAt: null,
    submissionsOpen: true,
    submissionsOpenAt: null,
  },
  categories: [],
  criteria: [],
  awards: [],
};

const summary: RsvpSummary = {
  yes: 2,
  maybe: 0,
  no: 0,
  pending: 0,
  plusOnes: 0,
  headcount: 2,
  preregistered: {},
  allergies: ['fish', 'lentils'],
};

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getContest: () => Promise.resolve(contest),
      rsvpSummary: () => Promise.resolve(summary),
    },
  };
});

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/details" element={<DetailsPage />} />
          <Route path="/faq" element={<FaqPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('info pages', () => {
  it('shows the location, start time and the host’s and guests’ allergies once each', async () => {
    renderAt('/details');
    expect(await screen.findByText('Matt & Mar’s Home')).toBeInTheDocument();
    expect(screen.getByText(/December 19/)).toBeInTheDocument();
    expect(await screen.findByText('Lentils')).toBeInTheDocument();
    expect(screen.getByText('Fish')).toBeInTheDocument();
    expect(screen.getByText('Cashews')).toBeInTheDocument();
  });

  it('switches to the FAQ and reveals an answer', async () => {
    const user = userEvent.setup();
    renderAt('/details');
    await user.click(screen.getByRole('link', { name: 'FAQ' }));
    await user.click(await screen.findByText('When are the winners announced?'));
    expect(screen.getByText('Around 8–9 pm.')).toBeVisible();
  });
});
