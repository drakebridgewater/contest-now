import { describe, expect, it } from 'vitest';
import { allergenConflicts, labelFor, splitLabels } from './allergens.ts';
import { CategoryInputSchema, EventSettingsSchema, phaseStatus } from './contest.ts';
import {
  CustomEmailSchema,
  EMAIL_HTML_MAX,
  parseGuestLines,
  UpdateProfileSchema,
} from './guests.ts';
import { CreateEntryFieldsSchema } from './entries.ts';
import { UpsertVoteSchema, normalizeVoterName } from './votes.ts';

describe('schemas', () => {
  it('accepts a category without optional fields', () => {
    const parsed = CategoryInputSchema.parse({ name: 'Sides' });
    expect(parsed.name).toBe('Sides');
    expect(parsed.id).toBeUndefined();
  });

  it('validates the photo share url but allows it empty', () => {
    const base = {
      eventName: 'Party',
      tagline: '',
      votingOpen: true,
      votingOpensAt: null,
      submissionsOpen: true,
      submissionsOpenAt: null,
    };
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
    expect(UpsertVoteSchema.safeParse({ scores: { '1': null, '2': 5 } }).success).toBe(true);
    expect(UpsertVoteSchema.safeParse({ scores: { '1': 6 } }).success).toBe(false);
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

describe('allergen conflicts', () => {
  it('matches exact ids and ignores dietary labels', () => {
    expect(allergenConflicts(['dairy'], ['dairy', 'eggs', 'vegan'])).toEqual(['dairy']);
    expect(allergenConflicts([], ['dairy'])).toEqual([]);
    expect(allergenConflicts(['dairy'], ['dairy-free'])).toEqual([]);
  });

  it('treats a group as covering its members, both ways', () => {
    // Avoiding all seafood covers shellfish.
    expect(allergenConflicts(['seafood'], ['shellfish'])).toEqual(['shellfish']);
    // An entry tagged only "Nuts & Seeds" might be the peanut one.
    expect(allergenConflicts(['peanuts'], ['nuts-seeds'])).toEqual(['nuts-seeds']);
    // Siblings do not clash.
    expect(allergenConflicts(['peanuts'], ['cashews'])).toEqual([]);
  });
});

describe('phase status', () => {
  const now = new Date('2026-12-20T19:00:00Z');
  it('is closed whenever the switch is off', () => {
    expect(phaseStatus(false, null, now)).toBe('closed');
    expect(phaseStatus(false, '2026-12-20T18:00:00Z', now)).toBe('closed');
  });
  it('waits for the opening time, then opens', () => {
    expect(phaseStatus(true, '2026-12-20T19:30:00Z', now)).toBe('scheduled');
    expect(phaseStatus(true, '2026-12-20T19:00:00Z', now)).toBe('open');
    expect(phaseStatus(true, null, now)).toBe('open');
  });
});

describe('guest list parsing', () => {
  it('reads "Name, email", "Name <email>", tabs and bare names', () => {
    const { guests, errors } = parseGuestLines(
      'Ann Lee, ANN@example.com\nBo <bo@example.com>\n\nCy\tcy@example.com\nDee\nbad, not-an-email',
    );
    expect(guests).toEqual([
      { name: 'Ann Lee', email: 'ann@example.com' },
      { name: 'Bo', email: 'bo@example.com' },
      { name: 'Cy', email: 'cy@example.com' },
      { name: 'Dee', email: '' },
    ]);
    expect(errors).toHaveLength(1);
  });
});

describe('profile updates', () => {
  it('needs both halves of a plus-one name', () => {
    expect(
      UpdateProfileSchema.safeParse({ plusOneFirstName: 'Ike', plusOneLastName: 'Park' }).success,
    ).toBe(true);
    expect(
      UpdateProfileSchema.safeParse({ plusOneFirstName: '', plusOneLastName: '' }).success,
    ).toBe(true);
    expect(
      UpdateProfileSchema.safeParse({ plusOneFirstName: 'Ike', plusOneLastName: '' }).success,
    ).toBe(false);
  });
});

describe('CustomEmailSchema', () => {
  const base = { subject: 'Hi', html: '<p>Hello</p>', guestIds: ['g1'] };
  it('needs a subject, a body and at least one guest', () => {
    expect(CustomEmailSchema.safeParse(base).success).toBe(true);
    expect(CustomEmailSchema.safeParse({ ...base, subject: '  ' }).success).toBe(false);
    expect(CustomEmailSchema.safeParse({ ...base, html: '' }).success).toBe(false);
    expect(CustomEmailSchema.safeParse({ ...base, guestIds: [] }).success).toBe(false);
  });
  it('caps the size', () => {
    expect(
      CustomEmailSchema.safeParse({ ...base, html: 'x'.repeat(EMAIL_HTML_MAX + 1) }).success,
    ).toBe(false);
  });
});
