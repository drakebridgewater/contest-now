import { activeSorted } from '@contest/shared';
import type { ReactNode } from 'react';
import { useContest } from '../../lib/queries.ts';
import { Card, CardHeader } from '../ui/Card.tsx';

const startsAtFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

// The rules and ideas are static copy: edit here for next year's party.
const RULES = [
  '1 entry per person',
  'All judges. Everyone votes. No judges table, no gatekeeping.',
  'One prize per entry. Even if your costume is *that* good, spread the wealth.',
];

/** The intro and the facts a guest needs: no RSVP, just show up and join in. */
export function EventFacts() {
  const settings = useContest().data?.settings;

  const details: { label: string; value: ReactNode }[] = [
    {
      label: 'When',
      value: settings?.startsAt ? startsAtFormat.format(new Date(settings.startsAt)) : 'TBA',
    },
    { label: 'Location', value: settings?.location || 'TBA' },
    { label: 'Attire', value: 'Costume' },
    { label: 'Drinks', value: 'WAC Supplied' },
    { label: 'Activities', value: 'A Spotify Jam you can add songs to, party games, and more' },
  ];

  return (
    <>
      <Card className="px-4 py-5">
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          It’s nearly Halloween!
        </h2>
        <p className="mt-2">
          Our 2nd annual WAC Halloween Costume Party is finally here, and we want to celebrate with
          you! Music, games, the usual stuff.
        </p>
        <p className="mt-2">No RSVP needed — just submit your costume and vote on the night.</p>
      </Card>

      <Card>
        <CardHeader title="Details" />
        <dl className="divide-y divide-black/5">
          {details.map(({ label, value }) => (
            <div key={label} className="flex gap-3 px-4 py-3">
              <dt className="w-24 shrink-0 font-semibold text-ink-muted">{label}</dt>
              <dd className="whitespace-pre-line">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}

/** The competitions, awards and rules: worth reading, but not before answering. */
export function EventExtras() {
  const contest = useContest().data;
  const categories = activeSorted(contest?.categories ?? []);
  const awards = activeSorted(contest?.awards ?? []);

  return (
    <Card>
      <CardHeader
        title="Friendly competition(s)"
        subtitle="Bringing your best to the competition."
      />
      {categories.length > 0 ? (
        <ul className="grid gap-2 px-4 py-3 sm:grid-cols-3">
          {categories.map(({ id, emoji, name, description }) => (
            <li key={id} className="rounded-lg bg-brand-50 px-3 py-2">
              <span className="flex items-center gap-2 font-semibold">
                <span aria-hidden="true">{emoji}</span>
                {name}
              </span>
              {description ? (
                <span className="mt-0.5 block text-sm text-ink-muted">{description}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {awards.length > 0 ? (
        <div className="border-t border-black/5 px-4 py-3">
          <h3 className="font-bold">Special awards</h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            Everyone nominates one favourite for each award.
          </p>
          <ul className="mt-2 space-y-2">
            {awards.map(({ id, emoji, name, description }) => (
              <li key={id} className="flex gap-2">
                <span aria-hidden="true">{emoji || '🏆'}</span>
                <span>
                  <span className="font-semibold">{name}</span>
                  {description ? <span className="text-ink-muted"> – {description}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="border-t border-black/5 px-4 py-3">
        <h3 className="font-bold">Rules</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
