import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

// Column names are derived from the keys with casing: 'snake_case' (see db/client.ts and drizzle.config.ts).

/** Single-row table holding event branding and the voting switch. */
export const eventSettings = pgTable(
  'event_settings',
  {
    id: smallint().primaryKey().default(1),
    eventName: text().notNull(),
    tagline: text().notNull().default(''),
    photoShareUrl: text().notNull().default(''),
    votingOpen: boolean().notNull().default(true),
    votingOpensAt: timestamp({ withTimezone: true }),
    submissionsOpen: boolean().notNull().default(true),
    submissionsOpenAt: timestamp({ withTimezone: true }),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('event_settings_singleton', sql`${t.id} = 1`)],
);

export const categories = pgTable('categories', {
  id: text().primaryKey(),
  name: text().notNull(),
  emoji: text().notNull().default(''),
  description: text().notNull().default(''),
  sortOrder: integer().notNull().default(0),
  isActive: boolean().notNull().default(true),
});

export const criteria = pgTable(
  'criteria',
  {
    id: serial().primaryKey(),
    categoryId: text()
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    slug: text().notNull(),
    name: text().notNull(),
    helpText: text().notNull().default(''),
    weight: real().notNull().default(1),
    sortOrder: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
  },
  (t) => [
    unique('criteria_category_slug').on(t.categoryId, t.slug),
    check('criteria_weight_positive', sql`${t.weight} > 0`),
  ],
);

export const awards = pgTable('awards', {
  id: text().primaryKey(),
  name: text().notNull(),
  emoji: text().notNull().default(''),
  description: text().notNull().default(''),
  sortOrder: integer().notNull().default(0),
  isActive: boolean().notNull().default(true),
});

/** Scope of an award. No rows for an award = every category. */
export const awardCategories = pgTable(
  'award_categories',
  {
    awardId: text()
      .notNull()
      .references(() => awards.id, { onDelete: 'cascade' }),
    categoryId: text()
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.awardId, t.categoryId] })],
);

export const entries = pgTable(
  'entries',
  {
    id: serial().primaryKey(),
    entryName: text().notNull(),
    contestantName: text().notNull(),
    categoryId: text()
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    photoPath: text().notNull(),
    allergens: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** The guest who brought it, when known. Kept if the guest is deleted. */
    guestId: text().references(() => guests.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('entries_category_idx').on(t.categoryId), index('entries_guest_idx').on(t.guestId)],
);

export const votes = pgTable(
  'votes',
  {
    id: serial().primaryKey(),
    /** Normalized (trimmed, lowercased). */
    voterName: text().notNull(),
    entryId: integer()
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    comment: text().notNull().default(''),
    /** The voter has tried this entry. Set by rating it, or on its own. */
    tasted: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('votes_voter_entry').on(t.voterName, t.entryId),
    index('votes_voter_idx').on(t.voterName),
  ],
);

export const voteScores = pgTable(
  'vote_scores',
  {
    voteId: integer()
      .notNull()
      .references(() => votes.id, { onDelete: 'cascade' }),
    criterionId: integer()
      .notNull()
      .references(() => criteria.id, { onDelete: 'restrict' }),
    rating: smallint().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.voteId, t.criterionId] }),
    check('vote_scores_rating_range', sql`${t.rating} between 1 and 5`),
  ],
);

export const awardBallots = pgTable(
  'award_ballots',
  {
    id: serial().primaryKey(),
    voterName: text().notNull(),
    awardId: text()
      .notNull()
      .references(() => awards.id, { onDelete: 'cascade' }),
    entryId: integer()
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('award_ballots_voter_award').on(t.voterName, t.awardId),
    index('award_ballots_voter_idx').on(t.voterName),
  ],
);

// ---- guests & auth ------------------------------------------------------------
// `guests`, `guestSessions`, `authAccounts` and `authVerifications` are Better
// Auth's user, session, account and verification models (see auth.ts); the
// columns it knows are named as it expects. Everything after `updatedAt` on
// `guests` is ours and only ever written through services/guests.ts.

export const guests = pgTable(
  'guests',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    /** Real address, or a placeholder at PLACEHOLDER_EMAIL_DOMAIN for name-only guests. */
    email: text().notNull().unique(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** normalizeVoterName(name): the key votes and ballots are filed under. */
    nameKey: text().notNull().unique(),
    phone: text().notNull().default(''),
    rsvpStatus: text().notNull().default('pending'),
    plusOneFirstName: text().notNull().default(''),
    plusOneLastName: text().notNull().default(''),
    allergies: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** sha256 of the current invite token; replacing it revokes the old link. */
    inviteTokenHash: text().unique(),
    inviteCreatedAt: timestamp({ withTimezone: true }),
    inviteSentAt: timestamp({ withTimezone: true }),
    inviteOpenedAt: timestamp({ withTimezone: true }),
  },
  (t) => [check('guests_rsvp_status', sql`${t.rsvpStatus} in ('pending', 'yes', 'maybe', 'no')`)],
);

export const guestSessions = pgTable(
  'guest_sessions',
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => guests.id, { onDelete: 'cascade' }),
    /** 'vote' (name typed on the vote page) or 'full' (magic link or invite). */
    scope: text().notNull().default('full'),
  },
  (t) => [index('guest_sessions_user_idx').on(t.userId)],
);

export const authAccounts = pgTable('auth_accounts', {
  id: text().primaryKey(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text()
    .notNull()
    .references(() => guests.id, { onDelete: 'cascade' }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestamp({ withTimezone: true }),
  refreshTokenExpiresAt: timestamp({ withTimezone: true }),
  scope: text(),
  password: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const authVerifications = pgTable(
  'auth_verifications',
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('auth_verifications_identifier_idx').on(t.identifier)],
);

/** "I might enter this category" — no commitment, just a headcount. */
export const guestPreregistrations = pgTable(
  'guest_preregistrations',
  {
    guestId: text()
      .notNull()
      .references(() => guests.id, { onDelete: 'cascade' }),
    categoryId: text()
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.guestId, t.categoryId] })],
);

export const schema = {
  guests,
  guestSessions,
  authAccounts,
  authVerifications,
  guestPreregistrations,
  eventSettings,
  categories,
  criteria,
  awards,
  awardCategories,
  entries,
  votes,
  voteScores,
  awardBallots,
};
export type Schema = typeof schema;
