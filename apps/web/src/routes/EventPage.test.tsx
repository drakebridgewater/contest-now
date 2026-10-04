import type { ContestConfig, RsvpSummary, SessionGuest } from '@contest/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../lib/api.ts';
import { EventPage, ToEvent } from './EventPage.tsx';

const contest: ContestConfig = {
  settings: {
    eventName: 'PDXmas',
    tagline: '',
    photoShareUrl: '',
    location: 'Matt & Mar’s Home',
    startsAt: '2026-12-19T18:00:00.000Z',
    faqs: [{ question: 'When are the winners announced?', answer: 'Around 8–9 pm.' }],
    schedule: [{ at: '2026-12-19T20:30:00.000Z', title: 'Winners announced', details: 'Prizes!' }],
    knownAllergies: ['cashews', 'fish'],
    votingOpen: true,
    votingOpensAt: '2026-12-19T19:00:00.000Z',
    submissionsOpen: true,
    submissionsOpenAt: null,
  },
  categories: [
    {
      id: 'dessert',
      name: 'Holiday desserts',
      emoji: '🍰',
      description: 'Homemade only',
      kind: 'tasting',
      noun: '',
      sortOrder: 10,
      isActive: true,
    },
    {
      id: 'old',
      name: 'Retired',
      emoji: '',
      description: '',
      kind: 'tasting',
      noun: '',
      sortOrder: 20,
      isActive: false,
    },
  ],
  criteria: [],
  awards: [
    {
      id: 'best-presented',
      name: 'Best presented',
      emoji: '🎨',
      description: 'The prettiest plate',
      categoryIds: [],
      sortOrder: 10,
      isActive: true,
    },
  ],
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

let me: SessionGuest | null;

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getContest: () => Promise.resolve(contest),
      rsvpSummary: () => Promise.resolve(summary),
      me: () => Promise.resolve(me),
      // The RSVP form itself is covered in EventPage.rsvp.test.tsx.
      getProfile: () => new Promise(() => {}),
    },
  };
});

function ShowHash() {
  return <output data-testid="hash">{useLocation().hash}</output>;
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/event" element={<EventPage />} />
          <Route path="/faq" element={<ToEvent hash="#faq" />} />
        </Routes>
        <ShowHash />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('event page', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    me = { id: 'g1', name: 'Nora Park', scope: 'full', allergies: [] };
  });

  it('shows the location, start time and the host’s and guests’ allergies once each', async () => {
    renderAt('/event');
    expect(await screen.findByText('Matt & Mar’s Home')).toBeInTheDocument();
    expect(screen.getByText(/December 19/)).toBeInTheDocument();
    expect(await screen.findByText('Lentils')).toBeInTheDocument();
    expect(screen.getByText('Fish')).toBeInTheDocument();
    expect(screen.getByText('Cashews')).toBeInTheDocument();
  });

  it('answers the allergies question first in the FAQ', async () => {
    const user = userEvent.setup();
    renderAt('/event');
    const question = await screen.findByText('Are there any allergies to know about?');
    const faq = document.getElementById('faq')!;
    expect(faq).toContainElement(question);
    await user.click(question);
    expect(await within(faq).findByText('Lentils')).toBeVisible();
  });

  it('lists the live categories and special awards', async () => {
    renderAt('/event');
    expect(await screen.findByText('Holiday desserts')).toBeInTheDocument();
    expect(screen.getByText('Homemade only')).toBeInTheDocument();
    expect(screen.queryByText('Retired')).not.toBeInTheDocument();
    expect(screen.getByText('Best presented')).toBeInTheDocument();
    expect(screen.getByText(/The prettiest plate/)).toBeInTheDocument();
  });

  it('merges the start and voting times into the host’s timeline, in order', async () => {
    renderAt('/event');
    await screen.findByText('Winners announced');
    const schedule = document.getElementById('schedule')!;
    const titles = within(schedule)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('.font-semibold:not(time)')?.textContent);
    expect(titles).toEqual(['Party starts', 'Voting opens', 'Winners announced']);
    expect(within(schedule).getByText('Prizes!')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Event sections' });
    expect(within(nav).getByRole('link', { name: 'Schedule' })).toHaveAttribute(
      'href',
      '#schedule',
    );
  });

  it('asks guests who are not signed in from their email to RSVP for the address', async () => {
    me = { id: 'g2', name: 'Tablet Tess', scope: 'vote', allergies: [] };
    renderAt('/event');
    expect(await screen.findByRole('link', { name: 'RSVP to see the address' })).toHaveAttribute(
      'href',
      '#rsvp',
    );
    expect(screen.queryByText('Matt & Mar’s Home')).not.toBeInTheDocument();
  });

  it('shows the details, RSVP and FAQ on one page, in that order', async () => {
    renderAt('/event');
    expect(await screen.findByText('Loading your RSVP…')).toBeInTheDocument();
    expect(screen.getByText('Frequently asked questions')).toBeInTheDocument();
    const [details, rsvp, faq] = ['details', 'rsvp', 'faq'].map((id) =>
      document.getElementById(id)!,
    );
    expect(details!.compareDocumentPosition(rsvp!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(rsvp!.compareDocumentPosition(faq!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('jumps to a section from the section chips', async () => {
    const user = userEvent.setup();
    renderAt('/event');
    const nav = await screen.findByRole('navigation', { name: 'Event sections' });
    // Which chip lights up needs real layout; jsdom puts every section at the top.
    await user.click(within(nav).getByRole('link', { name: 'FAQ' }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    await user.click(await screen.findByText('When are the winners announced?'));
    expect(screen.getByText('Around 8–9 pm.')).toBeVisible();
  });

  it('sends the old FAQ page to the FAQ section', async () => {
    renderAt('/faq');
    expect(await screen.findByText('Frequently asked questions')).toBeInTheDocument();
    expect(screen.getByTestId('hash')).toHaveTextContent('#faq');
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
  });
});
