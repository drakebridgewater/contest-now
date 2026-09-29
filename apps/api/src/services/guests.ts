import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  isPlaceholderEmail,
  normalizeVoterName,
  PLACEHOLDER_EMAIL_DOMAIN,
  type AddGuestsResult,
  type AdminGuest,
  type GuestName,
  type GuestProfile,
  type InviteStatus,
  type NewGuest,
  type RsvpStatus,
  type RsvpSummary,
  type SendInvitesResult,
  type SessionGuest,
  type SessionScope,
  type UpdateProfile,
} from '@contest/shared';
import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import {
  awardBallots,
  categories,
  entries,
  guestPreregistrations,
  guests,
  votes,
} from '../db/schema.ts';
import { badRequest, conflict, notFound } from '../http/errors.ts';
import { linkEmail, type Mailer } from './mailer.ts';
import { listVoters } from './votes.ts';

type GuestRow = typeof guests.$inferSelect;

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Tidies a typed name for display: trimmed, single spaces. */
function tidyName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function placeholderEmail(): string {
  return `${randomUUID()}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

function realEmail(email: string): string {
  return isPlaceholderEmail(email) ? '' : email;
}

// ---- lookups ------------------------------------------------------------------

async function guestByKey(db: Db, key: string): Promise<GuestRow | undefined> {
  return db
    .select()
    .from(guests)
    .where(eq(guests.nameKey, key))
    .then((r) => r[0]);
}

async function guestByEmail(db: Db, email: string): Promise<GuestRow | undefined> {
  return db
    .select()
    .from(guests)
    .where(eq(guests.email, email.toLowerCase()))
    .then((r) => r[0]);
}

export async function getGuest(db: Db, id: string): Promise<GuestRow> {
  const row = await db
    .select()
    .from(guests)
    .where(eq(guests.id, id))
    .then((r) => r[0]);
  if (!row) throw notFound('Guest not found');
  return row;
}

/**
 * The guest a typed name belongs to, creating a name-only guest the first time.
 * This is the tablet's whole sign-in, and how the submit form files an entry
 * under a cook who never RSVP'd.
 */
export async function findOrCreateGuestByName(
  db: Db,
  rawName: string,
): Promise<Pick<GuestRow, 'id' | 'name'>> {
  const name = tidyName(rawName);
  const key = normalizeVoterName(name);
  const existing = await guestByKey(db, key);
  if (existing) return existing;
  await db
    .insert(guests)
    .values({ id: randomUUID(), name, email: placeholderEmail(), nameKey: key })
    .onConflictDoNothing({ target: guests.nameKey });
  // Re-read: a second tablet may have typed the same name at the same moment.
  const row = await guestByKey(db, key);
  if (!row) throw conflict('Could not add that guest. Try again.');
  return row;
}

// ---- session views ------------------------------------------------------------

export function toSessionGuest(row: GuestRow, scope: SessionScope): SessionGuest {
  return { id: row.id, name: row.name, scope, allergies: row.allergies };
}

async function preregistrationsOf(db: Db, guestId: string): Promise<string[]> {
  const rows = await db
    .select({ categoryId: guestPreregistrations.categoryId })
    .from(guestPreregistrations)
    .where(eq(guestPreregistrations.guestId, guestId))
    .orderBy(asc(guestPreregistrations.categoryId));
  return rows.map((r) => r.categoryId);
}

export async function getProfile(db: Db, guestId: string): Promise<GuestProfile> {
  const row = await getGuest(db, guestId);
  return toProfile(row, await preregistrationsOf(db, guestId));
}

function toProfile(row: GuestRow, preregistrations: string[]): GuestProfile {
  return {
    id: row.id,
    name: row.name,
    email: realEmail(row.email),
    phone: row.phone,
    rsvpStatus: row.rsvpStatus as RsvpStatus,
    plusOneFirstName: row.plusOneFirstName,
    plusOneLastName: row.plusOneLastName,
    allergies: row.allergies,
    preregistrations,
  };
}

// ---- profile writes -----------------------------------------------------------

/**
 * Moves everything filed under one name key to another: votes and ballots are
 * keyed by name, not guest id, so renaming a guest has to carry them along.
 */
async function moveVoterKey(tx: Db, oldKey: string, newKey: string): Promise<void> {
  if (oldKey === newKey) return;
  await tx.update(votes).set({ voterName: newKey }).where(eq(votes.voterName, oldKey));
  await tx
    .update(awardBallots)
    .set({ voterName: newKey })
    .where(eq(awardBallots.voterName, oldKey));
}

async function renameInTx(tx: Db, row: GuestRow, rawName: string): Promise<void> {
  const name = tidyName(rawName);
  const key = normalizeVoterName(name);
  if (key !== row.nameKey) {
    const clash = await guestByKey(tx, key);
    if (clash) {
      throw conflict(`“${name}” is already on the guest list. Add a surname to tell you apart.`);
    }
    await moveVoterKey(tx, row.nameKey, key);
  }
  await tx
    .update(guests)
    .set({ name, nameKey: key, updatedAt: new Date() })
    .where(eq(guests.id, row.id));
}

export async function updateProfile(
  db: Db,
  guestId: string,
  input: UpdateProfile,
): Promise<GuestProfile> {
  const { name, preregistrations, ...fields } = input;
  if (preregistrations !== undefined) {
    const unique = [...new Set(preregistrations)];
    const known =
      unique.length === 0
        ? []
        : await db
            .select({ id: categories.id })
            .from(categories)
            .where(and(inArray(categories.id, unique), eq(categories.isActive, true)));
    const missing = unique.filter((id) => !known.some((k) => k.id === id));
    if (missing.length > 0) throw badRequest(`Unknown categories: ${missing.join(', ')}`);
  }
  await db.transaction(async (tx) => {
    const row = await getGuest(tx, guestId);
    if (name !== undefined) await renameInTx(tx, row, name);
    if (Object.keys(fields).length > 0) {
      await tx
        .update(guests)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(guests.id, guestId));
    }
    if (preregistrations !== undefined) {
      await tx.delete(guestPreregistrations).where(eq(guestPreregistrations.guestId, guestId));
      const unique = [...new Set(preregistrations)];
      if (unique.length > 0) {
        await tx
          .insert(guestPreregistrations)
          .values(unique.map((categoryId) => ({ guestId, categoryId })));
      }
    }
  });
  return getProfile(db, guestId);
}

/**
 * Makes sure a guest owns `email` before a sign-in link is mailed to it.
 *
 * - The email is known: that guest.
 * - A name-only guest has this name (they voted on the tablet or brought a dish
 *   before RSVPing): the email is attached to them, so their votes and entries
 *   follow. It stays unverified until the link is used.
 * - The name belongs to someone with a different email: refused, rather than
 *   letting a stranger take over an RSVP by typing its name.
 * - Otherwise a new guest.
 */
export async function ensureGuestForEmail(
  db: Db,
  email: string,
  rawName: string | undefined,
): Promise<GuestRow> {
  const byEmail = await guestByEmail(db, email);
  if (byEmail) return byEmail;
  if (!rawName) {
    throw badRequest('We don’t have that email yet. Tell us your name too.', { needsName: true });
  }
  const name = tidyName(rawName);
  const key = normalizeVoterName(name);
  const byName = await guestByKey(db, key);
  if (byName) {
    if (!isPlaceholderEmail(byName.email)) {
      throw conflict(
        `“${name}” has already RSVP'd with a different email. Use that email, or add a surname if you are someone else.`,
      );
    }
    await db
      .update(guests)
      .set({ email, emailVerified: false, updatedAt: new Date() })
      .where(eq(guests.id, byName.id));
    return { ...byName, email, emailVerified: false };
  }
  const row = await db
    .insert(guests)
    .values({ id: randomUUID(), name, email, nameKey: key })
    .returning()
    .then((r) => r[0]!);
  return row;
}

