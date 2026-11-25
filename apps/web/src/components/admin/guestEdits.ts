import type { AdminGuest, RsvpStatus } from '@contest/shared';
import { RSVP_LABEL } from './guestFilter.ts';

/**
 * Warnings shown before the host overwrites something that is not theirs to
 * change casually: a guest's own RSVP answer, the address their invite went to,
 * or their access. `null` means the change is safe to make without asking.
 */

function names(guests: readonly AdminGuest[], max = 3): string {
  const shown = guests.slice(0, max).map((g) => g.name);
  const more = guests.length - shown.length;
  return more > 0 ? `${shown.join(', ')} and ${more} more` : shown.join(', ');
}

export function rsvpWarning(guests: readonly AdminGuest[], next: RsvpStatus): string | null {
  const answered = guests.filter((g) => g.rsvpStatus !== 'pending' && g.rsvpStatus !== next);
  if (answered.length === 0) return null;
  if (guests.length === 1) {
    const [guest] = answered;
    return `${guest!.name} answered “${RSVP_LABEL[guest!.rsvpStatus]}” themselves. Change it to “${RSVP_LABEL[next]}”?`;
  }
  return `${answered.length} of these guests already answered themselves (${names(answered)}). Overwrite their RSVP with “${RSVP_LABEL[next]}”?`;
}

export function emailWarning(guest: AdminGuest, next: string): string | null {
  if (guest.email === '' || guest.email === next) return null;
  const sentTo =
    guest.inviteStatus === 'none' ? '' : ` The invite link sent to ${guest.email} stops working.`;
  const action =
    next === ''
      ? `Remove ${guest.name}’s email? They can no longer get invites or sign-in links.`
      : `Change ${guest.name}’s email to ${next}?`;
  return `${action}${sentTo} They are signed out of their RSVP${next === '' ? '' : ' until you send a new invite'}.`;
}

export function accessWarning(
  guests: readonly AdminGuest[],
  next: 'invited' | 'declined',
  mailConfigured: boolean,
): string | null {
  const changing = guests.filter((g) => g.access !== next);
  if (changing.length === 0) return null;
  const who = guests.length === 1 ? changing[0]!.name : `${changing.length} guests`;
  if (next === 'declined') {
    return `Decline ${who}? Their invite links stop working and they are signed out of the RSVP.`;
  }
  const mailed = changing.filter((g) => g.email !== '').length;
  return mailConfigured && mailed > 0
    ? `Let ${who} in? ${guests.length === 1 ? 'Their' : `${mailed} RSVP`} invite${guests.length === 1 ? ' is' : 's are'} emailed straight away.`
    : `Let ${who} in?`;
}

export function deleteWarning(guests: readonly AdminGuest[]): string {
  const who = guests.length === 1 ? guests[0]!.name : `${guests.length} guests`;
  return `Delete ${who} and all of their ratings and nominations? This cannot be undone.`;
}
