import { Camera, ClipboardList, Images, Trophy } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { useContest } from '../lib/queries.ts';

const TABS = [
  { to: '/submit', label: 'Submit', Icon: Camera },
  { to: '/vote', label: 'Vote', Icon: ClipboardList },
  { to: '/admin', label: 'Results', Icon: Trophy },
] as const;

export function AppLayout() {
  const contest = useContest();
  const settings = contest.data?.settings;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-gradient-to-r from-brand-700 to-accent-700 text-white shadow-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1
              className="truncate text-xl font-bold"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {settings?.eventName ?? 'Contest'}
            </h1>
            {settings?.tagline ? (
              <p className="truncate text-sm text-white/80">{settings.tagline}</p>
            ) : null}
          </div>

          <nav className="hidden gap-1 sm:flex" aria-label="Main">
            {TABS.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `tap-target inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive ? 'bg-white text-brand-700' : 'text-white/90 hover:bg-white/15'
                  }`
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
            {settings?.photoShareUrl ? (
              <a
                href={settings.photoShareUrl}
                target="_blank"
                rel="noreferrer"
                className="tap-target inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/15"
              >
                <Images className="size-4" aria-hidden="true" />
                Photos
              </a>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-4 pb-28 sm:pb-10">
        {contest.isError ? (
          <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-red-800">
            Could not load the contest. Check that the server is running, then pull to refresh.
          </p>
        ) : null}
        <Outlet />
        {settings?.photoShareUrl ? (
          <a
            href={settings.photoShareUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-accent-700 underline sm:hidden"
          >
            <Images className="size-4" aria-hidden="true" />
            Party photo album
          </a>
        ) : null}
      </main>

      {/* Bottom tab bar: thumb-reachable navigation on phones. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-surface/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto flex max-w-lg">
          {TABS.map(({ to, label, Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-xs font-semibold ${
                    isActive ? 'text-brand-700' : 'text-ink-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={isActive ? 'size-6' : 'size-6 opacity-70'}
                      aria-hidden="true"
                    />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
