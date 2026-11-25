import {
  AdminUpdateGuestSchema,
  parseGuestLines,
  RSVP_STATUSES,
  type AdminGuest,
  type AdminUpdateGuest,
  type CustomEmail,
  type NewGuest,
  type RsvpStatus,
} from '@contest/shared';
import type { RowSelectionState } from '@tanstack/react-table';
import { Mail, Search, Send, Trash2, UserPlus, X } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { rsvpTotals } from '../../lib/rsvpTotals.ts';
import { useMediaQuery } from '../../lib/useMediaQuery.ts';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';
import { TextAreaField } from '../ui/Field.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { GuestCards, GuestEditSheet, GuestListSheet } from './GuestCards.tsx';
import type { GuestEditContext } from './guestCells.tsx';
import { accessWarning, deleteWarning, emailWarning, rsvpWarning } from './guestEdits.ts';
import {
  ACCESS_LABEL,
  canEmail,
  guestMatches,
  INVITE_FILTERS,
  isFiltered,
  NO_FILTERS,
  RSVP_LABEL,
  type GuestFilters,
  type InviteFilter,
} from './guestFilter.ts';
import { GuestTable } from './GuestTable.tsx';
import { useGuestTable } from './useGuestTable.tsx';

// The rich-text editor is only for the host, so guests' phones never download it.
const EmailComposer = lazy(() =>
  import('./EmailComposer.tsx').then((module) => ({ default: module.EmailComposer })),
);

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

/**
 * What the Guests tab asks the page to do. Confirmations happen in the tab, so
 * these just perform the change.
 */
export interface GuestActions {
  add: (guests: NewGuest[]) => void;
  /** Resolves to a fresh personal RSVP link; the previous one stops working. */
  inviteLink: (guest: AdminGuest) => Promise<string>;
  sendInvites: (guestIds: string[]) => void;
  update: (guests: AdminGuest[], patch: AdminUpdateGuest) => void;
  /** Let people in (emailing their invite when mail works) or turn them away. */
  setAccess: (guests: AdminGuest[], access: 'invited' | 'declined') => void;
  remove: (guests: AdminGuest[]) => void;
  sendEmail: (email: CustomEmail) => void;
}

/** Only the fields that differ from what the guest already has. */
function changedFields(guest: AdminGuest, patch: AdminUpdateGuest): AdminUpdateGuest {
  return Object.fromEntries(
    Object.entries(patch).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(guest[key as keyof AdminGuest]),
    ),
  ) as AdminUpdateGuest;
}

