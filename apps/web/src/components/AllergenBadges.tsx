import { labelFor, splitLabels } from '@contest/shared';

/** Chips for an entry's allergens and dietary labels, used on cards and in the detail sheet. */
export function AllergenBadges({ ids, size = 'sm' }: { ids: string[]; size?: 'sm' | 'md' }) {
  const { allergens, dietary } = splitLabels(ids);
  if (allergens.length === 0 && dietary.length === 0) return null;
  const text = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="flex flex-wrap gap-1.5">
      {allergens.map((id) => {
        const item = labelFor(id);
        return (
          <span
            key={id}
            className={`inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-medium text-amber-900 ${text}`}
          >
            <span aria-hidden="true">{item.emoji}</span>
            {item.label}
          </span>
        );
      })}
      {dietary.map((id) => {
        const item = labelFor(id);
        return (
          <span
            key={id}
            className={`inline-flex items-center gap-1 rounded-full border border-accent-500/30 bg-accent-100 px-2 py-0.5 font-medium text-accent-700 ${text}`}
          >
            <span aria-hidden="true">{item.emoji}</span>
            {item.label}
          </span>
        );
      })}
    </div>
  );
}
