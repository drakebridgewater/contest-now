import type { Announcement } from '@contest/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnouncementModal } from './AnnouncementModal.tsx';

let live: Announcement[];

vi.mock('../lib/api.ts', () => ({
  api: { getAnnouncements: () => Promise.resolve(live) },
}));

const minutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString();

const announcement = (id: number, message: string, expiresInMin = 10): Announcement => ({
  id,
  message,
  createdAt: minutes(-1),
  expiresAt: minutes(expiresInMin),
});

function renderModal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AnnouncementModal />
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  // jsdom does not implement <dialog>.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

beforeEach(() => {
  localStorage.clear();
  live = [];
});

describe('AnnouncementModal', () => {
  it('shows a live announcement until it is dismissed, and not again after', async () => {
    live = [announcement(1, 'Pizza is here!')];
    const { unmount } = renderModal();
    expect(await screen.findByText('Pizza is here!')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText('Pizza is here!')).not.toBeInTheDocument();

    unmount();
    renderModal();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText('Pizza is here!')).not.toBeInTheDocument();
  });

  it('shows queued announcements one at a time, oldest first', async () => {
    live = [announcement(3, 'Voting closes in 5 minutes'), announcement(2, 'Cake time')];
    renderModal();
    expect(await screen.findByText('Cake time')).toBeInTheDocument();
    expect(screen.queryByText('Voting closes in 5 minutes')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.getByText('Voting closes in 5 minutes')).toBeInTheDocument();
  });

  it('never shows one that has already expired', async () => {
    live = [announcement(4, 'Old news', -1)];
    renderModal();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText('Old news')).not.toBeInTheDocument();
  });

  it('forgets dismissals the server no longer lists', async () => {
    localStorage.setItem('dismissedAnnouncements', JSON.stringify([1, 99]));
    live = [announcement(1, 'Still live')];
    renderModal();
    await vi.waitFor(() =>
      expect(JSON.parse(localStorage.getItem('dismissedAnnouncements')!)).toEqual([1]),
    );
    expect(screen.queryByText('Still live')).not.toBeInTheDocument();
  });
});
