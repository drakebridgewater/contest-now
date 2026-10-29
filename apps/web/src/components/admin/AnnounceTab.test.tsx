import type { Announcement } from '@contest/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AnnounceTab } from './AnnounceTab.tsx';

const at = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const announcements: Announcement[] = [
  { id: 2, message: 'Pizza is here!', createdAt: at(-1), expiresAt: at(14) },
  { id: 1, message: 'Doors open', createdAt: at(-60), expiresAt: at(-45) },
];

function setup() {
  const onSend = vi.fn(() => Promise.resolve());
  const onExpire = vi.fn();
  render(
    <AnnounceTab
      announcements={announcements}
      sending={false}
      onSend={onSend}
      onExpire={onExpire}
    />,
  );
  return { onSend, onExpire };
}

describe('AnnounceTab', () => {
  it('sends the typed message with the chosen duration and clears the box', async () => {
    const user = userEvent.setup();
    const { onSend } = setup();
    const send = screen.getByRole('button', { name: 'Send to everyone' });
    expect(send).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Food is here!' }));
    await user.selectOptions(screen.getByLabelText('Show for'), '30');
    await user.click(send);

    expect(onSend).toHaveBeenCalledWith({ message: 'Food is here!', durationMinutes: 30 });
    expect(screen.getByLabelText('Message')).toHaveValue('');
  });

  it('splits live from earlier, ends a live one, and re-sends an old one', async () => {
    const user = userEvent.setup();
    const { onSend, onExpire } = setup();

    await user.click(screen.getByRole('button', { name: 'End now' }));
    expect(onExpire).toHaveBeenCalledWith(announcements[0]);

    await user.click(screen.getByRole('button', { name: 'Send again' }));
    expect(onSend).toHaveBeenCalledWith({ message: 'Doors open', durationMinutes: 15 });
  });
});
