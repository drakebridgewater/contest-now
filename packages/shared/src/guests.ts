import { z } from 'zod';
import { AllergenId } from './allergens.ts';
import { Slug } from './slug.ts';
import { VoterName } from './votes.ts';

export const GUEST_NAME_MAX = 60;
export const PHONE_MAX = 30;

export const RSVP_STATUSES = ['pending', 'yes', 'maybe', 'no'] as const;
export const RsvpStatus = z.enum(RSVP_STATUSES);
export type RsvpStatus = z.infer<typeof RsvpStatus>;

/**
 * What a session may do. `vote` comes from typing a name on the vote page (the
 * shared tablet); `full` comes from a magic link or an invite and also covers voting.
 */
export const SessionScope = z.enum(['vote', 'full']);
export type SessionScope = z.infer<typeof SessionScope>;

/** Guests without an email are given one on this domain; it is never shown or mailed. */
export const PLACEHOLDER_EMAIL_DOMAIN = 'guest.invalid';

export function isPlaceholderEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}

const PersonName = z.string().trim().max(GUEST_NAME_MAX);

/** The signed-in guest as the vote page needs them: enough to vote and filter. */
export const SessionGuestSchema = z.object({
  id: z.string(),
  name: z.string(),
  scope: SessionScope,
  allergies: z.array(z.string()),
});
export type SessionGuest = z.infer<typeof SessionGuestSchema>;

/** The RSVP a `full` session can read and edit. */
export const GuestProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  rsvpStatus: RsvpStatus,
  plusOneFirstName: z.string(),
  plusOneLastName: z.string(),
  allergies: z.array(z.string()),
  /** Category ids the guest might enter. No commitment. */
  preregistrations: z.array(z.string()),
});
export type GuestProfile = z.infer<typeof GuestProfileSchema>;

export const UpdateProfileSchema = z
  .object({
    name: VoterName,
    phone: z.string().trim().max(PHONE_MAX),
    rsvpStatus: RsvpStatus,
    plusOneFirstName: PersonName,
    plusOneLastName: PersonName,
    allergies: z.array(AllergenId).max(40),
    preregistrations: z.array(Slug).max(40),
  })
  .partial()
  .refine(
    (value) =>
      value.plusOneFirstName === undefined ||
      value.plusOneLastName === undefined ||
      (value.plusOneFirstName === '') === (value.plusOneLastName === ''),
    { message: 'Give your plus-one a first and last name', path: ['plusOneLastName'] },
  );
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

/** Ask for a sign-in link. The name is used when the email is new to us. */
export const RequestLinkSchema = z.object({
  email: z.email('Enter a valid email').trim().toLowerCase().max(200),
  name: VoterName.optional(),
});
export type RequestLink = z.infer<typeof RequestLinkSchema>;

export const VoteSignInSchema = z.object({ name: VoterName });
export const InviteSignInSchema = z.object({ token: z.string().min(20).max(200) });

/** Public: names only, for the submit form's autocomplete. */
export const GuestNameSchema = z.object({ id: z.string(), name: z.string() });
export type GuestName = z.infer<typeof GuestNameSchema>;

export const RsvpSummarySchema = z.object({
  yes: z.number().int(),
  maybe: z.number().int(),
  no: z.number().int(),
  pending: z.number().int(),
  plusOnes: z.number().int(),
  /** Guests who said yes plus their plus-ones. */
  headcount: z.number().int(),
  /** Category id to number of guests who might enter it. */
  preregistered: z.record(z.string(), z.number().int()),
});
export type RsvpSummary = z.infer<typeof RsvpSummarySchema>;

// ---- admin --------------------------------------------------------------------

export const INVITE_STATUSES = ['none', 'created', 'sent', 'opened'] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const AdminGuestSchema = GuestProfileSchema.omit({ email: true }).extend({
  /** Empty for walk-in guests who only ever typed their name. */
  email: z.string(),
  inviteStatus: z.enum(INVITE_STATUSES),
  entryCount: z.number().int(),
  voteCount: z.number().int(),
  completeVoteCount: z.number().int(),
  tastedCount: z.number().int(),
  ballotCount: z.number().int(),
  createdAt: z.string(),
});
export type AdminGuest = z.infer<typeof AdminGuestSchema>;

export const NewGuestSchema = z.object({
  name: VoterName,
  email: z.union([z.email('Enter a valid email').trim().toLowerCase(), z.literal('')]).default(''),
});
export type NewGuest = z.infer<typeof NewGuestSchema>;

export const AddGuestsSchema = z.object({ guests: z.array(NewGuestSchema).min(1).max(500) });
export type AddGuests = z.infer<typeof AddGuestsSchema>;

export interface AddGuestsResult {
  added: number;
  /** Already on the list (same name or email); left as they were. */
  skipped: { name: string; reason: string }[];
}

export const SendInvitesSchema = z.union([
  z.object({ guestIds: z.array(z.string()).min(1).max(500) }),
  z.object({ uninvited: z.literal(true) }),
]);
export type SendInvites = z.infer<typeof SendInvitesSchema>;

export interface SendInvitesResult {
  sent: number;
  /** Guests with no email address to send to. */
  skipped: number;
  failed: { name: string; error: string }[];
}

/**
 * Parses a pasted guest list: one guest per line, "Name, email" or "Name <email>"
 * or just a name. Blank lines are ignored; a line that cannot be read is reported.
 */
export function parseGuestLines(text: string): { guests: NewGuest[]; errors: string[] } {
  const guests: NewGuest[] = [];
  const errors: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') continue;
    const angle = /^(.*?)\s*<([^>]+)>\s*$/.exec(line);
    const [namePart, emailPart] = angle
      ? [angle[1] ?? '', angle[2] ?? '']
      : splitOnce(line, /[,\t;]/);
    const parsed = NewGuestSchema.safeParse({ name: namePart.trim(), email: emailPart.trim() });
    if (parsed.success) guests.push(parsed.data);
    else errors.push(`“${line}”: ${parsed.error.issues[0]?.message ?? 'could not read this line'}`);
  }
  return { guests, errors };
}

function splitOnce(line: string, separator: RegExp): [string, string] {
  const match = separator.exec(line);
  if (!match) return [line, ''];
  return [line.slice(0, match.index), line.slice(match.index + 1)];
}
