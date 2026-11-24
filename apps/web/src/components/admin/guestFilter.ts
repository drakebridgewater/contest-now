import type { AdminGuest, GuestAccess, InviteStatus, RsvpStatus } from '@contest/shared';

export const RSVP_LABEL: Record<RsvpStatus, string> = {
  yes: 'Coming',
  maybe: 'Maybe',
  no: 'Not coming',
  pending: 'No reply',
};

/** Sort order for the RSVP column: the answers a host cares about first. */
export const RSVP_ORDER: Record<RsvpStatus, number> = { yes: 0, maybe: 1, pending: 2, no: 3 };

export const ACCESS_LABEL: Record<GuestAccess, string> = {
  invited: 'On the list',
  requested: 'Asking to join',
  declined: 'Declined',
  walk_in: 'Walk-in',
};

/** Whether the invite email went out. Set by the app, never by hand. */
export const INVITE_LABEL: Record<InviteStatus, string> = {
  none: 'Not sent',
  created: 'Link made',
  sent: 'Sent',
  opened: 'Opened',
};

export function inviteLabel(guest: AdminGuest): string {
  return guest.email === '' ? 'No email' : INVITE_LABEL[guest.inviteStatus];
}

/**
 * RSVP answer and invite progress are separate questions, so they are separate
 * filters: "who's coming" and "who have I not emailed yet" can be combined.
 */
export type InviteFilter = 'all' | 'not_sent' | 'sent' | 'opened' | 'no_email';

export interface GuestFilters {
  search: string;
  rsvp: RsvpStatus | 'all';
  invite: InviteFilter;
  access: GuestAccess | 'all';
}

export const NO_FILTERS: GuestFilters = { search: '', rsvp: 'all', invite: 'all', access: 'all' };

export const INVITE_FILTERS: readonly (readonly [InviteFilter, string])[] = [
  ['all', 'Any invite'],
  ['not_sent', 'Not sent yet'],
  ['sent', 'Sent, not opened'],
  ['opened', 'Opened'],
  ['no_email', 'No email'],
];

export function isFiltered(filters: GuestFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.rsvp !== 'all' ||
    filters.invite !== 'all' ||
    filters.access !== 'all'
  );
}

function matchesInvite(guest: AdminGuest, invite: InviteFilter): boolean {
  switch (invite) {
    case 'all':
      return true;
    case 'no_email':
      return guest.email === '';
    case 'not_sent':
      return (
        guest.email !== '' && (guest.inviteStatus === 'none' || guest.inviteStatus === 'created')
      );
    case 'sent':
      return guest.email !== '' && guest.inviteStatus === 'sent';
    case 'opened':
      return guest.email !== '' && guest.inviteStatus === 'opened';
  }
}

export function guestMatches(guest: AdminGuest, filters: GuestFilters): boolean {
  if (filters.rsvp !== 'all' && guest.rsvpStatus !== filters.rsvp) return false;
  if (filters.access !== 'all' && guest.access !== filters.access) return false;
  if (!matchesInvite(guest, filters.invite)) return false;
  const query = filters.search.trim().toLowerCase();
  if (query === '') return true;
  return [
    guest.name,
    guest.email,
    guest.phone,
    `${guest.plusOneFirstName} ${guest.plusOneLastName}`,
  ].some((field) => field.toLowerCase().includes(query));
}

/** Who an invite or a custom email can go to: on the list, with an address. */
export function canEmail(guest: AdminGuest): boolean {
  return guest.email !== '' && guest.access === 'invited';
}

/** What the guest has done at the party, for the read-only Activity column. */
export function activityText(guest: AdminGuest): string {
  return [
    guest.entryCount > 0
      ? `${guest.entryCount} ${guest.entryCount === 1 ? 'entry' : 'entries'}`
      : '',
    guest.tastedCount > 0 ? `${guest.tastedCount} checked off` : '',
    guest.completeVoteCount > 0 ? `${guest.completeVoteCount} rated` : '',
    guest.ballotCount > 0 ? `${guest.ballotCount} nominations` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
