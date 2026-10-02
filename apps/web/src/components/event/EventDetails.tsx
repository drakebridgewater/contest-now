import { activeSorted } from '@contest/shared';
import type { ReactNode } from 'react';
import { useContest, useMe } from '../../lib/queries.ts';
import { Card, CardHeader } from '../ui/Card.tsx';
import { SectionLink } from './EventSectionNav.tsx';

const startsAtFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

// The rules and ideas are static copy: edit here for next year's party.
const RULES = [
    "No entry limit. Bring five appetizers if you want—we're here for it",
    "Homemade only for baked goods. Box mix is totally fine; the bakery counter is not.?",
    "Cocktails = 2+ ingredients (water's free). Mocktails absolutely count.",
    "All judges. Everyone votes. No judges table, no gatekeeping.",
    "One prize per entry. Even if your dish is *that* good, spread the wealth."
  ];

/**
 * The intro and the facts a guest needs before answering the RSVP.
 * `meEnabled` holds off asking who we are until an invite link has been traded in.
 */
export function EventFacts({ meEnabled }: { meEnabled: boolean }) {
  const settings = useContest().data?.settings;
  const me = useMe(meEnabled);

  const details: { label: string; value: ReactNode }[] = [
    {
      label: 'When',
      value: settings?.startsAt ? startsAtFormat.format(new Date(settings.startsAt)) : 'TBA',
    },
    {
      label: 'Location',
      // The server only sends the address to guests signed in from their email.
      value:
        me.data?.scope === 'full' ? (
          settings?.location || 'TBA'
        ) : (
          <SectionLink to="rsvp" className="font-semibold text-brand-700 underline">
            RSVP to see the address
          </SectionLink>
        ),
    },
    { label: 'Attire', value: 'Holiday Chic or Cocktail' },
    { label: 'Drinks', value: 'Soda / seltzer' },
    {
      label: 'RSVP',
      value: (
        <SectionLink to="rsvp" className="font-semibold text-brand-700 underline">
          Required; okay to bring a +1
        </SectionLink>
      ),
    },
  ];

  return (
    <>
      <Card className="px-4 py-5">
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          It’s nearly Xmas! 🎄
        </h2>
        <p className="mt-2">
          Our 8th annual PDXmas is finally here, and we want to celebrate with you! Music, games, the
          usual stuff.
        </p>
        <p className="mt-2">
          Dust off your cookbooks and cocktail shakers; we're having competitions! Bring your best
          appetizers, desserts, and beverages to compete for amazing prizes. We'll kick things 
          off with pizza from a local pizza shop.
        </p>
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
        title="Friendly competitions"
        subtitle="Chef's hat and mixologist credentials optional. Just bring your best cocktail or dish to the competition."
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
            On top of the star ratings, everyone nominates one favourite for each award.
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
