import { labelFor, RSVP_STATUSES, type AdminGuest } from '@contest/shared';
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type RowSelectionState,
  type SortingState,
  type Table,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import {
  ListCell,
  PlusOneCell,
  ReadOnly,
  SelectCell,
  TextCell,
  type GuestEditContext,
} from './guestCells.tsx';
import { activityText, inviteLabel, RSVP_LABEL, RSVP_ORDER } from './guestFilter.ts';
import { AccessBadge, Checkbox, RowActions, RsvpBadge } from './GuestTable.tsx';

const RSVP_OPTIONS = RSVP_STATUSES.map((id) => [id, RSVP_LABEL[id]] as const);
const ACCESS_OPTIONS = [
  ['invited', 'On the list'],
  ['declined', 'Declined'],
] as const;

const column = createColumnHelper<AdminGuest>();

/**
 * One table instance drives both the wide table and the phone cards, so
 * sorting and the ticked rows carry over when the window is resized.
 */
export function useGuestTable(
  guests: AdminGuest[],
  ctx: GuestEditContext,
  rowSelection: RowSelectionState,
  setRowSelection: (next: RowSelectionState) => void,
): Table<AdminGuest> {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const { categoryNames } = ctx;

  const columns = useMemo(
    () => [
      column.display({
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            label="Select all shown"
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={(checked) => table.toggleAllRowsSelected(checked)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            label={`Select ${row.original.name}`}
            checked={row.getIsSelected()}
            onChange={(checked) => row.toggleSelected(checked)}
          />
        ),
      }),
      column.accessor('name', {
        header: 'Name',
        sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
        cell: ({ row }) => <TextCell guest={row.original} field="name" label="Name" ctx={ctx} />,
      }),
      column.accessor('email', {
        header: 'Email',
        cell: ({ row }) => (
          <TextCell guest={row.original} field="email" label="Email" type="email" ctx={ctx} />
        ),
      }),
      column.accessor('phone', {
        header: 'Phone',
        enableSorting: false,
        cell: ({ row }) => (
          <TextCell guest={row.original} field="phone" label="Phone" type="tel" ctx={ctx} />
        ),
      }),
      column.accessor('rsvpStatus', {
        header: 'RSVP',
        sortingFn: (a, b) => RSVP_ORDER[a.original.rsvpStatus] - RSVP_ORDER[b.original.rsvpStatus],
        cell: ({ row }) => {
          const guest = row.original;
          return (
            <SelectCell
              guest={guest}
              label="RSVP"
              value={guest.rsvpStatus}
              display={<RsvpBadge status={guest.rsvpStatus} />}
              options={RSVP_OPTIONS}
              onPick={(next) => void ctx.update(guest, { rsvpStatus: next })}
            />
          );
        },
      }),
      column.accessor((g) => `${g.plusOneFirstName} ${g.plusOneLastName}`.trim(), {
        id: 'plusOne',
        header: 'Plus-one',
        enableSorting: false,
        cell: ({ row }) => <PlusOneCell guest={row.original} ctx={ctx} />,
      }),
      column.accessor('allergies', {
        header: 'Allergies',
        enableSorting: false,
        cell: ({ row }) => (
          <ListCell
            guest={row.original}
            field="allergies"
            label="Allergies"
            items={row.original.allergies.map((id) => labelFor(id).label)}
            ctx={ctx}
          />
        ),
      }),
      column.accessor('preregistrations', {
        header: 'Might enter',
        enableSorting: false,
        cell: ({ row }) => (
          <ListCell
            guest={row.original}
            field="preregistrations"
            label="Might enter"
            items={row.original.preregistrations.map((id) => categoryNames.get(id) ?? id)}
            ctx={ctx}
          />
        ),
      }),
      column.accessor((g) => inviteLabel(g), {
        id: 'invite',
        header: 'Invite',
        cell: ({ getValue }) => (
          <ReadOnly className="text-sm whitespace-nowrap">{getValue()}</ReadOnly>
        ),
      }),
      column.accessor('access', {
        header: 'Access',
        cell: ({ row }) => {
          const guest = row.original;
          return (
            <SelectCell
              guest={guest}
              label="Access"
              value={guest.access}
              display={<AccessBadge access={guest.access} />}
              options={ACCESS_OPTIONS}
              onPick={(next) => {
                if (next === 'invited' || next === 'declined') ctx.setAccess([guest], next);
              }}
            />
          );
        },
      }),
      column.accessor((g) => g.entryCount + g.completeVoteCount + g.ballotCount + g.tastedCount, {
        id: 'activity',
        header: 'Activity',
        sortDescFirst: true,
        cell: ({ row }) => (
          <ReadOnly className="text-xs whitespace-nowrap">
            {activityText(row.original) || '—'}
          </ReadOnly>
        ),
      }),
      column.display({
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => <RowActions guest={row.original} ctx={ctx} />,
      }),
    ],
    [ctx, categoryNames],
  );

  // TanStack Table returns fresh functions each render; the compiler skipping this hook is fine.
  // eslint-disable-next-line react-hooks/incompatible-library
  return useReactTable({
    data: guests,
    columns,
    state: { sorting, rowSelection },
    getRowId: (guest) => guest.id,
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) =>
      setRowSelection(typeof updater === 'function' ? updater(rowSelection) : updater),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
}
