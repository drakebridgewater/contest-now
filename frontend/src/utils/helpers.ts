import { ALLERGENS, DIETARY_RESTRICTIONS } from './constants';

export const getAllergenById = (id: string) => {
  // First check top-level allergens
  const topLevel = ALLERGENS.find(allergen => allergen.id === id);
  if (topLevel) return topLevel;

  // Then check children
  for (const allergen of ALLERGENS) {
    if (allergen.children) {
      const child = allergen.children.find(child => child.id === id);
      if (child) return child;
    }
  }

  // Check dietary restrictions
  const dietary = DIETARY_RESTRICTIONS.find(restriction => restriction.id === id);
  if (dietary) return dietary;

  return null;
};

export const formatDate = (dateString: string, options?: Intl.DateTimeFormatOptions): string => {
  // For date-only strings (YYYY-MM-DD), parse components to avoid timezone conversion issues
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-').map(Number);
    // Create date with local timezone to avoid off-by-one errors
    return new Date(year, month - 1, day).toLocaleDateString(undefined, options);
  }
  // For datetime strings, use regular parsing
  return new Date(dateString).toLocaleDateString(undefined, options);
};

export const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString();
};

export const validateBase64Image = (dataUrl: string): boolean => {
  const matches = dataUrl.match(/^data:image\/([a-zA-Z]*);base64,([^"]*)/);
  return Boolean(matches);
};

export const getImageExtension = (dataUrl: string): string | null => {
  const matches = dataUrl.match(/^data:image\/([a-zA-Z]*);base64,/);
  return matches ? matches[1] : null;
};

export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
};

export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

export const isValidVoterName = (name: string): boolean => {
  return name.trim().length >= 2;
};

export const calculateAverageRating = (
  appearance: number,
  texture: number,
  flavor: number
): number => {
  return (appearance + texture + flavor) / 3;
};

export const isVoteComplete = (vote: {
  appearance_rating: number;
  texture_rating: number;
  flavor_rating: number;
}): boolean => {
  return vote.appearance_rating > 0 && vote.texture_rating > 0 && vote.flavor_rating > 0;
};