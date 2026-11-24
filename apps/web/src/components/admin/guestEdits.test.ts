import type { AdminGuest } from '@contest/shared';
import { describe, expect, it } from 'vitest';
import { accessWarning, emailWarning, rsvpWarning } from './guestEdits.ts';
import { guestMatches, NO_FILTERS } from './guestFilter.ts';

const guest = (overrides: Partial<AdminGuest>): AdminGuest => ({
  id: overrides.name ?? 'g',
  name: 'Guest',
  email: '',
  phone: '',
  rsvpStatus: 'pending',
  plusOneFirstName: '',
  plusOneLastName: '',
  allergies: [],
  preregistrations: [],
  inviteStatus: 'none',
  access: 'invited',
  entryCount: 0,
  voteCount: 0,
  completeVoteCount: 0,
  tastedCount: 0,
  ballotCount: 0,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe('rsvpWarning', () => {
  it('lets the host record an answer for someone who has not replied', () => {
    expect(rsvpWarning([guest({ name: 'Ann' })], 'yes')).toBeNull();
  });

  it('asks before overwriting a guest’s own answer', () => {
    expect(rsvpWarning([guest({ name: 'Ann', rsvpStatus: 'no' })], 'yes')).toBe(
      'Ann answered “Not coming” themselves. Change it to “Coming”?',
    );
  });

  it('counts only the guests whose answer would change', () => {
    const warning = rsvpWarning(
      [
        guest({ name: 'Ann', rsvpStatus: 'no' }),
        guest({ name: 'Bo', rsvpStatus: 'yes' }),
        guest({ name: 'Cy' }),
      ],
      'yes',
    );
    expect(warning).toMatch(/^1 of these guests already answered themselves \(Ann\)/);
  });
});

describe('emailWarning', () => {
  it('is quiet when adding a first email', () => {
    expect(emailWarning(guest({ name: 'Ann' }), 'ann@example.com')).toBeNull();
  });

  it('says the old invite link stops working', () => {
    const warning = emailWarning(
      guest({ name: 'Ann', email: 'ann@old.com', inviteStatus: 'sent' }),
      'ann@new.com',
    );
    expect(warning).toContain('The invite link sent to ann@old.com stops working.');
  });
});

describe('accessWarning', () => {
  it('says approving emails the invite when mail works', () => {
    const asking = guest({ name: 'Gus', email: 'gus@example.com', access: 'requested' });
    expect(accessWarning([asking], 'invited', true)).toBe(
      'Let Gus in? Their invite is emailed straight away.',
    );
    expect(accessWarning([asking], 'invited', false)).toBe('Let Gus in?');
  });

  it('is null when nobody would change', () => {
    expect(accessWarning([guest({})], 'invited', true)).toBeNull();
  });
});

describe('guestMatches', () => {
  it('keeps RSVP answer and invite progress as separate filters', () => {
    const linkMade = guest({ email: 'a@example.com', inviteStatus: 'created', rsvpStatus: 'yes' });
    expect(guestMatches(linkMade, { ...NO_FILTERS, invite: 'not_sent', rsvp: 'yes' })).toBe(true);
    expect(guestMatches(linkMade, { ...NO_FILTERS, invite: 'sent' })).toBe(false);
    expect(guestMatches(guest({}), { ...NO_FILTERS, invite: 'not_sent' })).toBe(false);
  });

  it('searches name, email, phone and plus-one', () => {
    const ann = guest({ name: 'Ann Lee', phone: '555 0100', plusOneFirstName: 'Ike' });
    for (const search of ['ann', '0100', 'ike']) {
      expect(guestMatches(ann, { ...NO_FILTERS, search })).toBe(true);
    }
    expect(guestMatches(ann, { ...NO_FILTERS, search: 'zed' })).toBe(false);
  });
});
