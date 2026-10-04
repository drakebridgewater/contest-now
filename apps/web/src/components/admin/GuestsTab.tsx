import {
  labelFor,
  parseGuestLines,
  type AdminGuest,
  type NewGuest,
  type RsvpStatus,
} from '@contest/shared';
import clsx from 'clsx';
import { Check, Link2, Mail, Pencil, Trash2, UserPlus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { rsvpTotals } from '../../lib/rsvpTotals.ts';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';
import { TextAreaField } from '../ui/Field.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { GUEST_FILTERS, guestMatchesFilter, type GuestFilter } from './guestFilter.ts';

const RSVP_LABEL: Record<RsvpStatus, string> = {
  yes: 'Coming',
  maybe: 'Maybe',
  no: 'Not coming',
  pending: 'No reply',
};

const RSVP_CLASS: Record<RsvpStatus, string> = {
  yes: 'bg-accent-100 text-accent-700 border-accent-500/30',
  maybe: 'bg-amber-50 text-amber-900 border-amber-300',
  no: 'bg-surface-muted text-ink-muted border-black/10',
  pending: 'bg-white text-ink-muted border-black/15',
};

const INVITE_LABEL: Record<AdminGuest['inviteStatus'], string> = {
  none: 'Not invited',
  created: 'Link made',
  sent: 'Invite sent',
  opened: 'Invite opened',
};

export function FilterChips({
  value,
  onChange,
  labels = {},
}: {
  value: GuestFilter;
  onChange: (filter: GuestFilter) => void;
  labels?: Partial<Record<GuestFilter, string>>;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter">
      {GUEST_FILTERS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={clsx(
            'tap-target shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold',
            value === id
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-black/15 bg-white text-ink',
          )}
        >
          {labels[id] ?? label}
        </button>
      ))}
    </div>
  );
}

/** Headcount and "might enter" numbers; on the Guests tab and above the results. */
export function RsvpSummaryCard({
  guests,
  categoryNames,
}: {
  guests: readonly AdminGuest[];
  categoryNames: Map<string, string>;
}) {
  const totals = rsvpTotals(guests);
  const stats: [string, number][] = [
    ['Headcount', totals.headcount],
    ['Coming', totals.yes],
    ['Plus-ones', totals.plusOnes],
    ['Maybe', totals.maybe],
    ['No reply', totals.pending],
    ['Not coming', totals.no],
  ];
  return (
    <Card className="space-y-3 p-4">
      <dl className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold text-ink-muted">{label}</dt>
            <dd className="text-2xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {totals.preregistered.size > 0 ? (
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink">Might enter: </span>
          {[...totals.preregistered]
            .map(([id, n]) => `${categoryNames.get(id) ?? id} ${n}`)
            .join(' · ')}
        </p>
      ) : null}
    </Card>
  );
}

export interface GuestActions {
  add: (guests: NewGuest[]) => void;
  /** Resolves to a fresh personal RSVP link; the previous one stops working. */
  inviteLink: (guest: AdminGuest) => Promise<string>;
  sendInvites: (selector: { guestIds: string[] } | { uninvited: true }) => void;
  rename: (guest: AdminGuest, newName: string) => void;
  remove: (guest: AdminGuest) => void;
  /** Let someone in (emailing their invite when mail works) or turn them away. */
  setAccess: (guest: AdminGuest, access: 'invited' | 'declined') => void;
}

