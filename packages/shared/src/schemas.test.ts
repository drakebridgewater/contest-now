import { describe, expect, it } from 'vitest';
import { labelFor, splitLabels } from './allergens.ts';
import { CategoryInputSchema, EventSettingsSchema } from './contest.ts';
import { CreateEntryFieldsSchema } from './entries.ts';
import { UpsertVoteSchema, normalizeVoterName } from './votes.ts';

describe('schemas', () => {
  it('accepts a category without optional fields', () => {
    const parsed = CategoryInputSchema.parse({ name: 'Sides' });
    expect(parsed.name).toBe('Sides');
    expect(parsed.id).toBeUndefined();
  });

  it('validates the photo share url but allows it empty', () => {
    const base = { eventName: 'Party', tagline: '', votingOpen: true };
    expect(EventSettingsSchema.safeParse({ ...base, photoShareUrl: '' }).success).toBe(true);
    expect(
      EventSettingsSchema.safeParse({ ...base, photoShareUrl: 'https://x.test/a' }).success,
    ).toBe(true);
    expect(EventSettingsSchema.safeParse({ ...base, photoShareUrl: 'not a url' }).success).toBe(
      false,
    );
  });

  it('rejects unknown allergen ids on submit', () => {
    const base = { entryName: 'Pie', contestantName: 'Drake', categoryId: 'dessert' };
    expect(
      CreateEntryFieldsSchema.safeParse({ ...base, allergens: ['dairy', 'vegan'] }).success,
    ).toBe(true);
    expect(CreateEntryFieldsSchema.safeParse({ ...base, allergens: ['plutonium'] }).success).toBe(
      false,
    );
  });

  it('allows null to clear a score and rejects out-of-range ratings', () => {
    expect(
      UpsertVoteSchema.safeParse({ voterName: 'Al', scores: { '1': null, '2': 5 } }).success,
    ).toBe(true);
    expect(UpsertVoteSchema.safeParse({ voterName: 'Al', scores: { '1': 6 } }).success).toBe(false);
    expect(UpsertVoteSchema.safeParse({ voterName: 'A', scores: {} }).success).toBe(false);
  });
});

describe('voter names', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeVoterName('  Drake   B ')).toBe('drake b');
  });
});

describe('allergen labels', () => {
  it('labels known ids and splits by kind', () => {
    expect(labelFor('dairy').kind).toBe('allergen');
    expect(labelFor('vegan').kind).toBe('dietary');
    expect(labelFor('nope').kind).toBe('unknown');
    expect(splitLabels(['dairy', 'vegan', 'nope'])).toEqual({
      allergens: ['dairy'],
      dietary: ['vegan'],
    });
  });
});
