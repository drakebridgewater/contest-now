import type { Faq } from '@contest/shared';
import type { Db } from './client.ts';
import { awards, categories, criteria, eventSettings } from './schema.ts';

export const DEFAULT_EVENT_NAME = 'Holiday Contest';

/** Allergies a new event lists on its details page. Hosts edit them on the Manage Event page. */
export const DEFAULT_KNOWN_ALLERGIES = [
  'cashews',
  'pistachios',
  'fish',
  'soy',
  'sunflower-seeds',
  'pumpkin-seeds',
  'lentils',
  'cranberries',
  'gluten',
];

/** The FAQ a new event starts with. Hosts edit it on the Manage Event page. */
export const DEFAULT_FAQS: Faq[] = [
  {
    question: 'Is the event free?',
    answer:
      'Yes, since most partygoers take part in the challenges. If you’re not entering a friendly competition, we encourage you to donate to the pizza fund.',
  },
  {
    question: 'Can I bring my kids?',
    answer:
      'No, this is a 21-and-up party. All the other events around the holidays will include our children.',
  },
  {
    question: 'When should I show up?',
    answer:
      'If you’re entering a challenge, please try to arrive within the first hour of the event.',
  },
  { question: 'When are the winners announced?', answer: 'Around 8–9 pm.' },
  {
    question: 'Can I bring something to share but not enter it in the competitions?',
    answer: 'Of course! We’d love anything you’d like to share with the PDXmas family.',
  },
];

const defaultCriteria = {
  appearance: { name: 'Appearance', helpText: 'How does it look? Plating, color, presentation.' },
  texture: {
    name: 'Texture',
    helpText: 'Mouthfeel and consistency: is it what this dish should be?',
  },
  flavor: { name: 'Flavor', helpText: 'Taste and balance. Would you go back for seconds?' },
  balance: { name: 'Balance', helpText: 'Sweet, sour, bitter and strength working together.' },
} as const;

/**
 * Inserts the default contest into a brand-new database: the settings row is the
 * marker, so a host who deletes every category (an awards-only contest) does not
 * get the defaults back on the next restart. Never touches an existing contest.
 */
export async function seedDefaults(db: Db): Promise<{ seeded: boolean }> {
  const inserted = await db
    .insert(eventSettings)
    .values({
      id: 1,
      eventName: DEFAULT_EVENT_NAME,
      tagline: 'Food & drink contest',
      faqs: DEFAULT_FAQS,
      knownAllergies: DEFAULT_KNOWN_ALLERGIES,
    })
    .onConflictDoNothing()
    .returning({ id: eventSettings.id });

  if (inserted.length === 0) return { seeded: false };

  await db.transaction(async (tx) => {
    await tx.insert(categories).values([
      {
        id: 'appetizer',
        name: 'Appetizers',
        emoji: '🥗',
        description: 'Small bites and starters',
        sortOrder: 10,
      },
      {
        id: 'cocktail',
        name: 'Cocktails',
        emoji: '🍹',
        description: 'Drinks, with or without alcohol',
        sortOrder: 20,
      },
      {
        id: 'dessert',
        name: 'Desserts',
        emoji: '🍰',
        description: 'Sweets and baked goods',
        sortOrder: 30,
      },
    ]);

    const rows: (typeof criteria.$inferInsert)[] = [];
    for (const categoryId of ['appetizer', 'dessert'] as const) {
      rows.push(
        { categoryId, slug: 'appearance', sortOrder: 10, ...defaultCriteria.appearance },
        { categoryId, slug: 'texture', sortOrder: 20, ...defaultCriteria.texture },
        { categoryId, slug: 'flavor', sortOrder: 30, ...defaultCriteria.flavor },
      );
    }
    rows.push(
      { categoryId: 'cocktail', slug: 'appearance', sortOrder: 10, ...defaultCriteria.appearance },
      { categoryId: 'cocktail', slug: 'balance', sortOrder: 20, ...defaultCriteria.balance },
      { categoryId: 'cocktail', slug: 'flavor', sortOrder: 30, ...defaultCriteria.flavor },
    );
    await tx.insert(criteria).values(rows);

    await tx.insert(awards).values([
      {
        id: 'best-presented',
        name: 'Best Presented',
        emoji: '🎨',
        description: 'The entry that looked the most stunning on the table.',
        sortOrder: 10,
      },
      {
        id: 'best-use-of-ingredients',
        name: 'Best Use of Ingredients',
        emoji: '🧑‍🍳',
        description: 'Clever, surprising or seasonal ingredients used well.',
        sortOrder: 20,
      },
      {
        id: 'healthiest-without-sacrificing-flavor',
        name: 'Healthiest Without Sacrificing Flavor',
        emoji: '🥦',
        description: 'Light and wholesome, and still delicious.',
        sortOrder: 30,
      },
    ]);
  });

  return { seeded: true };
}
