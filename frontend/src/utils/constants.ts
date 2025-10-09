import { Allergen, ContestType } from '@/types';

export const ALLERGENS: Allergen[] = [
  { id: 'sesame', label: 'Sesame', emoji: '🌰' },
  { id: 'cashew', label: 'Cashews', emoji: '🥜' },
  { id: 'peanuts', label: 'Peanuts', emoji: '🥜' },
  { id: 'dairy', label: 'Dairy', emoji: '🥛' },
  { id: 'eggs', label: 'Eggs', emoji: '🥚' },
  { id: 'gluten', label: 'Gluten/Wheat', emoji: '🌾' },
  { id: 'soy', label: 'Soy', emoji: '🌱' },
  { id: 'shellfish', label: 'Shellfish', emoji: '🦐' },
  { id: 'fish', label: 'Fish', emoji: '🐟' },
  { id: 'cranberry', label: 'Cranberry', emoji: '🔴' },
];

export const CONTEST_TYPES: Record<ContestType, { name: string; emoji: string }> = {
  dessert: { name: 'Dessert Contest', emoji: '🍰' },
  cocktail: { name: 'Cocktail Contest', emoji: '🍹' },
  appetizer: { name: 'Appetizer Contest', emoji: '🥗' },
};

export const RESULTS_PASSWORD = 'pdxmas2025';

export const AUTO_LOGOUT_DURATION = 30; // seconds

export const RATING_DESCRIPTIONS = {
  appearance: 'Visual presentation and execution',
  texture: 'Mouthfeel and consistency',
  flavor: 'Taste and flavor balance',
} as const;