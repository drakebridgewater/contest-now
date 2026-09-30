import type {
  ContestConfig,
  GuestProfile,
  RsvpSummary,
  SessionGuest,
  UpdateProfile,
} from '@contest/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast.tsx';
import type * as ApiModule from '../lib/api.ts';
import { EventPage, ToEvent } from './EventPage.tsx';

const contest: ContestConfig = {
  settings: {
    eventName: 'Party',
    tagline: '',
    photoShareUrl: '',
    location: '',
    startsAt: null,
    faqs: [],
    knownAllergies: [],
    votingOpen: true,
    votingOpensAt: null,
    submissionsOpen: true,
    submissionsOpenAt: null,
  },
  categories: [
    { id: 'dessert', name: 'Desserts', emoji: '🍰', description: '', sortOrder: 1, isActive: true },
    {
      id: 'cocktail',
      name: 'Cocktails',
      emoji: '🍹',
      description: '',
      sortOrder: 2,
      isActive: true,
    },
  ],
  criteria: [],
  awards: [],
};

const summary: RsvpSummary = {
  yes: 3,
  maybe: 0,
  no: 0,
  pending: 0,
  plusOnes: 0,
  headcount: 3,
  preregistered: { dessert: 3 },
  allergies: [],
};

let me: SessionGuest | null;
let profile: GuestProfile;
const requestLink = vi.fn<(email: string, name?: string) => Promise<{ sent: true }>>();
const inviteSignIn = vi.fn<(token: string) => Promise<{ guestId: string }>>();
const updateProfile = vi.fn<(input: UpdateProfile) => Promise<GuestProfile>>();

vi.mock('../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    api: {
      me: () => Promise.resolve(me),
      getContest: () => Promise.resolve(contest),
      rsvpSummary: () => Promise.resolve(summary),
      getProfile: () => Promise.resolve(profile),
      requestLink: (email: string, name?: string) => requestLink(email, name),
      inviteSignIn: (token: string) => inviteSignIn(token),
      updateProfile: (input: UpdateProfile) => updateProfile(input),
      signOut: () => Promise.resolve({}),
    },
  };
});

function renderPage(url = '/event') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/event" element={<EventPage />} />
            <Route path="/register" element={<ToEvent />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  me = null;
  profile = {
    id: 'g1',
    name: 'Nora Park',
    email: 'nora@example.com',
    phone: '',
    rsvpStatus: 'pending',
    plusOneFirstName: '',
    plusOneLastName: '',
    allergies: [],
    preregistrations: ['dessert'],
  };
  requestLink.mockReset().mockResolvedValue({ sent: true });
  inviteSignIn.mockReset();
  updateProfile
    .mockReset()
    .mockImplementation((input) => Promise.resolve({ ...profile, ...input } as GuestProfile));
});

describe('Event page RSVP', () => {
  it('emails a sign-in link when signed out', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Your name'), 'Nora Park');
    await user.type(screen.getByLabelText('Email'), 'nora@example.com');
    await user.click(screen.getByRole('button', { name: /Email me a link/ }));
    expect(requestLink).toHaveBeenCalledWith('nora@example.com', 'Nora Park');
    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
  });

  it('trades an invite link for a session, even from an old /register link', async () => {
    inviteSignIn.mockImplementation(() => {
      me = { id: 'g1', name: 'Nora Park', scope: 'full', allergies: [] };
      return Promise.resolve({ guestId: 'g1' });
    });
    renderPage('/register?invite=tok-123');
    expect(await screen.findByText('Hi, Nora!')).toBeInTheDocument();
    expect(inviteSignIn).toHaveBeenCalledWith('tok-123');
  });

  it('a vote-only session still needs the email link to open the RSVP', async () => {
    me = { id: 'g1', name: 'Nora Park', scope: 'vote', allergies: [] };
    renderPage();
    expect(await screen.findByText(/signed in to vote as/)).toBeInTheDocument();
    expect(screen.getByLabelText('Your name')).toHaveValue('Nora Park');
  });

  describe('signed in', () => {
    beforeEach(() => {
      me = { id: 'g1', name: 'Nora Park', scope: 'full', allergies: [] };
    });

    it('shows how many others might enter each category, not counting you', async () => {
      renderPage();
      await screen.findByText('Hi, Nora!');
      await waitFor(() =>
        expect(screen.getByText('2 others are planning this')).toBeInTheDocument(),
      );
      expect(screen.getByText('Nobody else yet — be the first!')).toBeInTheDocument();
    });

    it('saves the RSVP with a plus-one, allergies and pre-registrations', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Hi, Nora!');
      await user.click(screen.getByRole('button', { name: /Coming/ }));
      await user.click(screen.getByLabelText(/bringing a plus-one/));
      await user.type(screen.getByLabelText('First name'), 'Ike');
      await user.type(screen.getByLabelText('Last name'), 'Park');
      await user.click(screen.getAllByRole('button', { name: 'Be specific' })[0]!);
      await user.click(screen.getByRole('button', { name: /Peanuts/ }));
      await user.click(screen.getByRole('checkbox', { name: /Cocktails/ }));
      await user.click(screen.getByRole('button', { name: 'Save my RSVP' }));
      await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
      expect(updateProfile).toHaveBeenCalledWith({
        name: 'Nora Park',
        rsvpStatus: 'yes',
        plusOneFirstName: 'Ike',
        plusOneLastName: 'Park',
        phone: '',
        allergies: ['peanuts'],
        preregistrations: ['dessert', 'cocktail'],
      });
    });

    it('insists on an answer and on both halves of the plus-one name', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Hi, Nora!');
      await user.click(screen.getByLabelText(/bringing a plus-one/));
      await user.type(screen.getByLabelText('First name'), 'Ike');
      await user.click(screen.getByRole('button', { name: 'Save my RSVP' }));
      expect(screen.getByText('Let us know if you can make it')).toBeInTheDocument();
      expect(screen.getByText('Give your plus-one a first and last name')).toBeInTheDocument();
      expect(updateProfile).not.toHaveBeenCalled();
    });
  });
});
