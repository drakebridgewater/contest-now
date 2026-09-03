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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('entries_category_idx').on(t.categoryId)],
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

export const schema = {
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
