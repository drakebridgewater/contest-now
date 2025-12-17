import {Allergen, ContestType, DietaryRestriction} from '@/types';

export const ALLERGENS: Allergen[] = [
  {id: 'alcohol', label: 'Alcohol', emoji: '🍷'},
  {id: 'chocolate', label: 'Chocolate', emoji: '🍫'},
  {
    id: 'nuts-seeds',
    label: 'Nuts & Seeds',
    emoji: '🥜',
    children: [
      {id: 'sunflower-seeds', label: 'Sunflower Seeds', emoji: '🌻'},
      {id: 'pumpkin-seeds', label: 'Pumpkin Seeds', emoji: '🎃'},
      // {id: 'almonds', label: 'Almonds', emoji: '🌰'},
      {id: 'cashews', label: 'Cashews', emoji: '🥜'},
      // {id: 'walnuts', label: 'Walnuts', emoji: '🌰'},
      // {id: 'pecans', label: 'Pecans', emoji: '🌰'},
      {id: 'pistachios', label: 'Pistachios', emoji: '🥜'},
      // {id: 'hazelnuts', label: 'Hazelnuts', emoji: '🌰'},
      // {id: 'brazil-nuts', label: 'Brazil Nuts', emoji: '🌰'},
      // {id: 'sesame', label: 'Sesame Seeds', emoji: '🌰'},
      {id: 'peanuts', label: 'Peanuts', emoji: '🥜'},
    ],
  },
  {id: 'chamomile', label: 'Chamomile', emoji: '🌼'},
  {
    id: 'fruits',
    label: 'Fruits',
    emoji: '🍓',
    children: [
      // { id: 'strawberries', label: 'Strawberries', emoji: '🍓' },
      {id: 'cranberries', label: 'Cranberries', emoji: '🔴'},
      // { id: 'citrus', label: 'Citrus (Orange/Lemon/Lime)', emoji: '🍋' },
      // { id: 'kiwi', label: 'Kiwi', emoji: '🥝' },
      {id: 'mango', label: 'Mango', emoji: '🥭'},
      // {id: 'pineapple', label: 'Pineapple', emoji: '🍍'},
      {id: 'grapefruit', label: 'Grapefruit', emoji: '🍊'},
      // { id: 'grapes', label: 'Grapes', emoji: '🍇' },
      // {id: 'berries', label: 'Other Berries', emoji: '🫐'},
      {id: 'coconut', label: 'Coconut', emoji: '🥥'},
      {id: 'avocado', label: 'Avocado', emoji: '🥑'},
    ],
  },
  {
    id: 'seafood',
    label: 'Seafood',
    emoji: '🦐',
    children: [
      {id: 'shellfish', label: 'Shellfish (Shrimp, Crab, Lobster)', emoji: '🦐'},
      {id: 'fish', label: 'Fish', emoji: '🐟'},
      {id: 'mollusks', label: 'Mollusks (Oysters, Clams, Mussels)', emoji: '🦪'},
    ],
  },
  {id: 'dairy', label: 'Dairy', emoji: '🥛'},
  {id: 'eggs', label: 'Eggs', emoji: '🥚'},
  {id: 'gluten', label: 'Gluten/Wheat', emoji: '🌾'},
  {id: 'soy', label: 'Soy', emoji: '🌱'},
];

export const DIETARY_RESTRICTIONS: DietaryRestriction[] = [
  {
    id: 'vegan',
    label: 'Vegan',
    emoji: '🌱',
    description: 'No animal products (meat, dairy, eggs, honey, etc.)',
  },
  {
    id: 'vegetarian',
    label: 'Vegetarian',
    emoji: '🥬',
    description: 'No meat or fish, but may contain dairy and eggs',
  },
  {
    id: 'gluten-free',
    label: 'Gluten-Free',
    emoji: '🌾',
    description: 'No wheat, barley, rye, or other gluten-containing grains',
  },
  {
    id: 'dairy-free',
    label: 'Dairy-Free',
    emoji: '🚫🥛',
    description: 'No milk, cheese, butter, or other dairy products',
  },
  {
    id: 'keto',
    label: 'Keto-Friendly',
    emoji: '🥩',
    description: 'Very low carb, high fat content',
  },
  {
    id: 'paleo',
    label: 'Paleo',
    emoji: '🦕',
    description: 'No processed foods, grains, legumes, or refined sugar',
  },
];
export const CONTEST_TYPES: Record<ContestType, {name: string; emoji: string}> = {
  dessert: {name: 'Dessert Contest', emoji: '🍰'},
  cocktail: {name: 'Cocktail Contest', emoji: '🍹'},
  appetizer: {name: 'Appetizer Contest', emoji: '🥗'},
  sweater: {name: 'Sweater Contest', emoji: '🧥'},
  other: {name: 'Other Contests', emoji: '🎯'},
};

// Admin password loaded from environment variable at build time
// Default to 'pdxmas2025' if not set
export const RESULTS_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || 'pdxmas2025';

export const AUTO_LOGOUT_DURATION = 30; // seconds

export const RATING_DESCRIPTIONS = {
  appearance: 'Visual presentation and execution',
  texture: 'Mouthfeel and consistency',
  flavor: 'Taste and flavor balance',
} as const;