export function GuestsTab({
  guests,
  categoryNames,
  mailConfigured,
  hasPhotoAlbum,
  sending,
  actions,
}: {
  guests: AdminGuest[];
  categoryNames: Map<string, string>;
  mailConfigured: boolean;
  hasPhotoAlbum: boolean;
  sending: boolean;
  actions: GuestActions;
}) {
  const wide = useMediaQuery('(min-width: 768px)');
  const [filters, setFilters] = useState<GuestFilters>(NO_FILTERS);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [adding, setAdding] = useState(false);
  const [composing, setComposing] = useState(false);
  const [link, setLink] = useState<{ guest: AdminGuest; url: string } | null>(null);
  const [editing, setEditing] = useState<AdminGuest | null>(null);
  const [listEdit, setListEdit] = useState<{
    guest: AdminGuest;
    field: 'allergies' | 'preregistrations';
  } | null>(null);

  const shown = useMemo(() => guests.filter((g) => guestMatches(g, filters)), [guests, filters]);
  const requests = guests.filter((g) => g.access === 'requested').length;

  const ctx = useMemo<GuestEditContext>(
    () => ({
      mailConfigured,
      categoryNames,
      update: (guest, patch) => {
        const changes = changedFields(guest, patch);
        if (Object.keys(changes).length === 0) return undefined;
        const parsed = AdminUpdateGuestSchema.safeParse(changes);
        if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Check this value';
        const warning =
          (changes.rsvpStatus ? rsvpWarning([guest], changes.rsvpStatus) : null) ??
          (changes.email !== undefined ? emailWarning(guest, parsed.data.email ?? '') : null);
        if (warning && !confirm(warning)) return undefined;
        actions.update([guest], parsed.data);
        return undefined;
      },
      setAccess: (list, access) => {
        const warning = accessWarning(list, access, mailConfigured);
        if (warning === null || !confirm(warning)) return;
        actions.setAccess(
          list.filter((g) => g.access !== access),
          access,
        );
      },
      editList: (guest, field) => setListEdit({ guest, field }),
      editGuest: setEditing,
      openLink: (guest) => {
        actions
          .inviteLink(guest)
          .then((url) => setLink({ guest, url }))
          .catch(() => {});
      },
      sendInvite: (guest) => {
        const again = guest.inviteStatus === 'sent' || guest.inviteStatus === 'opened';
        if (
          !confirm(`${again ? 'Resend' : 'Email'} ${guest.name}’s RSVP invite to ${guest.email}?`)
        )
          return;
        actions.sendInvites([guest.id]);
      },
      remove: (list) => {
        if (!confirm(deleteWarning(list))) return;
        actions.remove(list);
        setRowSelection({});
      },
    }),
    [actions, categoryNames, mailConfigured],
  );

  const table = useGuestTable(shown, ctx, rowSelection, setRowSelection);
  // Only rows still on screen count, so a filter never hides who an action hits.
  const selected = table.getSelectedRowModel().rows.map((row) => row.original);

  return (
    <div className="space-y-4">
      <RsvpSummaryCard guests={guests} categoryNames={categoryNames} />

      {requests > 0 && filters.access !== 'requested' ? (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="flex-1">
            <strong>
              {requests} {requests === 1 ? 'person is' : 'people are'} asking to join.
            </strong>{' '}
            They tried to RSVP with an email that is not on your list.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setFilters({ ...NO_FILTERS, access: 'requested' })}
          >
            Show them
          </Button>
        </div>
      ) : null}

      {!mailConfigured ? (
        <p className="rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Email is not set up on the server, so invites and sign-in links cannot be mailed. Use the
          link button on a guest to copy their personal RSVP link and send it yourself.
        </p>
      ) : null}

      <FilterBar
        filters={filters}
        onChange={(next) => setFilters(next)}
        onAdd={() => setAdding(true)}
        shown={shown.length}
        total={guests.length}
      />

      {selected.length > 0 ? (
        <BulkBar
          selected={selected}
          mailConfigured={mailConfigured}
          onClear={() => setRowSelection({})}
          onInvite={() => {
            const to = selected.filter(canEmail);
            const left = selected.length - to.length;
            if (
              to.length === 0 ||
              !confirm(
                `Email an RSVP invite to ${to.length} ${to.length === 1 ? 'guest' : 'guests'}?` +
                  (left > 0 ? ` ${left} without an email or not on the list are left out.` : ''),
              )
            )
              return;
            actions.sendInvites(to.map((g) => g.id));
          }}
          onEmail={() => setComposing(true)}
          onRsvp={(status) => {
            const warning = rsvpWarning(selected, status);
            if (warning && !confirm(warning)) return;
            actions.update(
              selected.filter((g) => g.rsvpStatus !== status),
              { rsvpStatus: status },
            );
          }}
          onAccess={(access) => ctx.setAccess(selected, access)}
          onDelete={() => ctx.remove(selected)}
        />
      ) : null}

      {guests.length === 0 ? (
        <p className="text-ink-muted">
          No guests yet. Add your guest list, or wait for people to RSVP or vote.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-ink-muted">
          Nobody matches these filters.{' '}
          <button
            type="button"
            className="font-semibold text-brand-700 underline"
            onClick={() => setFilters(NO_FILTERS)}
          >
            Clear filters
          </button>
        </p>
      ) : wide ? (
        <GuestTable table={table} />
      ) : (
        <>
          <label className="flex items-center gap-2 px-1 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-5 accent-brand-600"
              checked={table.getIsAllRowsSelected()}
              onChange={(event) => table.toggleAllRowsSelected(event.target.checked)}
            />
            Select all {shown.length}
          </label>
          <GuestCards table={table} ctx={ctx} />
        </>
      )}

      <AddGuestsSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(list) => {
          actions.add(list);
          setAdding(false);
        }}
      />

      <GuestEditSheet guest={editing} ctx={ctx} onClose={() => setEditing(null)} />
      <GuestListSheet target={listEdit} ctx={ctx} onClose={() => setListEdit(null)} />

      <Sheet
        open={link !== null}
        onClose={() => setLink(null)}
        title={link ? `RSVP link for ${link.guest.name}` : 'RSVP link'}
        description="Anyone with this link can edit this guest's RSVP. Making a new one stops the old one working."
      >
        {link ? <LinkBox url={link.url} /> : null}
      </Sheet>

      <Sheet open={composing} onClose={() => setComposing(false)} title="Email selected guests">
        {composing ? (
          <Suspense fallback={<p className="text-ink-muted">Loading editor…</p>}>
            <EmailComposer
              recipients={selected.filter(canEmail)}
              skipped={selected.filter((g) => !canEmail(g)).length}
              mailConfigured={mailConfigured}
              hasPhotoAlbum={hasPhotoAlbum}
              sending={sending}
              onSend={(email) => {
                actions.sendEmail(email);
                setComposing(false);
              }}
            />
          </Suspense>
        ) : null}
      </Sheet>
    </div>
  );
}

