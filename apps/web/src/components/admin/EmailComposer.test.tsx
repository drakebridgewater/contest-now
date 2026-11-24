import type { AdminGuest } from '@contest/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailComposer } from './EmailComposer.tsx';

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
  access: 'invited',
  entryCount: 0,
  voteCount: 0,
  completeVoteCount: 0,
  tastedCount: 0,
  ballotCount: 0,
  createdAt: new Date().toISOString(),
  ...overrides,
});

const recipients = [
  guest({ name: 'Ann', email: 'ann@example.com', rsvpStatus: 'yes' }),
  guest({ name: 'Bo', email: 'bo@example.com', rsvpStatus: 'maybe' }),
  guest({ name: 'Cy', email: 'cy@example.com', rsvpStatus: 'yes' }),
];

function setup(onSend = vi.fn()) {
  render(
    <EmailComposer
      recipients={recipients}
      skipped={1}
      mailConfigured
      hasPhotoAlbum={false}
      sending={false}
      onSend={onSend}
    />,
  );
  return onSend;
}

beforeEach(() => {
  globalThis.localStorage?.clear();
});

describe('EmailComposer', () => {
  it('names who it goes to and how many ticked guests were left out', () => {
    setup();
    expect(screen.getByText('To 3 guests')).toBeInTheDocument();
    expect(screen.getByText(/1 without an email or not on the list left out/)).toBeInTheDocument();
    expect(screen.getByText('Ann, Bo, Cy')).toBeInTheDocument();
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
