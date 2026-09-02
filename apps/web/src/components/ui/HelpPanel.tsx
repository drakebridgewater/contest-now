import { ChevronDown, HelpCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocalStorage } from '../../lib/useLocalStorage.ts';

/**
 * The "How this works" panel at the top of every page.
 * Open by default; once someone collapses it, it stays collapsed on that device.
 */
export function HelpPanel({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useLocalStorage(`contest.help.${id}`, true);

  return (
    <section className="rounded-card border border-accent-500/25 bg-accent-100/60">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="tap-target flex w-full items-center gap-2 px-4 py-3 text-left font-semibold text-accent-700"
      >
        <HelpCircle className="size-5 shrink-0" aria-hidden="true" />
        <span className="flex-1">{title}</span>
        <ChevronDown
          className={`size-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="space-y-2 px-4 pb-4 text-sm leading-relaxed text-ink [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>
      ) : null}
    </section>
  );
}
