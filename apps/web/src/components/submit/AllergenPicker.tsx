import { ALLERGENS, DIETARY_LABELS, type AllergenOption } from '@contest/shared';
import { useState } from 'react';

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`tap-target rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        selected
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-black/15 bg-white text-ink hover:border-brand-500'
      }`}
    >
      {children}
    </button>
  );
}

/** Allergen and dietary chips. Groups (nuts, seafood) expand to specific items. */
export function AllergenPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [expanded, setExpanded] = useState<string[]>([]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const renderOption = (option: AllergenOption) => {
    const hasChildren = (option.children?.length ?? 0) > 0;
    const isExpanded = expanded.includes(option.id);
    return (
      <div key={option.id} className={hasChildren ? 'w-full' : undefined}>
        <div className="flex flex-wrap items-center gap-2">
          <Chip selected={selected.includes(option.id)} onClick={() => toggle(option.id)}>
            <span aria-hidden="true">{option.emoji}</span> {option.label}
          </Chip>
          {hasChildren ? (
            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={() =>
                setExpanded(
                  isExpanded ? expanded.filter((id) => id !== option.id) : [...expanded, option.id],
                )
              }
              className="text-sm font-semibold text-accent-700 underline"
            >
              {isExpanded ? 'Hide specifics' : 'Be specific'}
            </button>
          ) : null}
        </div>
        {hasChildren && isExpanded ? (
          <div className="mt-2 ml-4 flex flex-wrap gap-2 border-l-2 border-black/10 pl-3">
            {option.children!.map((child) => (
              <Chip
                key={child.id}
                selected={selected.includes(child.id)}
                onClick={() => toggle(child.id)}
              >
                <span aria-hidden="true">{child.emoji}</span> {child.label}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Allergens</p>
        <p className="mt-0.5 text-sm text-ink-muted">
          Tap everything your dish contains. Guests rely on this before they taste.
        </p>
        <div className="mt-2 flex flex-wrap items-start gap-2">{ALLERGENS.map(renderOption)}</div>
      </div>

      <div>
        <p className="text-sm font-semibold">Dietary labels</p>
        <p className="mt-0.5 text-sm text-ink-muted">Optional. Only add what you are sure of.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DIETARY_LABELS.map((option) => (
            <Chip
              key={option.id}
              selected={selected.includes(option.id)}
              onClick={() => toggle(option.id)}
            >
              <span aria-hidden="true">{option.emoji}</span> {option.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
