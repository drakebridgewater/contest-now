import type { AdminGuest } from '@contest/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { GuestsTab, type GuestActions } from './GuestsTab.tsx';

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
  guest({
    name: 'Ann Lee',
    email: 'ann@example.com',
    rsvpStatus: 'yes',
    plusOneFirstName: 'Ike',
    plusOneLastName: 'Lee',
    allergies: ['peanuts'],
    preregistrations: ['dessert'],
    inviteStatus: 'opened',
  }),
  guest({
    name: 'Bo',
    email: 'bo@example.com',
    rsvpStatus: 'maybe',
    preregistrations: ['dessert'],
  }),
  guest({ name: 'Cy', rsvpStatus: 'no', preregistrations: ['dessert'] }),
  guest({ name: 'Dee', tastedCount: 2 }),
];

beforeAll(() => {
  // jsdom does not implement <dialog>.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

const categoryNames = new Map([['dessert', 'Desserts']]);

function renderTab(mailConfigured = true) {
  const actions: GuestActions = {
    add: vi.fn(),
    inviteLink: vi.fn(() => Promise.resolve('http://party.test/event?invite=abc')),
    sendInvites: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
  };
  render(
    <GuestsTab
      guests={guests}
      categoryNames={categoryNames}
      mailConfigured={mailConfigured}
      actions={actions}
    />,
  );
  return actions;
}

function stat(label: string): string {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent ?? '';
}

describe('GuestsTab', () => {
  it('totals the RSVPs, counting plus-ones but not declined guests', () => {
    renderTab();
    expect(stat('Headcount')).toBe('2');
    expect(stat('Coming')).toBe('1');
    expect(stat('Plus-ones')).toBe('1');
    expect(stat('Maybe')).toBe('1');
    expect(stat('No reply')).toBe('1');
    expect(stat('Not coming')).toBe('1');
    // The totals card counts Ann and Bo; Cy declined.
    expect(screen.getAllByText(/Might enter:/)[0]!.parentElement).toHaveTextContent('Desserts 2');
  });

  it('shows each guest’s RSVP details', () => {
    renderTab();
    expect(screen.getByText(/ann@example.com · \+1 Ike Lee/)).toBeInTheDocument();
    expect(screen.getByText('Peanuts')).toBeInTheDocument();
    expect(screen.getByText('Invite opened')).toBeInTheDocument();
    expect(screen.getAllByText('Walk-in: name only')).toHaveLength(2);
  });

  it('filters by RSVP status', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(screen.getByRole('button', { name: 'Maybe' }));
    expect(screen.queryByText('Ann Lee')).not.toBeInTheDocument();
    expect(screen.getByText('Bo')).toBeInTheDocument();
  });

  it('adds guests from pasted lines', async () => {
    const user = userEvent.setup();
    const actions = renderTab();
    await user.click(screen.getByRole('button', { name: /Add guests/ }));
    const dialog = screen.getByRole('dialog', { name: 'Add guests' });
    await user.type(within(dialog).getByLabelText('Guest list'), 'Eve, eve@example.com{enter}Fay');
    await user.click(within(dialog).getByRole('button', { name: 'Add 2 guests' }));
    expect(actions.add).toHaveBeenCalledWith([
      { name: 'Eve', email: 'eve@example.com' },
      { name: 'Fay', email: '' },
    ]);
  });

  it('shows a personal link to copy', async () => {
    const user = userEvent.setup();
    const actions = renderTab();
    const bo = screen.getByText('Bo').closest('div.space-y-1\\.5') as HTMLElement;
    await user.click(within(bo).getByRole('button', { name: /Link/ }));
    expect(actions.inviteLink).toHaveBeenCalledWith(guests[1]);
    expect(
      await screen.findByDisplayValue('http://party.test/event?invite=abc'),
    ).toBeInTheDocument();
  });

  it('warns and hides email buttons when email is not set up', () => {
    renderTab(false);
    expect(screen.getByText(/Email is not set up on the server/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Email invite|Invite everyone/ }),
    ).not.toBeInTheDocument();
  });
});
