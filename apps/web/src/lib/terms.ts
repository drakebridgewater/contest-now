import { categoryTerms, type Category, type CategoryTerms } from '@contest/shared';

/** The words for a page that shows entries from several categories at once. */
export interface PageTerms {
  /** The shared noun when every category agrees on one, else "entry". */
  noun: string;
  /** Some category is tasted, so allergens and the "Tasted" mark apply somewhere. */
  anyTasting: boolean;
  /** Some category is looked at, with a "Seen" mark. */
  anyShowcase: boolean;
  /** A sample entry name, from the categories' kind when they share one. */
  example: string;
}

export function pageTerms(categories: readonly Category[]): PageTerms {
  const terms = categories.map(categoryTerms);
  const first = terms[0];
  const same = (pick: (t: CategoryTerms) => string) =>
    first !== undefined && terms.every((t) => pick(t) === pick(first));
  return {
    noun: same((t) => t.noun) ? first!.noun : 'entry',
    anyTasting: terms.some((t) => t.mark === 'Tasted'),
    anyShowcase: terms.some((t) => t.mark === 'Seen'),
    example: same((t) => t.example) ? first!.example : categoryTerms(undefined).example,
  };
}

/** "a dish", "an entry". */
export function withArticle(noun: string): string {
  return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
}
