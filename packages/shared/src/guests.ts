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

/**
 * Who may sign in to the RSVP. Only `invited` guests get a sign-in link:
 * - `invited`: on the host's list, or approved by the host.
 * - `requested`: asked to join from the RSVP page; waiting on the host.
 * - `declined`: the host said no.
 * - `walk_in`: only ever typed a name on the voting tablet or submit form.
 */
export const GUEST_ACCESS = ['invited', 'requested', 'declined', 'walk_in'] as const;
export type GuestAccess = (typeof GUEST_ACCESS)[number];

/**
 * Ask for a sign-in link. The name is used when the email is new to us.
 * `requestAccess` asks the host to add someone who is not on the list yet.
 */
export const RequestLinkSchema = z.object({
  email: z.email('Enter a valid email').trim().toLowerCase().max(200),
  name: VoterName.optional(),
  requestAccess: z.boolean().optional(),
});
export type RequestLink = z.infer<typeof RequestLinkSchema>;

/** A link was emailed, or a request to join was passed to the host. */
export type RequestLinkResult = { sent: true } | { requested: true };

/**
 * Details on the 403 the RSVP page gets for someone not on the list: whether
 * they may ask to join, or have already asked.
 */
export interface NotInvitedDetails {
  notInvited: true;
  canRequest: boolean;
  alreadyRequested?: boolean;
}

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
  /** Every allergen id a guest who has not declined avoids. No names. */
  allergies: z.array(z.string()),
});
export type RsvpSummary = z.infer<typeof RsvpSummarySchema>;

// ---- admin --------------------------------------------------------------------

export const INVITE_STATUSES = ['none', 'created', 'sent', 'opened'] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const AdminGuestSchema = GuestProfileSchema.omit({ email: true }).extend({
  /** Empty for walk-in guests who only ever typed their name. */
  email: z.string(),
  inviteStatus: z.enum(INVITE_STATUSES),
  access: z.enum(GUEST_ACCESS),
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

/** The host approving (`invited`) or turning down (`declined`) a guest. */
export const SetGuestAccessSchema = z.object({ access: z.enum(['invited', 'declined']) });
export type SetGuestAccess = z.infer<typeof SetGuestAccessSchema>;

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

/**
 * Merge tags a host can drop into a custom email, written `{{ tag }}`. The links
 * are filled in per guest when the email is sent.
 */
export const EMAIL_MERGE_TAGS = {
  guest_name: 'Guest name',
  rsvp_link: 'Personal RSVP link',
  photo_album_link: 'Photo album link',
} as const;
export type EmailMergeTag = keyof typeof EMAIL_MERGE_TAGS;

export const EMAIL_SUBJECT_MAX = 200;
export const EMAIL_HTML_MAX = 50_000;

export const CustomEmailPreviewSchema = z.object({
  subject: z.string().trim().min(1).max(EMAIL_SUBJECT_MAX),
  html: z.string().trim().min(1).max(EMAIL_HTML_MAX),
});
export type CustomEmailPreview = z.infer<typeof CustomEmailPreviewSchema>;

export const CustomEmailSchema = CustomEmailPreviewSchema.extend({
  guestIds: z.array(z.string().min(1).max(64)).min(1).max(500),
});
export type CustomEmail = z.infer<typeof CustomEmailSchema>;

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
