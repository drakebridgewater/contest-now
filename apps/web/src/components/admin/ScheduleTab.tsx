import { phaseStatus, SCHEDULE_MAX, type EventSettings, type ScheduleItem } from '@contest/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { opensAtText, toLocalInput, untilText } from '../../lib/time.ts';
import { useNow } from '../../lib/useNow.ts';
import { Button } from '../ui/Button.tsx';
import { Card, CardHeader } from '../ui/Card.tsx';
import { TextField, Toggle } from '../ui/Field.tsx';

/**
 * Every time on the evening in one place: when the party starts, when entries
 * and voting open, and the host's own timeline items. Guests see them all,
 * merged in time order, on the Event page.
 */
export function ScheduleTab({
  settings,
  onSave,
}: {
  settings: EventSettings;
  onSave: (input: Partial<EventSettings>) => void;
}) {
  const now = useNow(true, 30_000);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Party start" subtitle="Shown on the Event page and its timeline." />
        <div className="p-4">
          <TimeField
            key={settings.startsAt}
            label="Party starts at"
            help="Leave empty to show TBA."
            value={settings.startsAt}
            onSave={(startsAt) => onSave({ startsAt })}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Entries and voting"
          subtitle="Guests see a countdown until each opens. The switch closes it by hand at any time."
        />
        <div className="space-y-5 p-4">
          <PhaseSchedule
            title="Entries"
            switchLabel="Accepting entries"
            switchHelp="Turn off to stop new entries being submitted."
            open={settings.submissionsOpen}
            opensAt={settings.submissionsOpenAt}
            now={now}
            onOpenChange={(submissionsOpen) => onSave({ submissionsOpen })}
            onOpensAtChange={(submissionsOpenAt) => onSave({ submissionsOpenAt })}
          />
          <PhaseSchedule
            title="Voting"
            switchLabel="Voting is open"
            switchHelp="Turn off after the awards to freeze ratings and nominations."
            open={settings.votingOpen}
            opensAt={settings.votingOpensAt}
            now={now}
            onOpenChange={(votingOpen) => onSave({ votingOpen })}
            onOpensAtChange={(votingOpensAt) => onSave({ votingOpensAt })}
          />
        </div>
      </Card>

      {/* Keyed so a save (which comes back sorted) re-seeds the drafts. */}
      <TimelineEditor
        key={JSON.stringify(settings.schedule)}
        items={settings.schedule}
        startsAt={settings.startsAt}
        onSave={(schedule) => onSave({ schedule })}
      />
    </div>
  );
}

/** A date and time with its own Save and Clear, saved as an ISO instant. */
function TimeField({
  label,
  help,
  value,
  onSave,
}: {
  label: string;
  help: string;
  value: string | null;
  onSave: (value: string | null) => void;
}) {
  const [draft, setDraft] = useState(toLocalInput(value));
  const saved = toLocalInput(value);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1">
        <TextField
          label={label}
          help={help}
          type="datetime-local"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </div>
      <Button
        size="sm"
        className="mb-6"
        disabled={draft === saved || draft === ''}
        onClick={() => onSave(new Date(draft).toISOString())}
      >
        Save time
      </Button>
      {value ? (
        <Button
          size="sm"
          variant="ghost"
          className="mb-6"
          onClick={() => {
            setDraft('');
            onSave(null);
          }}
        >
          Clear
        </Button>
      ) : null}
    </div>
  );
}

function PhaseSchedule({
  title,
  switchLabel,
  switchHelp,
  open,
  opensAt,
  now,
  onOpenChange,
  onOpensAtChange,
}: {
  title: string;
  switchLabel: string;
  switchHelp: string;
  open: boolean;
  opensAt: string | null;
  now: Date;
  onOpenChange: (open: boolean) => void;
  onOpensAtChange: (opensAt: string | null) => void;
}) {
  const status = phaseStatus(open, opensAt, now);
  const statusText =
    status === 'open'
      ? 'Open now'
      : status === 'closed'
        ? 'Closed'
        : `Opens ${opensAtText(new Date(opensAt!), now)} (${untilText(new Date(opensAt!), now)})`;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">{title}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            status === 'open'
              ? 'bg-accent-100 text-accent-700'
              : status === 'scheduled'
                ? 'bg-amber-50 text-amber-900'
                : 'bg-surface-muted text-ink-muted'
          }`}
        >
          {statusText}
        </span>
      </div>
      <Toggle label={switchLabel} help={switchHelp} checked={open} onChange={onOpenChange} />
      <TimeField
        label={`${title} open at`}
        help="Leave empty to open as soon as the switch is on."
        value={opensAt}
        onSave={onOpensAtChange}
      />
    </section>
  );
}

/** A timeline item being edited: local time as typed, and a stable key for React. */
type ItemDraft = { key: number; at: string; title: string; details: string };

let nextItemKey = 1;
const toDrafts = (items: ScheduleItem[]): ItemDraft[] =>
  items.map((item) => ({ ...item, at: toLocalInput(item.at), key: nextItemKey++ }));

function TimelineEditor({
  items,
  startsAt,
  onSave,
}: {
  items: ScheduleItem[];
  startsAt: string | null;
  onSave: (items: ScheduleItem[]) => void;
}) {
  const [drafts, setDrafts] = useState(() => toDrafts(items));

  const cleaned = drafts.map(({ at, title, details }) => ({
    at: at === '' ? '' : new Date(at).toISOString(),
    title: title.trim(),
    details: details.trim(),
  }));
  const dirty = JSON.stringify(cleaned) !== JSON.stringify(items);
  const incomplete = cleaned.some((item) => item.at === '' || item.title === '');

  const update = (key: number, patch: Partial<ItemDraft>) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  // A new item starts at the party's start time (or the last item's), ready to nudge.
  const nextAt = drafts.at(-1)?.at || toLocalInput(startsAt);

  return (
    <Card>
      <CardHeader
        title="Timeline"
        subtitle="Shown to guests on the Event page, in time order, along with the start, entry and voting times above."
      />
      <div className="space-y-4 p-4">
        {drafts.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Nothing yet. Add things like “Judging starts” or “Winners announced”.
          </p>
        ) : null}
        {drafts.map((draft, index) => (
          <div key={draft.key} className="space-y-2 rounded-xl border border-black/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold">Item {index + 1}</h3>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Remove item ${index + 1}`}
                onClick={() => setDrafts((list) => list.filter((d) => d.key !== draft.key))}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <TextField
              label="Time"
              type="datetime-local"
              value={draft.at}
              onChange={(event) => update(draft.key, { at: event.target.value })}
            />
            <TextField
              label="What’s happening"
              maxLength={80}
              value={draft.title}
              onChange={(event) => update(draft.key, { title: event.target.value })}
            />
            <TextField
              label="Details (optional)"
              maxLength={300}
              value={draft.details}
              onChange={(event) => update(draft.key, { details: event.target.value })}
            />
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={drafts.length >= SCHEDULE_MAX}
            onClick={() =>
              setDrafts((list) => [
                ...list,
                { key: nextItemKey++, at: nextAt, title: '', details: '' },
              ])
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            Add item
          </Button>
          <Button disabled={!dirty || incomplete} onClick={() => onSave(cleaned)}>
            Save timeline
          </Button>
          {dirty ? (
            <Button variant="ghost" onClick={() => setDrafts(toDrafts(items))}>
              Discard changes
            </Button>
          ) : null}
        </div>
        {incomplete ? (
          <p className="text-sm text-ink-muted">
            Every item needs a time and a name before saving.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
