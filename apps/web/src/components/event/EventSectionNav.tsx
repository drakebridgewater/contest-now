import clsx from 'clsx';
import { useEffect, useState, type ReactNode } from 'react';
import { EVENT_SECTIONS, jumpTo, type EventSectionId } from './sections.ts';

/** An in-page link to one of the Event page's sections. */
export function SectionLink({
  to,
  className,
  current,
  children,
}: {
  to: EventSectionId;
  className?: string;
  /** Marks the chip for the section on screen. */
  current?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={`#${to}`}
      className={className}
      aria-current={current ? 'location' : undefined}
      onClick={(event) => {
        event.preventDefault();
        jumpTo(to);
      }}
    >
      {children}
    </a>
  );
}

/**
 * Which section the reader is in: the last one whose top has passed under the
 * sticky nav. A section can be split in two (the details wrap around the RSVP),
 * so blocks are found by `data-section` rather than id.
 */
function useActiveSection(): EventSectionId {
  const [active, setActive] = useState<EventSectionId>('details');

  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      const nav = document.querySelector<HTMLElement>('[data-event-nav]');
      const line = nav ? nav.getBoundingClientRect().bottom + 8 : 0;
      const blocks = [...document.querySelectorAll<HTMLElement>('[data-section]')];
      const atBottom =
        window.scrollY > 0 &&
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = blocks[0]?.dataset.section;
      for (const block of blocks) {
        if (block.getBoundingClientRect().top <= line) current = block.dataset.section;
      }
      // A short last section never reaches the top; count it once the page bottoms out.
      if (atBottom) current = blocks.at(-1)?.dataset.section ?? current;
      if (current) setActive(current as EventSectionId);
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return active;
}

/** Sticky chips that jump between the Event page's sections. */
export function EventSectionNav() {
  const active = useActiveSection();
  return (
    <nav
      aria-label="Event sections"
      data-event-nav
      className="sticky z-20 -mx-4 flex gap-2 bg-surface-muted/95 px-4 py-2 backdrop-blur"
      style={{ top: 'var(--header-h, 4rem)' }}
    >
      {EVENT_SECTIONS.map(({ id, label }) => (
        <SectionLink
          key={id}
          to={id}
          current={active === id}
          className={clsx(
            'tap-target inline-flex items-center rounded-full px-4 text-sm font-semibold',
            active === id
              ? 'bg-brand-700 text-white'
              : 'border border-black/10 bg-surface text-ink-muted hover:text-ink',
          )}
        >
          {label}
        </SectionLink>
      ))}
    </nav>
  );
}
