import { labelFor } from '@contest/shared';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { InfoTabs } from '../components/InfoTabs.tsx';
import { Card, CardHeader } from '../components/ui/Card.tsx';
import { useContest, useRsvpSummary } from '../lib/queries.ts';

const startsAtFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

// The rest of the page is static copy: edit here for next year's party.
const CHALLENGES = [
  { emoji: '🥟', name: 'Appetizer Challenge' },
  { emoji: '🍰', name: 'Holiday Dessert Challenge' },
  { emoji: '🍹', name: 'Cocktail Challenge' },
];

const RULES = [
  "No entry limit. Bring five appetizers if you want—we're here for it",
  "Homemade only for baked goods. Box mix is totally fine; the bakery counter is not.?",
  "Cocktails = 2+ ingredients (water's free). Mocktails absolutely count.",
  "All judges. Everyone votes. No judges table, no gatekeeping.",
  "One prize per entry. Even if your dish is *that* good, spread the wealth."
];

export function DetailsPage() {
  const settings = useContest().data?.settings;
  const guestAllergies = useRsvpSummary().data?.allergies ?? [];
  // The host's list first, in their order, then anything only guests reported.
  const allergies = [...new Set([...(settings?.knownAllergies ?? []), ...guestAllergies])];

  const details: { label: string; value: ReactNode }[] = [
    {
      label: 'When',
      value: settings?.startsAt ? startsAtFormat.format(new Date(settings.startsAt)) : 'TBA',
    },
    { label: 'Location', value: settings?.location || 'TBA' },
    { label: 'Attire', value: 'Holiday Chic or Cocktail' },
    { label: 'Drinks', value: 'Soda / seltzer' },
    {
      label: 'RSVP',
      value: (
        <Link to="/register" className="font-semibold text-brand-700 underline">
          Required; okay to bring a +1
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <InfoTabs />

      <Card className="px-4 py-5">
        <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          It’s nearly Xmas! 🎄
        </h2>
        <p className="mt-2">
          Our 8th annual PDXmas is finally here, and we want to celebrate with you! Music, games, the
          usual stuff.
        </p>
        <p className="mt-2">
        Dust off your cookbooks and cocktail shakers—we're having competitions! Bring your best
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

      {allergies.length > 0 ? (
        <Card className="border-amber-300 bg-amber-50 px-4 py-4 text-amber-950">
          <h2 className="text-lg font-bold">Known allergies</h2>
          <p className="mt-1 text-sm">
            You can still use these ingredients, but please mention them when you arrive so we can
            put up the right signage.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {allergies.map((id) => {
              const { label, emoji } = labelFor(id);
              return (
                <li
                  key={id}
                  className="rounded-full border border-amber-300 bg-white px-3 py-1 text-sm font-medium"
                >
                  <span aria-hidden="true">{emoji}</span> <span>{label}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Friendly competitions"
          subtitle="Don your bartender getup or your apron and toque and bring a custom cocktail or tasty dish."
        />
        <ul className="grid gap-2 px-4 py-3 sm:grid-cols-3">
          {CHALLENGES.map(({ emoji, name }) => (
            <li
              key={name}
              className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 font-semibold"
            >
              <span aria-hidden="true">{emoji}</span>
              {name}
            </li>
          ))}
        </ul>
        <div className="border-t border-black/5 px-4 py-3">
          <h3 className="font-bold">Rules</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