const selectClass =
  'rounded-xl border border-black/15 bg-white px-3 py-2 text-sm font-semibold text-ink';

function FilterBar({
  filters,
  onChange,
  onAdd,
  shown,
  total,
}: {
  filters: GuestFilters;
  onChange: (filters: GuestFilters) => void;
  onAdd: () => void;
  shown: number;
  total: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Search guests</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={filters.search}
            placeholder="Search name, email, phone"
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            className="w-full rounded-xl border border-black/15 bg-white py-2 pr-3 pl-9 text-sm"
          />
        </label>
        <Button size="sm" onClick={onAdd}>
          <UserPlus className="size-4" aria-hidden="true" />
          Add guests
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="RSVP"
          value={filters.rsvp}
          onChange={(event) =>
            onChange({ ...filters, rsvp: event.target.value as GuestFilters['rsvp'] })
          }
          className={selectClass}
        >
          <option value="all">Any RSVP</option>
          {RSVP_STATUSES.map((id) => (
            <option key={id} value={id}>
              {RSVP_LABEL[id]}
            </option>
          ))}
        </select>
        <select
          aria-label="Invite"
          value={filters.invite}
          onChange={(event) => onChange({ ...filters, invite: event.target.value as InviteFilter })}
          className={selectClass}
        >
          {INVITE_FILTERS.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Access"
          value={filters.access}
          onChange={(event) =>
            onChange({ ...filters, access: event.target.value as GuestFilters['access'] })
          }
          className={selectClass}
        >
          <option value="all">Anyone</option>
          {(Object.keys(ACCESS_LABEL) as (keyof typeof ACCESS_LABEL)[]).map((id) => (
            <option key={id} value={id}>
              {ACCESS_LABEL[id]}
            </option>
          ))}
        </select>
        <p className="ml-auto text-sm text-ink-muted" aria-live="polite">
          {isFiltered(filters) ? `${shown} of ${total} guests` : `${total} guests`}
        </p>
        {isFiltered(filters) ? (
          <Button size="sm" variant="ghost" onClick={() => onChange(NO_FILTERS)}>
            <X className="size-4" aria-hidden="true" />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function BulkBar({
  selected,
  mailConfigured,
  onClear,
  onInvite,
  onEmail,
  onRsvp,
  onAccess,
  onDelete,
}: {
  selected: AdminGuest[];
  mailConfigured: boolean;
  onClear: () => void;
  onInvite: () => void;
  onEmail: () => void;
  onRsvp: (status: RsvpStatus) => void;
  onAccess: (access: 'invited' | 'declined') => void;
  onDelete: () => void;
}) {
  const emailable = selected.filter(canEmail).length;
  return (
    <div
      role="toolbar"
      aria-label="Selected guests"
      style={{ top: 'calc(var(--header-h, 4rem) + 0.5rem)' }}
      className="sticky z-20 flex flex-wrap items-center gap-2 rounded-card border border-brand-200 bg-brand-50 px-3 py-2 shadow-sm"
    >
      <p className="text-sm font-semibold">{selected.length} selected</p>
      {mailConfigured ? (
        <Button size="sm" variant="secondary" disabled={emailable === 0} onClick={onInvite}>
          <Send className="size-4" aria-hidden="true" />
          Send invite
        </Button>
      ) : null}
      <Button size="sm" variant="secondary" disabled={emailable === 0} onClick={onEmail}>
        <Mail className="size-4" aria-hidden="true" />
        Email…
      </Button>
      <select
        aria-label="Set RSVP for selected"
        value=""
        onChange={(event) => {
          if (event.target.value) onRsvp(event.target.value as RsvpStatus);
        }}
        className={selectClass}
      >
        <option value="">Set RSVP…</option>
        {RSVP_STATUSES.map((id) => (
          <option key={id} value={id}>
            {RSVP_LABEL[id]}
          </option>
        ))}
      </select>
      <select
        aria-label="Set access for selected"
        value=""
        onChange={(event) => {
          const value = event.target.value;
          if (value === 'invited' || value === 'declined') onAccess(value);
        }}
        className={selectClass}
      >
        <option value="">Set access…</option>
        <option value="invited">Let in</option>
        <option value="declined">Decline</option>
      </select>
      <Button size="sm" variant="ghost" className="text-red-700" onClick={onDelete}>
        <Trash2 className="size-4" aria-hidden="true" />
        Delete
      </Button>
      <Button size="sm" variant="ghost" className="ml-auto" onClick={onClear}>
        Clear
      </Button>
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
