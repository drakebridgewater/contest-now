import type { AdminGuest, AdminUpdateGuest } from '@contest/shared';
import clsx from 'clsx';
import { useRef, useState, type ReactNode } from 'react';

/**
 * What the guest table and cards need to change a guest. `update` validates,
 * asks before overwriting what is not the host's (see guestEdits.ts), then saves.
 * It returns a message to show next to the field, or undefined when the edit is
 * finished (saved, unchanged, or cancelled at the warning).
 */
export interface GuestEditContext {
  mailConfigured: boolean;
  categoryNames: Map<string, string>;
  update: (guest: AdminGuest, patch: AdminUpdateGuest) => string | undefined;
  setAccess: (guests: AdminGuest[], access: 'invited' | 'declined') => void;
  editList: (guest: AdminGuest, field: 'allergies' | 'preregistrations') => void;
  editGuest: (guest: AdminGuest) => void;
  openLink: (guest: AdminGuest) => void;
  sendInvite: (guest: AdminGuest) => void;
  remove: (guests: AdminGuest[]) => void;
}

const displayClass =
  'block w-full min-h-8 cursor-text rounded-md px-2 py-1 text-left hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-600';
const inputClass =
  'w-full min-w-0 rounded-md border border-brand-500 bg-white px-2 py-1 text-sm focus:outline-2 focus:outline-brand-600';

function Empty() {
  return <span className="text-ink-muted/60">—</span>;
}

/** A cell that shows its value and turns into an editor when clicked (or Enter on it). */
function CellButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={displayClass}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ErrorText({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} role="alert" className="mt-1 text-xs whitespace-normal text-red-700">
      {error}
    </p>
  ) : null;
}

/**
 * A text field cell. Enter or leaving the field saves; Escape puts it back.
 * A validation error keeps the editor open on Enter, and reverts when you leave.
 */
export function TextCell({
  guest,
  field,
  label,
  type = 'text',
  ctx,
}: {
  guest: AdminGuest;
  field: 'name' | 'email' | 'phone';
  label: string;
  type?: 'text' | 'email' | 'tel';
  ctx: GuestEditContext;
}) {
  const value = guest[field];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | undefined>();
  // confirm() steals focus, so the blur it causes must not commit a second time.
  const busy = useRef(false);

  function start() {
    setDraft(value);
    setError(undefined);
    setEditing(true);
  }

  function commit(fromBlur: boolean) {
    if (busy.current) return;
    busy.current = true;
    const next = draft.trim();
    const problem = next === value ? undefined : ctx.update(guest, { [field]: next });
    busy.current = false;
    if (problem && !fromBlur) {
      setError(problem);
      return;
    }
    setEditing(false);
  }

  if (!editing) {
    return (
      <CellButton label={`Edit ${label.toLowerCase()} for ${guest.name}`} onClick={start}>
        {value === '' ? <Empty /> : <span className="block truncate">{value}</span>}
      </CellButton>
    );
  }
  const errorId = `${guest.id}-${field}-error`;
  return (
    <div>
      <input
        autoFocus
        type={type}
        value={draft}
        aria-label={`${label} for ${guest.name}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(false);
          if (event.key === 'Escape') setEditing(false);
        }}
        onBlur={() => commit(true)}
        className={inputClass}
      />
      <ErrorText id={errorId} error={error} />
    </div>
  );
}

/** A dropdown cell. Picking an option saves at once; leaving it unchanged closes it. */
export function SelectCell<T extends string>({
  guest,
  label,
  value,
  display,
  options,
  onPick,
}: {
  guest: AdminGuest;
  label: string;
  value: T;
  display: ReactNode;
  options: readonly (readonly [T, string])[];
  onPick: (value: T) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <CellButton
        label={`Edit ${label.toLowerCase()} for ${guest.name}`}
        onClick={() => setEditing(true)}
      >
        {display}
      </CellButton>
    );
  }
  const known = options.some(([id]) => id === value);
  return (
    <select
      autoFocus
      aria-label={`${label} for ${guest.name}`}
      value={value}
      onChange={(event) => {
        setEditing(false);
        const next = event.target.value as T;
        if (next !== value) onPick(next);
      }}
      onBlur={() => setEditing(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setEditing(false);
      }}
      className={inputClass}
    >
      {known ? null : (
        <option value={value} disabled>
          {display}
        </option>
      )}
      {options.map(([id, text]) => (
        <option key={id} value={id}>
          {text}
        </option>
      ))}
    </select>
  );
}

/** First and last name together, since the server wants both or neither. */
export function PlusOneCell({ guest, ctx }: { guest: AdminGuest; ctx: GuestEditContext }) {
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState(guest.plusOneFirstName);
  const [last, setLast] = useState(guest.plusOneLastName);
  const [error, setError] = useState<string | undefined>();
  const busy = useRef(false);
  const current = `${guest.plusOneFirstName} ${guest.plusOneLastName}`.trim();

  function start() {
    setFirst(guest.plusOneFirstName);
    setLast(guest.plusOneLastName);
    setError(undefined);
    setEditing(true);
  }

  function commit(fromBlur: boolean) {
    if (busy.current) return;
    busy.current = true;
    const patch = { plusOneFirstName: first.trim(), plusOneLastName: last.trim() };
    const unchanged =
      patch.plusOneFirstName === guest.plusOneFirstName &&
      patch.plusOneLastName === guest.plusOneLastName;
    const problem = unchanged ? undefined : ctx.update(guest, patch);
    busy.current = false;
    if (problem && !fromBlur) {
      setError(problem);
      return;
    }
    setEditing(false);
  }

  if (!editing) {
    return (
      <CellButton label={`Edit plus-one for ${guest.name}`} onClick={start}>
        {current === '' ? <Empty /> : <span className="block truncate">{current}</span>}
      </CellButton>
    );
  }
  const errorId = `${guest.id}-plus-one-error`;
  const keys = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') commit(false);
    if (event.key === 'Escape') setEditing(false);
  };
  return (
    <div
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) commit(true);
      }}
    >
      <div className="flex gap-1">
        <input
          autoFocus
          value={first}
          placeholder="First"
          aria-label={`Plus-one first name for ${guest.name}`}
          onChange={(event) => setFirst(event.target.value)}
          onKeyDown={keys}
          className={inputClass}
        />
        <input
          value={last}
          placeholder="Last"
          aria-label={`Plus-one last name for ${guest.name}`}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => setLast(event.target.value)}
          onKeyDown={keys}
          className={inputClass}
        />
      </div>
      <ErrorText id={errorId} error={error} />
    </div>
  );
}

/** Allergies or might-enter categories; edited in a sheet of chips. */
export function ListCell({
  guest,
  field,
  label,
  items,
  ctx,
}: {
  guest: AdminGuest;
  field: 'allergies' | 'preregistrations';
  label: string;
  items: string[];
  ctx: GuestEditContext;
}) {
  return (
    <CellButton
      label={`Edit ${label.toLowerCase()} for ${guest.name}`}
      onClick={() => ctx.editList(guest, field)}
    >
      {items.length === 0 ? <Empty /> : <span className="block truncate">{items.join(', ')}</span>}
    </CellButton>
  );
}

/** Values the app keeps for itself: shown, never edited. */
export function ReadOnly({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx('block px-2 py-1 text-ink-muted', className)} title="Set by the app">
      {children}
    </span>
  );
}
