import { Link } from 'react-router';
import { InfoTabs } from '../components/InfoTabs.tsx';
import { Card, CardHeader } from '../components/ui/Card.tsx';

// Static copy: edit here for next year's party.
const DETAILS: { label: string; value: string }[] = [
  { label: 'Location', value: 'Matt & Mar’s Home' },
  { label: 'Attire', value: 'Holiday attire' },
  { label: 'Drinks', value: 'Soda / seltzer' },
  { label: 'RSVP', value: 'Required; okay to bring a +1' },
];

const KNOWN_ALLERGIES = [
  'Cashews',
  'Pistachios',
  'Fin fish (shellfish okay)',
  'Soy protein, sauce, grits & flour',
  'Sunflower seeds',
  'Pumpkin seeds',
  'Lentils',
  'Cranberry',
  'Gluten',
];

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

export function DetailsPage() {
  return (
    <div className="space-y-4">
      <InfoTabs />

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
          {DETAILS.map(({ label, value }) => (
            <div key={label} className="flex gap-3 px-4 py-3">
              <dt className="w-24 shrink-0 font-semibold text-ink-muted">{label}</dt>
              <dd>
                {label === 'RSVP' ? (
                  <Link to="/register" className="font-semibold text-brand-700 underline">
                    {value}
                  </Link>
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="border-amber-300 bg-amber-50 px-4 py-4 text-amber-950">
        <h2 className="text-lg font-bold">Known allergies</h2>
        <p className="mt-1 text-sm">
          You can still use these ingredients, but please mention them when you arrive so we can put
          up the right signage.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {KNOWN_ALLERGIES.map((item) => (
            <li
              key={item}
              className="rounded-full border border-amber-300 bg-white px-3 py-1 text-sm font-medium"
            >
              {item}
            </li>
          ))}
        </ul>
      </Card>

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
    </div>
  );
}
