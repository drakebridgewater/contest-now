import type { AdminGuest, GuestAccess, RsvpStatus } from '@contest/shared';
import { flexRender, type Table } from '@tanstack/react-table';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown, Link2, Mail, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { GuestEditContext } from './guestCells.tsx';
import { ACCESS_LABEL, canEmail, RSVP_LABEL } from './guestFilter.ts';

const RSVP_CLASS: Record<RsvpStatus, string> = {
  yes: 'bg-accent-100 text-accent-700 border-accent-500/30',
  maybe: 'bg-amber-50 text-amber-900 border-amber-300',
  no: 'bg-surface-muted text-ink-muted border-black/10',
  pending: 'bg-white text-ink-muted border-black/15',
};

const ACCESS_CLASS: Record<GuestAccess, string> = {
  invited: 'text-ink-muted',
  requested: 'rounded-full border border-amber-300 bg-amber-50 px-2 text-amber-900 font-semibold',
  declined: 'rounded-full border border-red-200 bg-red-50 px-2 text-red-800 font-semibold',
  walk_in: 'text-ink-muted',
};

export function RsvpBadge({ status }: { status: RsvpStatus }) {
  return (
    <span
      className={clsx(
        'inline-block rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        RSVP_CLASS[status],
      )}
    >
      {RSVP_LABEL[status]}
    </span>
  );
}

export function AccessBadge({ access }: { access: GuestAccess }) {
  return (
    <span className={clsx('inline-block text-xs whitespace-nowrap', ACCESS_CLASS[access])}>
      {ACCESS_LABEL[access]}
    </span>
  );
}

export function Checkbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="size-4 accent-brand-600"
    />
  );
}

export function RowActions({ guest, ctx }: { guest: AdminGuest; ctx: GuestEditContext }) {
  const iconButton =
    'tap-target inline-grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-black/5';
  return (
    <div className="flex justify-end gap-0.5">
      {guest.access !== 'declined' ? (
        <button
          type="button"
          className={iconButton}
          aria-label={`RSVP link for ${guest.name}`}
          title="Copy their personal RSVP link"
          onClick={() => ctx.openLink(guest)}
        >
          <Link2 className="size-4" aria-hidden="true" />
        </button>
      ) : (
        <span className="block size-8 shrink-0" aria-hidden="true" />
      )}
      {ctx.mailConfigured && canEmail(guest) ? (
        <button
          type="button"
          className={iconButton}
          aria-label={`Email invite to ${guest.name}`}
          title={
            guest.inviteStatus === 'sent' || guest.inviteStatus === 'opened'
              ? 'Resend invite'
              : 'Email invite'
          }
          onClick={() => ctx.sendInvite(guest)}
        >
          <Mail className="size-4" aria-hidden="true" />
        </button>
      ) : ctx.mailConfigured ? (
        // Keeps the icons in the same columns from row to row.
        <span className="block size-8 shrink-0" aria-hidden="true" />
      ) : null}
      <button
        type="button"
        className={clsx(iconButton, 'text-red-700')}
        aria-label={`Delete ${guest.name}`}
        title="Delete"
        onClick={() => ctx.remove([guest])}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

const STICKY: Record<string, string> = {
  select: 'sticky left-0 z-[1] w-10',
  name: 'sticky left-10 z-[1] min-w-36 shadow-[1px_0_0_rgba(0,0,0,0.06)]',
  actions: 'sticky right-0 z-[1] shadow-[-1px_0_0_rgba(0,0,0,0.06)]',
};
const WIDTH: Record<string, string> = {
  email: 'min-w-48',
  phone: 'min-w-28',
  rsvpStatus: 'min-w-28',
  plusOne: 'min-w-32',
  allergies: 'min-w-28 max-w-48',
  preregistrations: 'min-w-28 max-w-48',
};

/** The wide-screen guest list: a sortable table whose cells edit in place. */
export function GuestTable({ table }: { table: Table<AdminGuest> }) {
  return (
    // Wider than the page's reading column on big screens, centred on it, so
    // most columns fit without scrolling sideways.
    <div className="relative overflow-x-auto rounded-card border border-black/5 bg-surface shadow-sm lg:left-1/2 lg:w-[min(96vw,84rem)] lg:-translate-x-1/2">
      <table className="w-full border-collapse text-sm">
        <thead className="border-b border-black/10 bg-surface-muted text-left text-xs font-semibold text-ink-muted">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined
                    }
                    className={clsx(
                      'bg-surface-muted px-2 py-2 whitespace-nowrap',
                      header.id === 'select' && 'pl-3',
                      STICKY[header.id],
                    )}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-black/5"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === 'asc' ? (
                          <ArrowUp className="size-3.5" aria-hidden="true" />
                        ) : sorted === 'desc' ? (
                          <ArrowDown className="size-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-40" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      <span className="px-2">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-black/5">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              aria-selected={row.getIsSelected()}
              className={clsx(
                'group',
                row.original.access === 'requested' && 'bg-amber-50/60',
                row.getIsSelected() && 'bg-brand-50',
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={clsx(
                    'px-1 py-1 align-middle',
                    cell.column.id === 'select' && 'pl-3',
                    STICKY[cell.column.id] && [
                      STICKY[cell.column.id],
                      row.getIsSelected()
                        ? 'bg-brand-50'
                        : row.original.access === 'requested'
                          ? 'bg-amber-50'
                          : 'bg-surface',
                    ],
                    WIDTH[cell.column.id],
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
