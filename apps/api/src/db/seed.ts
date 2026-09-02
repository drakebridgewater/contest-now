import { sql } from 'drizzle-orm';
import type { Db } from './client.ts';
import { awards, categories, criteria, eventSettings } from './schema.ts';

export const DEFAULT_EVENT_NAME = 'Holiday Contest';

const defaultCriteria = {
  appearance: { name: 'Appearance', helpText: 'How does it look? Plating, color, presentation.' },
  texture: { name: 'Texture', helpText: 'Mouthfeel and consistency: is it what this dish should be?' },
  flavor: { name: 'Flavor', helpText: 'Taste and balance. Would you go back for seconds?' },
  balance: { name: 'Balance', helpText: 'Sweet, sour, bitter and strength working together.' },
} as const;

/**
 * Inserts the default contest when the database is empty (no categories).
 * Never touches an existing contest, so admin edits and deletions stick.
 */
export async function seedDefaults(db: Db): Promise<{ seeded: boolean }> {
  const existing = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(categories)
    .then((rows) => rows[0]?.count ?? 0);

  await db
    .insert(eventSettings)
    .values({ id: 1, eventName: DEFAULT_EVENT_NAME, tagline: 'Food & drink contest' })
    .onConflictDoNothing();

  if (existing > 0) return { seeded: false };

  await db.transaction(async (tx) => {
    await tx.insert(categories).values([
      { id: 'appetizer', name: 'Appetizers', emoji: '🥗', description: 'Small bites and starters', sortOrder: 10 },
      { id: 'cocktail', name: 'Cocktails', emoji: '🍹', description: 'Drinks, with or without alcohol', sortOrder: 20 },
      { id: 'dessert', name: 'Desserts', emoji: '🍰', description: 'Sweets and baked goods', sortOrder: 30 },
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
