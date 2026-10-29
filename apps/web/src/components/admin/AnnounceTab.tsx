import {
  ANNOUNCEMENT_DEFAULT_DURATION,
  ANNOUNCEMENT_DURATIONS,
  ANNOUNCEMENT_MAX,
  type Announcement,
  type CreateAnnouncement,
} from '@contest/shared';
import { Megaphone, RotateCcw, Square } from 'lucide-react';
import { useState } from 'react';
import { opensAtText, untilText } from '../../lib/time.ts';
import { useNow } from '../../lib/useNow.ts';
import { Button } from '../ui/Button.tsx';
import { Card, CardHeader } from '../ui/Card.tsx';
import { TextAreaField } from '../ui/Field.tsx';

const PRESETS = [
  'Voting closes in 10 minutes!',
  'Food is here!',
  'Results in 5 minutes. Gather round!',
];

type Duration = (typeof ANNOUNCEMENT_DURATIONS)[number];

/**
 * A pop-up for everyone on the site right now. Guests see it within about 15
 * seconds, once per device, and only until it expires.
 */
export function AnnounceTab({
  announcements,
  sending,
  onSend,
  onExpire,
}: {
  announcements: Announcement[];
  sending: boolean;
  onSend: (input: CreateAnnouncement) => Promise<unknown>;
  onExpire: (announcement: Announcement) => void;
}) {
  const [message, setMessage] = useState('');
  const [duration, setDuration] = useState<Duration>(ANNOUNCEMENT_DEFAULT_DURATION);
  const now = useNow(true, 10_000);

  const live = announcements.filter((a) => new Date(a.expiresAt) > now);
  const past = announcements.filter((a) => new Date(a.expiresAt) <= now);
  const trimmed = message.trim();

  // Errors are toasted by the caller; the draft is kept so it can be retried.
  const resend = (text: string) =>
    void onSend({ message: text, durationMinutes: duration }).catch(() => undefined);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Send an announcement"
          subtitle="Pops up on every guest's screen within about 15 seconds."
        />
        <form
          className="space-y-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!trimmed) return;
            onSend({ message: trimmed, durationMinutes: duration }).then(
              () => setMessage(''),
              () => undefined,
            );
          }}
        >
          <TextAreaField
            label="Message"
            rows={2}
            maxLength={ANNOUNCEMENT_MAX}
            counter={`${message.length}/${ANNOUNCEMENT_MAX}`}
            placeholder="Pizza is here!"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setMessage(preset)}
                className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm"
              >
                {preset}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Show for
              <select
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value) as Duration)}
                className="rounded-lg border border-black/15 bg-white px-2 py-2 text-sm"
              >
                {ANNOUNCEMENT_DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} min
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={!trimmed} loading={sending}>
              <Megaphone className="size-4" aria-hidden="true" />
              Send to everyone
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Live now"
          subtitle="Guests who haven't dismissed these still see them."
        />
        {live.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">Nothing live.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {live.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold break-words">{a.message}</p>
                  <p className="text-sm text-ink-muted">
                    Expires {untilText(new Date(a.expiresAt), now)}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => onExpire(a)}>
                  <Square className="size-4" aria-hidden="true" />
                  End now
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {past.length > 0 ? (
        <Card>
          <CardHeader title="Earlier" />
          <ul className="divide-y divide-black/5">
            {past.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="break-words">{a.message}</p>
                  <p className="text-sm text-ink-muted">
                    Sent {opensAtText(new Date(a.createdAt), now)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={sending}
                  onClick={() => resend(a.message)}
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Send again
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
