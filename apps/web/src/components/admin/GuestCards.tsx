import {
  labelFor,
  RSVP_STATUSES,
  type AdminGuest,
  type AdminUpdateGuest,
  type RsvpStatus,
} from '@contest/shared';
import type { Table } from '@tanstack/react-table';
import clsx from 'clsx';
import { Check, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { AllergenPicker } from '../submit/AllergenPicker.tsx';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';
import { TextField } from '../ui/Field.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import type { GuestEditContext } from './guestCells.tsx';
import { activityText, inviteLabel, RSVP_LABEL } from './guestFilter.ts';
import { AccessBadge, RowActions, RsvpBadge } from './GuestTable.tsx';

/** The phone guest list: the same rows and ticks as the table, as cards. */
export function GuestCards({ table, ctx }: { table: Table<AdminGuest>; ctx: GuestEditContext }) {
  const rows = table.getRowModel().rows;
  return (
    <Card className="divide-y divide-black/5">
      {rows.map((row) => {
        const guest = row.original;
        const details = [
          guest.email,
          guest.phone,
          guest.plusOneFirstName ? `+1 ${guest.plusOneFirstName} ${guest.plusOneLastName}` : '',
        ].filter(Boolean);
        return (
          <div
            key={row.id}
            className={clsx(
              'flex gap-3 px-4 py-3',
              guest.access === 'requested' && 'bg-amber-50/60',
              row.getIsSelected() && 'bg-brand-50',
            )}
          >
            <input
              type="checkbox"
              aria-label={`Select ${guest.name}`}
              checked={row.getIsSelected()}
              onChange={(event) => row.toggleSelected(event.target.checked)}
              className="mt-1 size-5 shrink-0 accent-brand-600"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 truncate font-semibold">{guest.name}</p>
                {guest.access === 'invited' ? (
                  <RsvpBadge status={guest.rsvpStatus} />
                ) : (
                  <AccessBadge access={guest.access} />
                )}
              </div>
              <p className="text-sm break-words text-ink-muted">
                {details.length > 0 ? details.join(' · ') : 'Name only'}
              </p>
              {guest.allergies.length > 0 ? (
                <p className="text-sm">
                  <span className="font-semibold">Allergies: </span>
                  {guest.allergies.map((id) => labelFor(id).label).join(', ')}
                </p>
              ) : null}
              {guest.preregistrations.length > 0 ? (
                <p className="text-sm">
                  <span className="font-semibold">Might enter: </span>
                  {guest.preregistrations.map((id) => ctx.categoryNames.get(id) ?? id).join(', ')}
                </p>
              ) : null}
              <p className="text-xs text-ink-muted">
                {[`Invite: ${inviteLabel(guest)}`, activityText(guest)].filter(Boolean).join(' · ')}
              </p>
              <div className="-ml-2 flex flex-wrap items-center gap-1">
                {guest.access === 'requested' || guest.access === 'declined' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => ctx.setAccess([guest], 'invited')}
                  >
                    <Check className="size-4" aria-hidden="true" />
                    {guest.access === 'requested' ? 'Approve' : 'Let them in'}
                  </Button>
                ) : null}
                {guest.access === 'requested' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-700"
                    onClick={() => ctx.setAccess([guest], 'declined')}
                  >
                    <X className="size-4" aria-hidden="true" />
                    Decline
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Edit ${guest.name}`}
                  onClick={() => ctx.editGuest(guest)}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit
                </Button>
                <div className="ml-auto">
                  <RowActions guest={guest} ctx={ctx} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

/**
 * Every editable field of one guest, for phones where a wide table does not fit.
 * Saving sends only what changed, through the same warnings as the table.
 */
export function GuestEditSheet({
  guest,
  ctx,
  onClose,
}: {
  guest: AdminGuest | null;
  ctx: GuestEditContext;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={guest !== null}
      onClose={onClose}
      title={guest ? `Edit ${guest.name}` : 'Edit guest'}
    >
      {guest ? <GuestForm key={guest.id} guest={guest} ctx={ctx} onDone={onClose} /> : null}
    </Sheet>
  );
}

function GuestForm({
  guest,
  ctx,
  onDone,
}: {
  guest: AdminGuest;
  ctx: GuestEditContext;
  onDone: () => void;
}) {
  const [name, setName] = useState(guest.name);
  const [email, setEmail] = useState(guest.email);
  const [phone, setPhone] = useState(guest.phone);
  const [rsvpStatus, setRsvp] = useState<RsvpStatus>(guest.rsvpStatus);
  const [plusOneFirstName, setFirst] = useState(guest.plusOneFirstName);
  const [plusOneLastName, setLast] = useState(guest.plusOneLastName);
  const [allergies, setAllergies] = useState(guest.allergies);
  const [preregistrations, setPrereg] = useState(guest.preregistrations);
  const [error, setError] = useState<string | undefined>();

  function save() {
    const draft: AdminUpdateGuest = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      rsvpStatus,
      plusOneFirstName: plusOneFirstName.trim(),
      plusOneLastName: plusOneLastName.trim(),
      allergies,
      preregistrations,
    };
    const patch = Object.fromEntries(
      Object.entries(draft).filter(
        ([key, value]) => JSON.stringify(value) !== JSON.stringify(guest[key as keyof AdminGuest]),
      ),
    ) as AdminUpdateGuest;
    if (Object.keys(patch).length === 0) {
      onDone();
      return;
    }
    const problem = ctx.update(guest, patch);
    if (problem) setError(problem);
    else onDone();
  }

  return (
    <div className="space-y-3">
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <TextField
        label="Email"
        type="email"
        value={email}
        help={
          guest.email ? 'Changing it cancels the invite link sent to the old address.' : undefined
        }
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        label="Phone"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <label className="block space-y-1">
        <span className="text-sm font-semibold">RSVP</span>
        <select
          value={rsvpStatus}
          onChange={(e) => setRsvp(e.target.value as RsvpStatus)}
          className="w-full rounded-xl border border-black/15 bg-white px-3 py-2.5"
        >
          {RSVP_STATUSES.map((id) => (
            <option key={id} value={id}>
              {RSVP_LABEL[id]}
            </option>
          ))}
        </select>
        {guest.rsvpStatus !== 'pending' ? (
          <span className="block text-xs text-ink-muted">This is {guest.name}’s own answer.</span>
        ) : null}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <TextField
          label="Plus-one first name"
          value={plusOneFirstName}
          onChange={(e) => setFirst(e.target.value)}
        />
        <TextField
          label="Plus-one last name"
          value={plusOneLastName}
          onChange={(e) => setLast(e.target.value)}
        />
      </div>
      <AllergenPicker for="host" selected={allergies} onChange={setAllergies} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Might enter</legend>
        <CategoryChips
          categoryNames={ctx.categoryNames}
          selected={preregistrations}
          onChange={setPrereg}
        />
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <Button className="w-full" onClick={save}>
        Save
      </Button>
    </div>
  );
}

function CategoryChips({
  categoryNames,
  selected,
  onChange,
}: {
  categoryNames: Map<string, string>;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (categoryNames.size === 0) return <p className="text-sm text-ink-muted">No categories yet.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {[...categoryNames].map(([id, name]) => {
        const on = selected.includes(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((s) => s !== id) : [...selected, id])}
            className={clsx(
              'tap-target rounded-full border px-3 py-1.5 text-sm font-medium',
              on ? 'border-brand-600 bg-brand-600 text-white' : 'border-black/15 bg-white text-ink',
            )}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

/** The table's allergies and might-enter cells open this to pick from chips. */
export function GuestListSheet({
  target,
  ctx,
  onClose,
}: {
  target: { guest: AdminGuest; field: 'allergies' | 'preregistrations' } | null;
  ctx: GuestEditContext;
  onClose: () => void;
}) {
  const title = target
    ? `${target.field === 'allergies' ? 'Allergies' : 'Might enter'}: ${target.guest.name}`
    : 'Edit';
  return (
    <Sheet open={target !== null} onClose={onClose} title={title}>
      {target ? (
        <ListForm
          key={`${target.guest.id}-${target.field}`}
          {...target}
          ctx={ctx}
          onDone={onClose}
        />
      ) : null}
    </Sheet>
  );
}

function ListForm({
  guest,
  field,
  ctx,
  onDone,
}: {
  guest: AdminGuest;
  field: 'allergies' | 'preregistrations';
  ctx: GuestEditContext;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState(guest[field]);
  const [error, setError] = useState<string | undefined>();
  return (
    <div className="space-y-3">
      {field === 'allergies' ? (
        <AllergenPicker for="host" selected={selected} onChange={setSelected} />
      ) : (
        <CategoryChips
          categoryNames={ctx.categoryNames}
          selected={selected}
          onChange={setSelected}
        />
      )}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <Button
        className="w-full"
        onClick={() => {
          const same = [...selected].sort().join() === [...guest[field]].sort().join();
          const problem = same ? undefined : ctx.update(guest, { [field]: selected });
          if (problem) setError(problem);
          else onDone();
        }}
      >
        Save
      </Button>
    </div>
  );
}
