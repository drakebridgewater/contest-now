import type { AdminGuest } from '@contest/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailTab } from './EmailTab.tsx';

const guest = (overrides: Partial<AdminGuest>): AdminGuest => ({
  id: overrides.name ?? 'g',
  name: 'Guest',
  email: '',
  phone: '',
  rsvpStatus: 'pending',
  plusOneFirstName: '',
  plusOneLastName: '',
  allergies: [],
  preregistrations: [],
  inviteStatus: 'none',
  entryCount: 0,
  voteCount: 0,
  completeVoteCount: 0,
  tastedCount: 0,
  ballotCount: 0,
  createdAt: new Date().toISOString(),
  ...overrides,
});

const guests = [
  guest({ name: 'Ann', email: 'ann@example.com', rsvpStatus: 'yes' }),
  guest({ name: 'Bo', email: 'bo@example.com', rsvpStatus: 'maybe' }),
  guest({ name: 'Cy', email: 'cy@example.com', rsvpStatus: 'yes' }),
  guest({ name: 'No Mail', rsvpStatus: 'yes' }),
];

function setup(onSend = vi.fn()) {
  render(
    <EmailTab
      guests={guests}
      mailConfigured
      hasPhotoAlbum={false}
      sending={false}
      onSend={onSend}
    />,
  );
  return onSend;
}

beforeEach(() => {
  localStorage.clear();
});

describe('EmailTab', () => {
  it('lists only guests with an email, all ticked, narrowed by the filter', async () => {
    setup();
    expect(screen.getByText('3 of 3 selected')).toBeInTheDocument();
    expect(screen.queryByText('No Mail')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Coming' }));
    expect(screen.getByText('2 of 2 selected')).toBeInTheDocument();
    expect(screen.queryByText('Bo')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: /Ann/ }));
    expect(screen.getByText('1 of 2 selected')).toBeInTheDocument();
  });

  it('cannot send without a subject and a message', async () => {
    setup();
    expect(screen.getByRole('button', { name: /Send to 3/ })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Subject'), 'Party update');
    expect(screen.getByRole('button', { name: /Send to 3/ })).toBeDisabled();
  });

  it('offers the photo album tag only once an album is set', () => {
    setup();
    expect(screen.getByRole('button', { name: /Photo album link/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Personal RSVP link/ })).toBeEnabled();
  });
});
