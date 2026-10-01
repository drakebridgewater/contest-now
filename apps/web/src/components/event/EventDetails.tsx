import { labelFor } from '@contest/shared';
import type { ReactNode } from 'react';
import { useContest, useMe, useRsvpSummary } from '../../lib/queries.ts';
import { Card, CardHeader } from '../ui/Card.tsx';
import { SectionLink } from './EventSectionNav.tsx';

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
  'There is no limit to how many entries you bring.',
  'You must bake your own baked goods (box cake = okay, purchased cake = no).',
  'A cocktail is at least two ingredients, not counting water. Mocktails count!',
  'Everyone is the judge.',
];

const APPETIZER_IDEAS = [
  'Charcuterie board',
  'Chips and homemade salsa',
  'Pasta salad',
  'Chicken and waffle bites',
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
    { label: 'Attire', value: 'Holiday attire' },
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
          Our 8th annual event is finally here, and we want to celebrate with you! Music, games, the
          usual stuff.
        </p>
        <p className="mt-2">
          We’ll serve pizza with snacks from a local pizza shop. For dessert, appetizers, and
          beverages, everyone is welcome to join a friendly competition with prizes!
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

/** The allergy list and the competition rules: worth reading, but not before answering. */
export function EventExtras() {
  const settings = useContest().data?.settings;
  const guestAllergies = useRsvpSummary().data?.allergies ?? [];
  // The host's list first, in their order, then anything only guests reported.
  const allergies = [...new Set([...(settings?.knownAllergies ?? []), ...guestAllergies])];

  return (
    <>
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
        <div className="border-t border-black/5 px-4 py-3">
          <h3 className="font-bold">Appetizer ideas</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {APPETIZER_IDEAS.map((idea) => (
              <li key={idea}>{idea}</li>
            ))}
          </ul>
        </div>
      </Card>
    </>
  );
}
