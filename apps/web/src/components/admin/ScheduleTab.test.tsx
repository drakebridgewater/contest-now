import type { EventSettings } from '@contest/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScheduleTab } from './ScheduleTab.tsx';

const settings: EventSettings = {
  eventName: 'PDXmas',
  tagline: '',
  photoShareUrl: '',
  location: '',
  startsAt: '2026-12-20T02:00:00.000Z',
  faqs: [],
  schedule: [],
  knownAllergies: [],
  votingOpen: true,
  votingOpensAt: null,
  submissionsOpen: true,
  submissionsOpenAt: null,
};

function renderSchedule(overrides: Partial<EventSettings> = {}) {
  const onSave = vi.fn();
  render(<ScheduleTab settings={{ ...settings, ...overrides }} onSave={onSave} />);
  return onSave;
}

describe('ScheduleTab', () => {
  it('saves an opening time as an ISO instant from the local time typed', async () => {
    const user = userEvent.setup();
    const onSave = renderSchedule();
    const input = screen.getByLabelText('Voting open at');
    await user.type(input, '2026-12-20T19:30');
    const section = input.closest('section')!;
    await user.click(within(section).getByRole('button', { name: 'Save time' }));
    expect(onSave).toHaveBeenCalledWith({
      votingOpensAt: new Date('2026-12-20T19:30').toISOString(),
    });
  });

  it('has its own switch for entries, separate from voting', async () => {
    const user = userEvent.setup();
    const onSave = renderSchedule();
    await user.click(screen.getByRole('switch', { name: /Accepting entries/ }));
    expect(onSave).toHaveBeenCalledWith({ submissionsOpen: false });
  });

  it('clears the party start time', async () => {
    const user = userEvent.setup();
    const onSave = renderSchedule();
    const input = screen.getByLabelText('Party starts at');
    const card = input.closest('.rounded-card') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Clear' }));
    expect(onSave).toHaveBeenCalledWith({ startsAt: null });
  });

  it('adds a timeline item at the start time, and saves it once it has a name', async () => {
    const user = userEvent.setup();
    const onSave = renderSchedule();
    const save = screen.getByRole('button', { name: 'Save timeline' });
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(screen.getByLabelText('Time')).toHaveValue(
      // The start time, in the browser's own zone.
      (screen.getByLabelText('Party starts at') as HTMLInputElement).value,
    );
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText('What’s happening'), 'Winners announced');
    await user.click(save);
    expect(onSave).toHaveBeenCalledWith({
      schedule: [{ at: settings.startsAt, title: 'Winners announced', details: '' }],
    });
  });

  it('removes a timeline item', async () => {
    const user = userEvent.setup();
    const onSave = renderSchedule({
      schedule: [{ at: '2026-12-20T04:30:00.000Z', title: 'Winners announced', details: '' }],
    });
    await user.click(screen.getByRole('button', { name: 'Remove item 1' }));
    await user.click(screen.getByRole('button', { name: 'Save timeline' }));
    expect(onSave).toHaveBeenCalledWith({ schedule: [] });
  });
});
