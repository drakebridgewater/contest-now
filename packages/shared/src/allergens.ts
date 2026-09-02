import { z } from 'zod';

export interface AllergenOption {
  id: string;
  label: string;
  emoji: string;
  /** Sub-options shown under a group (e.g. specific nuts). Selecting a child does not imply the parent. */
  children?: AllergenOption[];
}

export interface DietaryOption {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

/** Allergen catalog shown on the submit form and in the allergen sheet on the vote page. */
export const ALLERGENS: readonly AllergenOption[] = [
  {
    id: 'nuts-seeds',
    label: 'Nuts & Seeds',
    emoji: '🥜',
    children: [
      { id: 'peanuts', label: 'Peanuts', emoji: '🥜' },
      { id: 'tree-nuts', label: 'Tree nuts (almonds, walnuts, pecans, hazelnuts)', emoji: '🌰' },
      { id: 'cashews', label: 'Cashews', emoji: '🥜' },
      { id: 'pistachios', label: 'Pistachios', emoji: '🥜' },
      { id: 'pine-nut', label: 'Pine nuts', emoji: '🥜' },
      { id: 'sesame', label: 'Sesame seeds', emoji: '🌰' },
      { id: 'sunflower-seeds', label: 'Sunflower seeds', emoji: '🌻' },
      { id: 'pumpkin-seeds', label: 'Pumpkin seeds', emoji: '🎃' },
    ],
  },
  { id: 'dairy', label: 'Dairy', emoji: '🥛' },
  { id: 'eggs', label: 'Eggs', emoji: '🥚' },
  { id: 'gluten', label: 'Gluten / Wheat', emoji: '🌾' },
  { id: 'soy', label: 'Soy', emoji: '🌱' },
  { id: 'chocolate', label: 'Chocolate', emoji: '🍫' },
  { id: 'coconut', label: 'Coconut', emoji: '🥥' },
  { id: 'cranberries', label: 'Cranberries', emoji: '🔴' },
  { id: 'chamomile', label: 'Chamomile / Calendula', emoji: '🌼' },
  { id: 'alcohol', label: 'Alcohol', emoji: '🍷' },
  {
    id: 'seafood',
    label: 'Seafood',
    emoji: '🦐',
    children: [
      { id: 'shellfish', label: 'Shellfish (shrimp, crab, lobster)', emoji: '🦐' },
      { id: 'fish', label: 'Fish', emoji: '🐟' },
      { id: 'mollusks', label: 'Mollusks (oysters, clams, mussels)', emoji: '🦪' },
    ],
  },
];

/** Dietary labels are positive claims ("this is vegan"), stored alongside allergens. */
export const DIETARY_LABELS: readonly DietaryOption[] = [
  { id: 'vegan', label: 'Vegan', emoji: '🌱', description: 'No animal products' },
  { id: 'vegetarian', label: 'Vegetarian', emoji: '🥬', description: 'No meat or fish' },
  { id: 'gluten-free', label: 'Gluten-free', emoji: '🌾', description: 'No wheat, barley or rye' },
  { id: 'dairy-free', label: 'Dairy-free', emoji: '🥛', description: 'No milk, cheese or butter' },
  { id: 'nut-free', label: 'Nut-free', emoji: '🚫', description: 'Made without nuts' },
  { id: 'non-alcoholic', label: 'Non-alcoholic', emoji: '🧃', description: 'Contains no alcohol' },
];

function flattenAllergens(options: readonly AllergenOption[]): AllergenOption[] {
  return options.flatMap((option) => [
    option,
    ...(option.children ? flattenAllergens(option.children) : []),
  ]);
}

const allergenById = new Map(
  flattenAllergens(ALLERGENS).map((option) => [option.id, option] as const),
);
const dietaryById = new Map(DIETARY_LABELS.map((option) => [option.id, option] as const));

export const ALLERGEN_IDS: readonly string[] = [...allergenById.keys()];
export const DIETARY_IDS: readonly string[] = [...dietaryById.keys()];

export function isAllergenId(id: string): boolean {
  return allergenById.has(id);
}

export function isDietaryId(id: string): boolean {
  return dietaryById.has(id);
}

/** Label lookup for any stored id (allergen or dietary). Unknown ids fall back to the id itself. */
export function labelFor(id: string): {
  label: string;
  emoji: string;
  kind: 'allergen' | 'dietary' | 'unknown';
} {
  const allergen = allergenById.get(id);
  if (allergen) return { label: allergen.label, emoji: allergen.emoji, kind: 'allergen' };
  const dietary = dietaryById.get(id);
  if (dietary) return { label: dietary.label, emoji: dietary.emoji, kind: 'dietary' };
  return { label: id, emoji: '❔', kind: 'unknown' };
}

/** Splits a stored list into the two kinds for display. */
export function splitLabels(ids: readonly string[]): { allergens: string[]; dietary: string[] } {
  return {
    allergens: ids.filter(isAllergenId),
    dietary: ids.filter(isDietaryId),
  };
}

/** Any id from either catalog. */
export const AllergenOrDietaryId = z
  .string()
  .refine((id) => isAllergenId(id) || isDietaryId(id), 'Unknown allergen or dietary label');
