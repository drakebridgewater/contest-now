import { NavLink } from 'react-router';

/** Flips between the two static info pages, which share one tab on phones. */
export function InfoTabs() {
  return (
    <nav aria-label="Event info" className="flex gap-2">
      {[
        { to: '/details', label: 'Event details' },
        { to: '/faq', label: 'FAQ' },
      ].map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `tap-target inline-flex items-center rounded-full px-4 text-sm font-semibold ${
              isActive
                ? 'bg-brand-700 text-white'
                : 'border border-black/10 bg-surface text-ink-muted hover:text-ink'
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
