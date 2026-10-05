import type { Announcement } from '@contest/shared';
import { useEffect, useRef } from 'react';
import { useAnnouncements } from '../lib/queries.ts';
import { useLocalStorage } from '../lib/useLocalStorage.ts';
import { useNow } from '../lib/useNow.ts';
import { Button } from './ui/Button.tsx';
import { Sheet } from './ui/Sheet.tsx';

const DISMISSED_KEY = 'dismissedAnnouncements';

/** "just now", "4 min ago". */
function agoText(sent: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - sent.getTime()) / 60_000);
  return minutes < 1 ? 'just now' : `${minutes} min ago`;
}

/**
 * Pops up the host's announcements on every page, one at a time, oldest first.
 * Each one is shown once per device, and never after it expires.
 */
export function AnnouncementModal() {
  const announcements = useAnnouncements();
  const [dismissed, setDismissed] = useLocalStorage<number[]>(DISMISSED_KEY, []);
  const live = announcements.data ?? [];
  // Ticks only while there is something to show, so an open one closes itself on expiry.
  const now = useNow(live.length > 0, 5_000);

  const current: Announcement | undefined = live
    .filter((a) => !dismissed.includes(a.id) && new Date(a.expiresAt) > now)
    .sort((a, b) => a.id - b.id)[0];

  // Forget ids the server no longer lists: they have expired and will never come back.
  useEffect(() => {
    if (!announcements.data) return;
    const ids = new Set(announcements.data.map((a) => a.id));
    const kept = dismissed.filter((id) => ids.has(id));
    if (kept.length !== dismissed.length) setDismissed(kept);
  }, [announcements.data, dismissed, setDismissed]);

  // A buzz so a phone on the table gets noticed.
  const buzzed = useRef<number | null>(null);
  useEffect(() => {
    if (!current || buzzed.current === current.id) return;
    buzzed.current = current.id;
    navigator.vibrate?.(200);
  }, [current]);

  const dismiss = () => {
    if (current) setDismissed([...dismissed, current.id]);
  };

  return (
    <Sheet open={current !== undefined} onClose={dismiss} title="📣 Announcement">
      {current ? (
        <div className="space-y-4">
          <p className="text-2xl font-bold break-words whitespace-pre-line">{current.message}</p>
          <p className="text-sm text-ink-muted">
            From the host · {agoText(new Date(current.createdAt), now)}
          </p>
          <Button size="lg" className="w-full" onClick={dismiss}>
            Got it
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}
