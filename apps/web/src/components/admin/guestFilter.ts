import type { AdminGuest, RsvpStatus } from '@contest/shared';

export type GuestFilter = RsvpStatus | 'all' | 'uninvited';

/** The RSVP filter chips, shared by the Guests and Email tabs. */
export const GUEST_FILTERS: readonly (readonly [GuestFilter, string])[] = [
  ['all', 'All'],
  ['yes', 'Coming'],
  ['maybe', 'Maybe'],
  ['pending', 'No reply'],
  ['no', 'Not coming'],
  ['uninvited', 'Not invited'],
];

export function guestMatchesFilter(guest: AdminGuest, filter: GuestFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'uninvited') {
    return guest.inviteStatus === 'none' && guest.email !== '' && guest.access === 'invited';
  }
  return guest.rsvpStatus === filter;
}
