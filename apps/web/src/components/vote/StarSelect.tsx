import { RATING_VALUES, type Rating } from '@contest/shared';
import { Info } from 'lucide-react';
import { useId, useState } from 'react';

// Short on purpose: on a phone the select shares a third of the card with the
// criterion's name, and "★★★★★ 5" left no room for "Appearance".
const OPTION_LABEL: Record<Rating, string> = {
  1: '1 ★',
  2: '2 ★',
  3: '3 ★',
  4: '4 ★',
  5: '5 ★',
};

/**
 * One criterion for the medium card: a native select instead of five star
 * buttons, because the phone's own picker is the easiest thing to hit with a
 * thumb, and the help text hides behind an ⓘ so three criteria fit the card.
 */
export function StarSelect({
  label,
  help,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  help?: string;
  value: Rating | undefined;
  onChange: (value: Rating | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-2">
        <label
          htmlFor={id}
          className="line-clamp-2 min-w-0 flex-1 text-sm leading-tight font-semibold"
        >
          {label}
        </label>
        {help ? (
          <button
            type="button"
            aria-expanded={showHelp}
            aria-controls={`${id}-help`}
            aria-label={`What “${label}” means`}
            onClick={() => setShowHelp(!showHelp)}
            className="-m-1 grid size-8 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-black/5"
          >
            <Info className="size-4" aria-hidden="true" />
          </button>
        ) : null}
        <select
          id={id}
          value={value ?? ''}
          disabled={disabled}
          onChange={(event) =>
            onChange(event.target.value === '' ? null : (Number(event.target.value) as Rating))
          }
          className={`min-h-10 w-20 shrink-0 rounded-lg border px-2 text-sm font-semibold disabled:opacity-50 ${
            value === undefined
              ? 'border-black/15 bg-white text-ink-muted'
              : 'border-amber-400 bg-amber-50 text-amber-800'
          }`}
        >
          <option value="">Rate</option>
          {RATING_VALUES.map((rating) => (
            <option key={rating} value={rating}>
              {OPTION_LABEL[rating]}
            </option>
          ))}
        </select>
      </div>
      {help && showHelp ? (
        <p id={`${id}-help`} className="mt-0.5 text-xs text-ink-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}
