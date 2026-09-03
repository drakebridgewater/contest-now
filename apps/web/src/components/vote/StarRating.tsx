import { RATING_VALUES, type Rating } from '@contest/shared';
import { Star } from 'lucide-react';
import { useState } from 'react';

/**
 * One row of stars for a single criterion.
 * Tapping the star you already chose clears the rating, which the old app could not do.
 */
export function StarRating({
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
  const [hovered, setHovered] = useState<Rating | null>(null);
  const shown = hovered ?? value ?? 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{label}</p>
        <span className={value ? 'text-sm text-accent-700' : 'text-sm text-ink-muted'}>
          {value ? `${value} of 5` : 'Not rated'}
        </span>
      </div>
      {help ? <p className="mt-0.5 text-xs text-ink-muted">{help}</p> : null}
      <div
        className="mt-1 flex gap-1"
        role="group"
        aria-label={label}
        onPointerLeave={() => setHovered(null)}
      >
        {RATING_VALUES.map((star) => {
          const active = star <= shown;
          return (
            <button
              key={star}
              type="button"
              disabled={disabled}
              aria-label={`${star} ${star === 1 ? 'star' : 'stars'}${value === star ? ' (tap to clear)' : ''}`}
              aria-pressed={value !== undefined && star <= value}
              onPointerEnter={() => setHovered(star)}
              onClick={() => onChange(value === star ? null : star)}
              className="tap-target grid place-items-center rounded-lg disabled:opacity-40"
            >
              <Star
                className={active ? 'size-8 fill-amber-400 text-amber-500' : 'size-8 text-black/20'}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