export function GuestsTab({
  guests,
  categoryNames,
  mailConfigured,
  actions,
}: {
  guests: AdminGuest[];
  categoryNames: Map<string, string>;
  mailConfigured: boolean;
  actions: GuestActions;
}) {
  const [filter, setFilter] = useState<GuestFilter>('all');
  const [adding, setAdding] = useState(false);
  const [link, setLink] = useState<{ guest: AdminGuest; url: string } | null>(null);

  const requests = guests.filter((g) => g.access === 'requested');
  const listed = useMemo(() => guests.filter((g) => g.access !== 'requested'), [guests]);
  const shown = useMemo(
    () => listed.filter((guest) => guestMatchesFilter(guest, filter)),
    [listed, filter],
  );
  const uninvitedWithEmail = listed.filter(
    (g) =>
      g.access === 'invited' &&
      g.email !== '' &&
      (g.inviteStatus === 'none' || g.inviteStatus === 'created'),
  ).length;

  return (
    <div className="space-y-4">
      {requests.length > 0 ? (
        <JoinRequests requests={requests} mailConfigured={mailConfigured} actions={actions} />
      ) : null}

      <RsvpSummaryCard guests={guests} categoryNames={categoryNames} />

      {!mailConfigured ? (
        <p className="rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Email is not set up on the server, so invites and sign-in links cannot be mailed. Use
          <strong> Link</strong> on a guest to copy their personal RSVP link and send it yourself.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setAdding(true)}>
          <UserPlus className="size-4" aria-hidden="true" />
          Add guests
        </Button>
        {mailConfigured ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={uninvitedWithEmail === 0}
            onClick={() => {
              if (confirm(`Email an RSVP invite to ${uninvitedWithEmail} guests?`)) {
                actions.sendInvites({ uninvited: true });
              }
            }}
          >
            <Mail className="size-4" aria-hidden="true" />
            Invite everyone not yet invited ({uninvitedWithEmail})
          </Button>
        ) : null}
      </div>

      <FilterChips value={filter} onChange={setFilter} labels={{ all: `All ${listed.length}` }} />

      {listed.length === 0 ? (
        <p className="text-ink-muted">
          No guests yet. Add your guest list, or wait for people to RSVP or vote.
        </p>
      ) : (
        <Card className="divide-y divide-black/5">
          {shown.map((guest) => (
            <GuestRow
              key={guest.id}
              guest={guest}
              categoryNames={categoryNames}
              mailConfigured={mailConfigured}
              actions={actions}
              onLink={(url) => setLink({ guest, url })}
            />
          ))}
          {shown.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-muted">Nobody matches this filter.</p>
          ) : null}
        </Card>
      )}

      <AddGuestsSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(list) => {
          actions.add(list);
          setAdding(false);
        }}
      />

      <Sheet
        open={link !== null}
        onClose={() => setLink(null)}
        title={link ? `RSVP link for ${link.guest.name}` : 'RSVP link'}
        description="Anyone with this link can edit this guest's RSVP. Making a new one stops the old one working."
      >
        {link ? <LinkBox url={link.url} /> : null}
      </Sheet>
    </div>
  );
}

