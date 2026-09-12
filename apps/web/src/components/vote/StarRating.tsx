import { RATING_VALUES, type Rating } from '@contest/shared';
import { Star } from 'lucide-react';
import { useState } from 'react';

/**
 * One row of stars for a single criterion, on one line: the label takes the left,
 * the stars take the slot the "Not rated" text used to occupy. Tapping the star
 * you already chose clears the rating, which the old app could not do.
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
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold">{label}</p>
        <div
          className="flex shrink-0 gap-1"
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
                /* Not `tap-target`: its 44px min-width would leave no room for the
                   label once five of these sit on one line. 44px tall, 32px wide. */
                className="grid min-h-11 w-8 place-items-center rounded-lg disabled:opacity-40"
              >
                <Star
                  className={
                    active ? 'size-6 fill-amber-400 text-amber-500' : 'size-6 text-black/20'
                  }
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>
      {/* Guidance for a decision you have already made is dead weight, so it goes
          once the criterion has a star. */}
      {help && value === undefined ? <p className="mt-0.5 text-xs text-ink-muted">{help}</p> : null}
    </div>
  );
}
