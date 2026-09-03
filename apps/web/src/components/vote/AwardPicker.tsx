import { isEntryInAwardScope, type Award, type Entry } from '@contest/shared';
import { Check, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';
import { Sheet } from '../ui/Sheet.tsx';

/**
 * One award: pick exactly one eligible entry. Category winners come from the
 * star ratings; these nominations are a separate ballot.
 */
export function AwardPicker({
  award,
  entries,
  categoryNames,
  pickedEntryId,
  disabled = false,
  onPick,
  onClear,
}: {
  award: Award;
  entries: Entry[];
  categoryNames: Map<string, string>;
  pickedEntryId: number | undefined;
  disabled?: boolean;
  onPick: (entryId: number) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const eligible = entries.filter((entry) => isEntryInAwardScope(award, entry));
  const picked = eligible.find((entry) => entry.id === pickedEntryId);

  const scopeLabel =
    award.categoryIds.length === 0
      ? 'Any category'
      : award.categoryIds.map((id) => categoryNames.get(id) ?? id).join(', ');

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">
          {award.emoji || '🏆'}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">{award.name}</h3>
          {award.description ? (
            <p className="mt-0.5 text-sm text-ink-muted">{award.description}</p>
          ) : null}
          <p className="mt-0.5 text-xs text-ink-muted">{scopeLabel}</p>
        </div>
      </div>

      {picked ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-accent-500/40 bg-accent-100 p-2">
          <img
            src={picked.photoUrl}
            alt=""
            className="size-12 shrink-0 rounded-lg object-cover"
            loading="lazy"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{picked.entryName}</p>
            <p className="truncate text-sm text-accent-700">Your pick</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="secondary" disabled={disabled} onClick={() => setOpen(true)}>
              Change
            </Button>
            <Button size="sm" variant="ghost" disabled={disabled} onClick={onClear}>
              Clear
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="mt-3 w-full"
          variant="secondary"
          disabled={disabled || eligible.length === 0}
          onClick={() => setOpen(true)}
        >
          <Trophy className="size-4" aria-hidden="true" />
          {eligible.length === 0 ? 'No eligible entries yet' : 'Choose an entry'}
        </Button>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={award.name}
        description={`Pick one entry. ${scopeLabel}.`}
      >
        <ul className="grid grid-cols-2 gap-2">
          {eligible.map((entry) => {
            const selected = entry.id === pickedEntryId;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    onPick(entry.id);
                    setOpen(false);
                  }}
                  className={`w-full overflow-hidden rounded-xl border-2 text-left transition-colors ${
                    selected ? 'border-brand-600' : 'border-black/10 hover:border-brand-300'
                  }`}
                >
                  <span className="relative block">
                    <img
                      src={entry.photoUrl}
                      alt=""
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                    {selected ? (
                      <span className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-brand-600 text-white">
                        <Check className="size-4" aria-hidden="true" />
                      </span>
                    ) : null}
                  </span>
                  <span className="block p-2">
                    <span className="block truncate text-sm font-semibold">{entry.entryName}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {categoryNames.get(entry.categoryId) ?? entry.categoryId}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </Card>
  );
}
