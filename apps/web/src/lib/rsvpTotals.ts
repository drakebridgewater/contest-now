import type { AdminGuest, RsvpStatus } from '@contest/shared';

export interface RsvpTotals {
  yes: number;
  maybe: number;
  no: number;
  pending: number;
  plusOnes: number;
  headcount: number;
  preregistered: Map<string, number>;
}

export function rsvpTotals(allGuests: readonly AdminGuest[]): RsvpTotals {
  // People waiting on (or turned away by) the host are not on the list yet.
  const guests = allGuests.filter((g) => g.access !== 'requested' && g.access !== 'declined');
  const count = (status: RsvpStatus) => guests.filter((g) => g.rsvpStatus === status).length;
  const plusOnes = guests.filter((g) => g.rsvpStatus === 'yes' && g.plusOneFirstName !== '').length;
  const preregistered = new Map<string, number>();
  for (const guest of guests) {
    if (guest.rsvpStatus === 'no') continue;
    for (const id of guest.preregistrations) {
      preregistered.set(id, (preregistered.get(id) ?? 0) + 1);
    }
  }
  return {
    yes: count('yes'),
    maybe: count('maybe'),
    no: count('no'),
    pending: count('pending'),
    plusOnes,
    headcount: count('yes') + plusOnes,
    preregistered,
  };
}