/** People who asked to join from the RSVP page, waiting on the host. */
function JoinRequests({
  requests,
  mailConfigured,
  actions,
}: {
  requests: AdminGuest[];
  mailConfigured: boolean;
  actions: GuestActions;
}) {
  return (
    <Card className="border-amber-300">
      <div className="border-b border-black/5 px-4 py-3">
        <h2 className="text-lg font-bold">Asking to join ({requests.length})</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          They tried to RSVP with an email that is not on your list.{' '}
          {mailConfigured
            ? 'Approving emails them their RSVP link.'
            : 'After approving, use Link to send them their RSVP link.'}
        </p>
      </div>
      <ul className="divide-y divide-black/5">
        {requests.map((guest) => (
          <li key={guest.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{guest.name}</p>
              <p className="truncate text-sm text-ink-muted">{guest.email}</p>
            </div>
            <Button size="sm" onClick={() => actions.setAccess(guest, 'invited')}>
              <Check className="size-4" aria-hidden="true" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-700"
              onClick={() => actions.setAccess(guest, 'declined')}
            >
              <X className="size-4" aria-hidden="true" />
              Decline
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function GuestRow({
  guest,
  categoryNames,
  mailConfigured,
  actions,
  onLink,
}: {
  guest: AdminGuest;
  categoryNames: Map<string, string>;
  mailConfigured: boolean;
  actions: GuestActions;
  onLink: (url: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(guest.name);
  const [linking, setLinking] = useState(false);
  const status = guest.rsvpStatus;
  const declined = guest.access === 'declined';

  const details = [
    guest.email,
    guest.phone,
    guest.plusOneFirstName ? `+1 ${guest.plusOneFirstName} ${guest.plusOneLastName}` : '',
  ].filter(Boolean);
  const activity = [
    guest.entryCount > 0
      ? `${guest.entryCount} ${guest.entryCount === 1 ? 'entry' : 'entries'}`
      : '',
    guest.tastedCount > 0 ? `${guest.tastedCount} checked off` : '',
    guest.completeVoteCount > 0 ? `${guest.completeVoteCount} rated` : '',
    guest.ballotCount > 0 ? `${guest.ballotCount} nominations` : '',
  ].filter(Boolean);

  function commit() {
    const next = draft.trim();
    setEditing(false);
    if (next.length >= 2 && next !== guest.name) actions.rename(guest, next);
  }

  return (
    <div className="space-y-1.5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commit();
                if (event.key === 'Escape') setEditing(false);
              }}
              aria-label={`New name for ${guest.name}`}
              className="min-w-0 flex-1 rounded-lg border border-black/15 px-2 py-1.5"
            />
            <Button size="sm" onClick={commit}>
              <Check className="size-4" aria-hidden="true" />
              Save
            </Button>
            <Button size="sm" variant="ghost" aria-label="Cancel" onClick={() => setEditing(false)}>
              <X className="size-4" aria-hidden="true" />
            </Button>
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 truncate font-semibold">{guest.name}</p>
            {declined ? (
              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">
                Declined
              </span>
            ) : (
              <span
                className={clsx(
                  'rounded-full border px-2 py-0.5 text-xs font-semibold',
                  RSVP_CLASS[status],
                )}
              >
                {RSVP_LABEL[status]}
              </span>
            )}
          </>
        )}
      </div>

      {details.length > 0 ? (
        <p className="text-sm break-words text-ink-muted">{details.join(' · ')}</p>
      ) : (
        <p className="text-sm text-ink-muted">Walk-in: name only</p>
      )}
      {guest.allergies.length > 0 ? (
        <p className="text-sm">
          <span className="font-semibold">Allergies: </span>
          {guest.allergies.map((id) => labelFor(id).label).join(', ')}
        </p>
      ) : null}
      {guest.preregistrations.length > 0 ? (
        <p className="text-sm">
          <span className="font-semibold">Might enter: </span>
          {guest.preregistrations.map((id) => categoryNames.get(id) ?? id).join(', ')}
        </p>
      ) : null}
      <p className="text-xs text-ink-muted">
        {[guest.email ? INVITE_LABEL[guest.inviteStatus] : '', ...activity]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {!editing && declined ? (
        <div className="-ml-3 flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" onClick={() => actions.setAccess(guest, 'invited')}>
            <Check className="size-4" aria-hidden="true" />
            Let them in
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-700"
            aria-label={`Delete ${guest.name}`}
            onClick={() => actions.remove(guest)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
      {!editing && !declined ? (
        <div className="-ml-3 flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="ghost"
            loading={linking}
            onClick={() => {
              setLinking(true);
              actions
                .inviteLink(guest)
                .then(onLink)
                .catch(() => {})
                .finally(() => setLinking(false));
            }}
          >
            <Link2 className="size-4" aria-hidden="true" />
            Link
          </Button>
          {mailConfigured && guest.email ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => actions.sendInvites({ guestIds: [guest.id] })}
            >
              <Mail className="size-4" aria-hidden="true" />
              {guest.inviteStatus === 'sent' || guest.inviteStatus === 'opened'
                ? 'Resend'
                : 'Email invite'}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(guest.name);
              setEditing(true);
            }}
          >
            <Pencil className="size-4" aria-hidden="true" />
            Rename
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-700"
            aria-label={`Delete ${guest.name}`}
            onClick={() => actions.remove(guest)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The link, selectable, with Copy and (on phones) Share. The clipboard API only
 * exists on https, and a home server is often plain http, so the text box is the
 * part that always works.
 */
function LinkBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  return (
    <div className="space-y-3">
      <input
        readOnly
        value={url}
        aria-label="RSVP link"
        onFocus={(event) => event.target.select()}
        className="w-full rounded-xl border border-black/15 bg-surface-muted px-3 py-2.5 text-sm"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            navigator.clipboard
              ?.writeText(url)
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </Button>
        {canShare ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void navigator.share({ url }).catch(() => {})}
          >
            Share
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function AddGuestsSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (guests: NewGuest[]) => void;
}) {
  const [text, setText] = useState('');
  const parsed = parseGuestLines(text);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add guests"
      description="One guest per line. An email is optional, but it is how invites and sign-in links reach them."
    >
      <div className="space-y-3">
        <TextAreaField
          label="Guest list"
          help="For example: Ann Lee, ann@example.com — or paste straight from a spreadsheet."
          rows={8}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={'Ann Lee, ann@example.com\nBo Chen <bo@example.com>\nCy'}
        />
        {parsed.errors.length > 0 ? (
          <ul className="space-y-1 text-sm text-red-700">
            {parsed.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
        <Button
          className="w-full"
          disabled={parsed.guests.length === 0 || parsed.errors.length > 0}
          onClick={() => {
            onAdd(parsed.guests);
            setText('');
          }}
        >
          Add {parsed.guests.length} {parsed.guests.length === 1 ? 'guest' : 'guests'}
        </Button>
      </div>
    </Sheet>
  );
}
