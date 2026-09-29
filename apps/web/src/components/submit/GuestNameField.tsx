import { CONTESTANT_NAME_MAX, normalizeVoterName, type GuestName } from '@contest/shared';
import { CircleCheck } from 'lucide-react';
import { useId, useState } from 'react';
import { TextField } from '../ui/Field.tsx';

const MAX_SUGGESTIONS = 6;

/** The guest whose name this is, ignoring case and spacing, if any. */
function matchGuest(guests: readonly GuestName[], typed: string): GuestName | undefined {
  const key = normalizeVoterName(typed);
  if (key.length === 0) return undefined;
  return guests.find((guest) => normalizeVoterName(guest.name) === key);
}

/**
 * "Your name" on the submit form. It suggests names from the guest list as you
 * type, and picking one (or typing one exactly) files the entry under that guest.
 * Nobody is signed in by it: it only says whose dish this is.
 */
export function GuestNameField({
  guests,
  value,
  onChange,
  error,
}: {
  guests: readonly GuestName[];
  value: string;
  onChange: (name: string, guest: GuestName | undefined) => void;
  error?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const linked = matchGuest(guests, value);

  const typed = normalizeVoterName(value);
  const suggestions =
    typed.length === 0
      ? []
      : guests
          .filter((guest) => {
            const key = normalizeVoterName(guest.name);
            // "sa" finds "Sam Lee" and "Lisa Sanchez"; the exact match is already linked.
            return (
              key !== typed &&
              (key.startsWith(typed) || key.split(' ').some((part) => part.startsWith(typed)))
            );
          })
          .slice(0, MAX_SUGGESTIONS);
  const showList = open && suggestions.length > 0;

  function pick(guest: GuestName) {
    onChange(guest.name, guest);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="relative">
      <TextField
        label="Your name"
        help={
          linked ? (
            <span className="inline-flex items-center gap-1 font-medium text-accent-700">
              <CircleCheck className="size-4" aria-hidden="true" />
              Filed under {linked.name} on the guest list
            </span>
          ) : (
            'Start typing and pick yourself from the guest list, or enter a new name.'
          )
        }
        value={value}
        maxLength={CONTESTANT_NAME_MAX}
        autoComplete="off"
        enterKeyHint="next"
        error={error}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        onFocus={() => setOpen(true)}
        // Delay so a tap on a suggestion lands before the list disappears.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next, matchGuest(guests, next));
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(event) => {
          if (!showList) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((i) => Math.min(i + 1, suggestions.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (event.key === 'Enter' && active >= 0) {
            event.preventDefault();
            pick(suggestions[active]!);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Guests"
          className="absolute inset-x-0 top-full z-20 -mt-5 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg"
        >
          {suggestions.map((guest, index) => (
            <li
              key={guest.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onPointerDown={(event) => {
                event.preventDefault();
                pick(guest);
              }}
              className={`cursor-pointer px-3 py-3 text-base ${index === active ? 'bg-brand-50' : 'hover:bg-black/5'}`}
            >
              {guest.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