// ---- public lists -------------------------------------------------------------

export async function listGuestNames(db: Db): Promise<GuestName[]> {
  return db
    .select({ id: guests.id, name: guests.name })
    .from(guests)
    .where(ne(guests.rsvpStatus, 'no'))
    .orderBy(asc(guests.nameKey));
}

export async function rsvpSummary(db: Db): Promise<RsvpSummary> {
  const [statusRows, plusOneRow, preregRows] = await Promise.all([
    db
      .select({ status: guests.rsvpStatus, count: sql<number>`count(*)::int` })
      .from(guests)
      .groupBy(guests.rsvpStatus),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(guests)
      .where(and(eq(guests.rsvpStatus, 'yes'), ne(guests.plusOneFirstName, '')))
      .then((r) => r[0]),
    db
      .select({
        categoryId: guestPreregistrations.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(guestPreregistrations)
      .innerJoin(guests, eq(guests.id, guestPreregistrations.guestId))
      .where(ne(guests.rsvpStatus, 'no'))
      .groupBy(guestPreregistrations.categoryId),
  ]);
  const count = (status: RsvpStatus) => statusRows.find((r) => r.status === status)?.count ?? 0;
  const plusOnes = plusOneRow?.count ?? 0;
  return {
    yes: count('yes'),
    maybe: count('maybe'),
    no: count('no'),
    pending: count('pending'),
    plusOnes,
    headcount: count('yes') + plusOnes,
    preregistered: Object.fromEntries(preregRows.map((r) => [r.categoryId, r.count])),
  };
}

// ---- admin --------------------------------------------------------------------

function inviteStatus(row: GuestRow): InviteStatus {
  if (row.inviteOpenedAt) return 'opened';
  if (row.inviteSentAt) return 'sent';
  if (row.inviteTokenHash) return 'created';
  return 'none';
}

export async function listGuests(db: Db): Promise<AdminGuest[]> {
  const [rows, preregRows, entryRows, voters] = await Promise.all([
    db.select().from(guests).orderBy(asc(guests.nameKey)),
    db.select().from(guestPreregistrations),
    db
      .select({ guestId: entries.guestId, count: sql<number>`count(*)::int` })
      .from(entries)
      .groupBy(entries.guestId),
    listVoters(db),
  ]);
  const voterByKey = new Map(voters.map((v) => [v.voterName, v] as const));
  return rows.map((row) => {
    const voter = voterByKey.get(row.nameKey);
    return {
      ...toProfile(
        row,
        preregRows.filter((p) => p.guestId === row.id).map((p) => p.categoryId),
      ),
      inviteStatus: inviteStatus(row),
      entryCount: entryRows.find((e) => e.guestId === row.id)?.count ?? 0,
      voteCount: voter?.voteCount ?? 0,
      completeVoteCount: voter?.completeVoteCount ?? 0,
      tastedCount: voter?.tastedCount ?? 0,
      ballotCount: voter?.ballotCount ?? 0,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

export async function addGuests(db: Db, list: NewGuest[]): Promise<AddGuestsResult> {
  const result: AddGuestsResult = { added: 0, skipped: [] };
  for (const entry of list) {
    const name = tidyName(entry.name);
    const key = normalizeVoterName(name);
    const email = entry.email.toLowerCase();
    if (email && (await guestByEmail(db, email))) {
      result.skipped.push({ name, reason: `${email} is already on the list` });
      continue;
    }
    const byName = await guestByKey(db, key);
    if (byName) {
      // A walk-in who voted before the host added them: give them the email.
      if (email && isPlaceholderEmail(byName.email)) {
        await db
          .update(guests)
          .set({ email, updatedAt: new Date() })
          .where(eq(guests.id, byName.id));
        result.added += 1;
      } else {
        result.skipped.push({ name, reason: 'A guest with this name is already on the list' });
      }
      continue;
    }
    await db
      .insert(guests)
      .values({ id: randomUUID(), name, email: email || placeholderEmail(), nameKey: key });
    result.added += 1;
  }
  return result;
}

export async function renameGuest(db: Db, guestId: string, newName: string): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await getGuest(tx, guestId);
    await renameInTx(tx, row, newName);
  });
}

/** Deletes the guest and their votes and ballots. Their entries stay, unlinked. */
export async function deleteGuest(
  db: Db,
  guestId: string,
): Promise<{ votes: number; ballots: number }> {
  return db.transaction(async (tx) => {
    const row = await getGuest(tx, guestId);
    const deletedVotes = await tx
      .delete(votes)
      .where(eq(votes.voterName, row.nameKey))
      .returning({ id: votes.id });
    const deletedBallots = await tx
      .delete(awardBallots)
      .where(eq(awardBallots.voterName, row.nameKey))
      .returning({ id: awardBallots.id });
    await tx.delete(guests).where(eq(guests.id, guestId));
    return { votes: deletedVotes.length, ballots: deletedBallots.length };
  });
}

export function inviteUrl(publicUrl: string, token: string): string {
  return `${publicUrl}/register?invite=${encodeURIComponent(token)}`;
}

/**
 * A fresh personal RSVP link for the guest. Only its hash is stored, so the
 * link cannot be shown again later; making a new one revokes the previous one.
 */
export async function createInviteLink(
  db: Db,
  publicUrl: string,
  guestId: string,
): Promise<{ url: string }> {
  await getGuest(db, guestId);
  const token = randomBytes(24).toString('base64url');
  await db
    .update(guests)
    .set({
      inviteTokenHash: hashToken(token),
      inviteCreatedAt: new Date(),
      inviteOpenedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(guests.id, guestId));
  return { url: inviteUrl(publicUrl, token) };
}

export async function sendInvites(
  db: Db,
  mailer: Mailer,
  publicUrl: string,
  eventName: string,
  selector: { guestIds: string[] } | { uninvited: true },
): Promise<SendInvitesResult> {
  const rows =
    'guestIds' in selector
      ? await db.select().from(guests).where(inArray(guests.id, selector.guestIds))
      : await db.select().from(guests).where(isNull(guests.inviteSentAt));
  const result: SendInvitesResult = { sent: 0, skipped: 0, failed: [] };
  for (const row of rows) {
    if (isPlaceholderEmail(row.email)) {
      result.skipped += 1;
      continue;
    }
    const { url } = await createInviteLink(db, publicUrl, row.id);
    try {
      await mailer.send(
        linkEmail({
          to: row.email,
          subject: `You're invited: ${eventName}`,
          greeting: `Hi ${row.name},`,
          body: `You're invited to ${eventName}! Tap below to RSVP, add a plus-one, note any allergies, and tell us if you might enter the contest. No password needed.`,
          buttonLabel: 'RSVP now',
          url,
          footer: 'This link is just for you, so please don’t forward it.',
        }),
      );
      await db.update(guests).set({ inviteSentAt: new Date() }).where(eq(guests.id, row.id));
      result.sent += 1;
    } catch (error) {
      result.failed.push({
        name: row.name,
        error: error instanceof Error ? error.message : 'Could not send',
      });
    }
  }
  return result;
}
