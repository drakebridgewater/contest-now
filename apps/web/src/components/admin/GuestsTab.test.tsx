import type { AdminGuest } from '@contest/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
  access: 'invited',
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
  guest({ name: 'Gus Ask', email: 'gus@example.com', access: 'requested' }),
  guest({ name: 'Hal No', email: 'hal@example.com', access: 'declined' }),
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

let confirmSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  globalThis.localStorage?.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error -- jsdom has no matchMedia; some tests add one.
  delete window.matchMedia;
});

/** Makes the tab think it is on a wide screen, so it shows the table. */
function wideScreen() {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

const categoryNames = new Map([['dessert', 'Desserts']]);

function renderTab(mailConfigured = true) {
  const actions: GuestActions = {
    add: vi.fn(),
    inviteLink: vi.fn(() => Promise.resolve('http://party.test/event?invite=abc')),
    sendInvites: vi.fn(),
    update: vi.fn(),
    setAccess: vi.fn(),
    remove: vi.fn(),
    sendEmail: vi.fn(),
  };
  render(
    <GuestsTab
      guests={guests}
      categoryNames={categoryNames}
      mailConfigured={mailConfigured}
      hasPhotoAlbum={false}
      sending={false}
      actions={actions}
    />,
  );
  return actions;
}

function stat(label: string): string {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent ?? '';
}

const byName = (name: string) => guests.find((g) => g.name === name)!;

describe('GuestsTab', () => {
  it('totals the RSVPs, counting plus-ones but not declined guests', () => {
    renderTab();
    expect(stat('Headcount')).toBe('2');
    expect(stat('Coming')).toBe('1');
    expect(stat('Plus-ones')).toBe('1');
    expect(stat('Maybe')).toBe('1');
    expect(stat('No reply')).toBe('1');
    expect(stat('Not coming')).toBe('1');
    expect(screen.getAllByText(/Might enter:/)[0]!.parentElement).toHaveTextContent('Desserts 2');
  });

  it('filters RSVP answer and invite progress separately', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.selectOptions(screen.getByRole('combobox', { name: 'RSVP' }), 'maybe');
    expect(screen.queryByText('Ann Lee')).not.toBeInTheDocument();
    expect(screen.getByText('Bo')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Invite' }), 'opened');
    expect(screen.getByText('Nobody matches these filters.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Ann Lee')).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: 'RSVP link for Bo' }));
    expect(actions.inviteLink).toHaveBeenCalledWith(byName('Bo'));
    expect(
      await screen.findByDisplayValue('http://party.test/event?invite=abc'),
    ).toBeInTheDocument();
  });

  it('points out people asking to join, and approves them after a warning', async () => {
    const user = userEvent.setup();
    const actions = renderTab();
    await user.click(screen.getByRole('button', { name: 'Show them' }));
    expect(screen.queryByText('Ann Lee')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Approve/ }));
    expect(confirmSpy).toHaveBeenCalledWith(
      'Let Gus Ask in? Their invite is emailed straight away.',
    );
    expect(actions.setAccess).toHaveBeenCalledWith([byName('Gus Ask')], 'invited');
  });

  it('warns and hides email actions when email is not set up', () => {
    renderTab(false);
    expect(screen.getByText(/Email is not set up on the server/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Email invite/ })).not.toBeInTheDocument();
  });

  describe('on a phone', () => {
    it('shows guests as cards with their details', () => {
      renderTab();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getByText(/ann@example.com · \+1 Ike Lee/)).toBeInTheDocument();
      expect(screen.getByText('Peanuts')).toBeInTheDocument();
    });

    it('edits a guest in a sheet, sending only what changed', async () => {
      const user = userEvent.setup();
      const actions = renderTab();
      const card = screen.getByText('Dee').closest('div.flex.gap-3') as HTMLElement;
      await user.click(within(card).getByRole('button', { name: /Edit/ }));
      const dialog = screen.getByRole('dialog', { name: 'Edit Dee' });
      await user.type(within(dialog).getByLabelText('Phone'), '555 0100');
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      expect(actions.update).toHaveBeenCalledWith([byName('Dee')], { phone: '555 0100' });
    });
  });

  describe('on a wide screen', () => {
    it('edits a cell in place, saving on Enter', async () => {
      wideScreen();
      const user = userEvent.setup();
      const actions = renderTab();
      expect(screen.getByRole('table')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Edit name for Bo' }));
      const input = screen.getByRole('textbox', { name: 'Name for Bo' });
      await user.clear(input);
      await user.type(input, 'Bo Chen{enter}');
      expect(actions.update).toHaveBeenCalledWith([byName('Bo')], { name: 'Bo Chen' });
      expect(screen.queryByRole('textbox', { name: 'Name for Bo' })).not.toBeInTheDocument();
    });

    it('keeps the editor open with the problem when a value is invalid', async () => {
      wideScreen();
      const user = userEvent.setup();
      const actions = renderTab();
      await user.click(screen.getByRole('button', { name: 'Edit email for Dee' }));
      await user.type(
        screen.getByRole('textbox', { name: 'Email for Dee' }),
        'not-an-email{enter}',
      );
      expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email');
      expect(actions.update).not.toHaveBeenCalled();
    });

    it('warns before overwriting a guest’s own RSVP, and stops if the host cancels', async () => {
      wideScreen();
      const user = userEvent.setup();
      const actions = renderTab();
      confirmSpy.mockReturnValue(false);
      await user.click(screen.getByRole('button', { name: 'Edit rsvp for Cy' }));
      await user.selectOptions(screen.getByRole('combobox', { name: 'RSVP for Cy' }), 'yes');
      expect(confirmSpy).toHaveBeenCalledWith(
        'Cy answered “Not coming” themselves. Change it to “Coming”?',
      );
      expect(actions.update).not.toHaveBeenCalled();

      // Someone who has not replied can be filled in without a warning.
      confirmSpy.mockClear();
      await user.click(screen.getByRole('button', { name: 'Edit rsvp for Dee' }));
      await user.selectOptions(screen.getByRole('combobox', { name: 'RSVP for Dee' }), 'yes');
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(actions.update).toHaveBeenCalledWith([byName('Dee')], { rsvpStatus: 'yes' });
    });

    it('shows what the app sets as read-only', () => {
      wideScreen();
      renderTab();
      const ann = screen.getByRole('row', { name: /Ann Lee/ });
      expect(within(ann).getByText('Opened')).toHaveAttribute('title', 'Set by the app');
      expect(within(ann).queryByRole('button', { name: /invite for/i })).not.toBeInTheDocument();
    });

    it('acts on ticked guests together', async () => {
      wideScreen();
      const user = userEvent.setup();
      const actions = renderTab();
      await user.click(screen.getByRole('checkbox', { name: 'Select Ann Lee' }));
      await user.click(screen.getByRole('checkbox', { name: 'Select Bo' }));
      await user.click(screen.getByRole('checkbox', { name: 'Select Dee' }));
      const bar = screen.getByRole('toolbar', { name: 'Selected guests' });
      expect(within(bar).getByText('3 selected')).toBeInTheDocument();

      // Dee has no email, so only Ann and Bo get invites.
      await user.click(within(bar).getByRole('button', { name: /Send invite/ }));
      expect(confirmSpy).toHaveBeenLastCalledWith(
        'Email an RSVP invite to 2 guests? 1 without an email or not on the list are left out.',
      );
      expect(actions.sendInvites).toHaveBeenCalledWith(['Ann Lee', 'Bo']);

      // Ann and Bo answered themselves; Dee did not.
      await user.selectOptions(
        within(bar).getByRole('combobox', { name: 'Set RSVP for selected' }),
        'no',
      );
      expect(confirmSpy).toHaveBeenLastCalledWith(
        expect.stringMatching(/^2 of these guests already answered themselves \(Ann Lee, Bo\)/),
      );
      expect(actions.update).toHaveBeenCalledWith(
        [byName('Ann Lee'), byName('Bo'), byName('Dee')],
        { rsvpStatus: 'no' },
      );

      await user.click(within(bar).getByRole('button', { name: /Delete/ }));
      expect(actions.remove).toHaveBeenCalledWith([byName('Ann Lee'), byName('Bo'), byName('Dee')]);
    });

    it('opens the email composer for the ticked guests', async () => {
      wideScreen();
      const user = userEvent.setup();
      renderTab();
      await user.click(screen.getByRole('checkbox', { name: 'Select Bo' }));
      await user.click(screen.getByRole('checkbox', { name: 'Select Cy' }));
      await user.click(screen.getByRole('button', { name: /Email…/ }));
      const dialog = screen.getByRole('dialog', { name: 'Email selected guests' });
      expect(await within(dialog).findByText('To 1 guest')).toBeInTheDocument();
      expect(within(dialog).getByText(/1 without an email/)).toBeInTheDocument();
    });

    it('sorts by a column', async () => {
      wideScreen();
      const user = userEvent.setup();
      renderTab();
      await user.click(screen.getByRole('button', { name: 'RSVP' }));
      const names = screen
        .getAllByRole('button', { name: /^Edit name for/ })
        .map((button) => button.textContent);
      expect(names.slice(0, 2)).toEqual(['Ann Lee', 'Bo']);
      expect(names.at(-1)).toBe('Cy');
    });
  });
});
