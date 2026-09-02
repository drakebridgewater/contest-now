import {
  slugify,
  type Award,
  type AwardInput,
  type Category,
  type CategoryInput,
  type ContestConfig,
  type Criterion,
  type CriterionInput,
  type EventSettings,
  type SettingsInput,
} from '@contest/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import {
  awardBallots,
  awardCategories,
  awards,
  categories,
  criteria,
  entries,
  eventSettings,
  voteScores,
} from '../db/schema.ts';
import { DEFAULT_EVENT_NAME } from '../db/seed.ts';
import { badRequest, conflict, notFound } from '../http/errors.ts';

// ---- settings -----------------------------------------------------------------

export async function getSettings(db: Db): Promise<EventSettings> {
  const row = await db
    .select()
    .from(eventSettings)
    .where(eq(eventSettings.id, 1))
    .then((r) => r[0]);
  if (!row) {
    await db
      .insert(eventSettings)
      .values({ id: 1, eventName: DEFAULT_EVENT_NAME })
      .onConflictDoNothing();
    return getSettings(db);
  }
  return toSettings(row);
}

export async function updateSettings(db: Db, input: SettingsInput): Promise<EventSettings> {
  await getSettings(db);
  const row = await db
    .update(eventSettings)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(eventSettings.id, 1))
    .returning()
    .then((r) => r[0]);
  if (!row) throw notFound('Settings not found');
  return toSettings(row);
}

function toSettings(row: typeof eventSettings.$inferSelect): EventSettings {
  return {
    eventName: row.eventName,
    tagline: row.tagline,
    photoShareUrl: row.photoShareUrl,
    votingOpen: row.votingOpen,
  };
}

// ---- config aggregate ---------------------------------------------------------

export async function getContestConfig(
  db: Db,
  opts: { includeInactive?: boolean } = {},
): Promise<ContestConfig> {
  const includeInactive = opts.includeInactive ?? false;
  const [settings, categoryRows, criterionRows, awardRows, scopeRows] = await Promise.all([
    getSettings(db),
    db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id)),
    db.select().from(criteria).orderBy(asc(criteria.sortOrder), asc(criteria.id)),
    db.select().from(awards).orderBy(asc(awards.sortOrder), asc(awards.id)),
    db.select().from(awardCategories),
  ]);

  const visibleCategories = categoryRows.filter((c) => includeInactive || c.isActive);
  const visibleCategoryIds = new Set(visibleCategories.map((c) => c.id));

  return {
    settings,
    categories: visibleCategories.map(toCategory),
    criteria: criterionRows
      .filter((c) => visibleCategoryIds.has(c.categoryId) && (includeInactive || c.isActive))
      .map(toCriterion),
    awards: awardRows
      .filter((a) => includeInactive || a.isActive)
      .map((a) =>
        toAward(
          a,
          scopeRows.filter((s) => s.awardId === a.id).map((s) => s.categoryId),
        ),
      ),
  };
}

export function toCategory(row: typeof categories.$inferSelect): Category {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    description: row.description,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

export function toCriterion(row: typeof criteria.$inferSelect): Criterion {
  return {
    id: row.id,
    categoryId: row.categoryId,
    slug: row.slug,
    name: row.name,
    helpText: row.helpText,
    weight: row.weight,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

export function toAward(row: typeof awards.$inferSelect, categoryIds: string[]): Award {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    description: row.description,
    categoryIds: [...categoryIds].sort(),
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

function idFromName(explicit: string | undefined, name: string, what: string): string {
  const id = explicit ?? slugify(name);
  if (!id) throw badRequest(`Could not derive an id for the ${what} "${name}". Provide an id.`);
  return id;
}

async function nextSortOrder(
  db: Db,
  table: typeof categories | typeof awards | typeof criteria,
): Promise<number> {
  const row = await db
    .select({ max: sql<number | null>`max(${table.sortOrder})` })
    .from(table)
    .then((r) => r[0]);
  return (row?.max ?? 0) + 10;
}

// ---- categories ---------------------------------------------------------------

export async function createCategory(db: Db, input: CategoryInput): Promise<Category> {
  const id = idFromName(input.id, input.name, 'category');
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, id));
  if (existing.length > 0) throw conflict(`A category with id "${id}" already exists`);
  const row = await db
    .insert(categories)
    .values({
      id,
      name: input.name,
      emoji: input.emoji ?? '',
      description: input.description ?? '',
      sortOrder: input.sortOrder ?? (await nextSortOrder(db, categories)),
      isActive: input.isActive ?? true,
    })
    .returning()
    .then((r) => r[0]!);
  return toCategory(row);
}

export async function updateCategory(db: Db, id: string, input: CategoryInput): Promise<Category> {
  if (input.id !== undefined && input.id !== id) {
    throw badRequest('A category id cannot be changed; create a new category instead');
  }
  const { id: _ignored, ...fields } = input;
  const row = await db
    .update(categories)
    .set(fields)
    .where(eq(categories.id, id))
    .returning()
    .then((r) => r[0]);
  if (!row) throw notFound(`Category "${id}" not found`);
  return toCategory(row);
}

export async function deleteCategory(db: Db, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const category = await tx
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .then((r) => r[0]);
    if (!category) throw notFound(`Category "${id}" not found`);

    const entryCount = await count(tx, entries, eq(entries.categoryId, id));
    if (entryCount > 0) {
      throw conflict(
        `"${category.name}" has ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}. Deactivate it instead of deleting.`,
      );
    }
    const criterionIds = await tx
      .select({ id: criteria.id })
      .from(criteria)
      .where(eq(criteria.categoryId, id))
      .then((rows) => rows.map((r) => r.id));
    if (criterionIds.length > 0) {
      const scoreCount = await count(tx, voteScores, inArray(voteScores.criterionId, criterionIds));
      if (scoreCount > 0) {
        throw conflict(
          `"${category.name}" already has ratings. Deactivate it instead of deleting.`,
        );
      }
      await tx.delete(criteria).where(eq(criteria.categoryId, id));
    }
    await tx.delete(categories).where(eq(categories.id, id));
  });
}

// ---- criteria -----------------------------------------------------------------

export async function createCriterion(db: Db, input: CriterionInput): Promise<Criterion> {
  const category = await db
    .select()
    .from(categories)
    .where(eq(categories.id, input.categoryId))
    .then((r) => r[0]);
  if (!category) throw badRequest(`Unknown category "${input.categoryId}"`);
  const slug = idFromName(input.slug, input.name, 'criterion');
  const existing = await db
    .select({ id: criteria.id })
    .from(criteria)
    .where(and(eq(criteria.categoryId, input.categoryId), eq(criteria.slug, slug)));
  if (existing.length > 0) throw conflict(`"${category.name}" already has a criterion "${slug}"`);
  const row = await db
    .insert(criteria)
    .values({
      categoryId: input.categoryId,
      slug,
      name: input.name,
      helpText: input.helpText ?? '',
      weight: input.weight ?? 1,
      sortOrder: input.sortOrder ?? (await nextSortOrder(db, criteria)),
      isActive: input.isActive ?? true,
    })
    .returning()
    .then((r) => r[0]!);
  return toCriterion(row);
}

export async function updateCriterion(
  db: Db,
  id: number,
  input: Partial<CriterionInput>,
): Promise<Criterion> {
  const current = await db
    .select()
    .from(criteria)
    .where(eq(criteria.id, id))
    .then((r) => r[0]);
  if (!current) throw notFound(`Criterion ${id} not found`);
  if (input.categoryId !== undefined && input.categoryId !== current.categoryId) {
    throw badRequest('A criterion cannot move to another category');
  }
  const slug = input.slug ?? current.slug;
  if (slug !== current.slug) {
    const clash = await db
      .select({ id: criteria.id })
      .from(criteria)
      .where(and(eq(criteria.categoryId, current.categoryId), eq(criteria.slug, slug)));
    if (clash.length > 0) throw conflict(`This category already has a criterion "${slug}"`);
  }
  const { categoryId: _c, ...fields } = input;
  const row = await db
    .update(criteria)
    .set({ ...fields, slug })
    .where(eq(criteria.id, id))
    .returning()
    .then((r) => r[0]!);
  return toCriterion(row);
}

export async function deleteCriterion(db: Db, id: number): Promise<void> {
  const current = await db
    .select()
    .from(criteria)
    .where(eq(criteria.id, id))
    .then((r) => r[0]);
  if (!current) throw notFound(`Criterion ${id} not found`);
  const scoreCount = await count(db, voteScores, eq(voteScores.criterionId, id));
  if (scoreCount > 0) {
    throw conflict(
      `"${current.name}" already has ${scoreCount} ratings. Deactivate it instead of deleting.`,
    );
  }
  await db.delete(criteria).where(eq(criteria.id, id));
}

// ---- awards -------------------------------------------------------------------

async function assertCategoriesExist(db: Db, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const found = await db
    .select({ id: categories.id })
    .from(categories)
    .where(inArray(categories.id, ids));
  const missing = ids.filter((id) => !found.some((f) => f.id === id));
  if (missing.length > 0) throw badRequest(`Unknown categories: ${missing.join(', ')}`);
}

export async function createAward(db: Db, input: AwardInput): Promise<Award> {
  const id = idFromName(input.id, input.name, 'award');
  const existing = await db.select({ id: awards.id }).from(awards).where(eq(awards.id, id));
  if (existing.length > 0) throw conflict(`An award with id "${id}" already exists`);
  const categoryIds = [...new Set(input.categoryIds ?? [])];
  await assertCategoriesExist(db, categoryIds);
  return db.transaction(async (tx) => {
    const row = await tx
      .insert(awards)
      .values({
        id,
        name: input.name,
        emoji: input.emoji ?? '',
        description: input.description ?? '',
        sortOrder: input.sortOrder ?? (await nextSortOrder(tx, awards)),
        isActive: input.isActive ?? true,
      })
      .returning()
      .then((r) => r[0]!);
    if (categoryIds.length > 0) {
      await tx
        .insert(awardCategories)
        .values(categoryIds.map((categoryId) => ({ awardId: id, categoryId })));
    }
    return toAward(row, categoryIds);
  });
}

export async function updateAward(db: Db, id: string, input: AwardInput): Promise<Award> {
  if (input.id !== undefined && input.id !== id) {
    throw badRequest('An award id cannot be changed; create a new award instead');
  }
  const categoryIds = input.categoryIds === undefined ? undefined : [...new Set(input.categoryIds)];
  if (categoryIds) await assertCategoriesExist(db, categoryIds);
  return db.transaction(async (tx) => {
    const { id: _ignored, categoryIds: _scope, ...fields } = input;
    const row = await tx
      .update(awards)
      .set(fields)
      .where(eq(awards.id, id))
      .returning()
      .then((r) => r[0]);
    if (!row) throw notFound(`Award "${id}" not found`);
    if (categoryIds) {
      await tx.delete(awardCategories).where(eq(awardCategories.awardId, id));
      if (categoryIds.length > 0) {
        await tx
          .insert(awardCategories)
          .values(categoryIds.map((categoryId) => ({ awardId: id, categoryId })));
      }
    }
    const scope = await tx
      .select({ categoryId: awardCategories.categoryId })
      .from(awardCategories)
      .where(eq(awardCategories.awardId, id));
    return toAward(
      row,
      scope.map((s) => s.categoryId),
    );
  });
}

export async function deleteAward(db: Db, id: string): Promise<void> {
  const current = await db
    .select()
    .from(awards)
    .where(eq(awards.id, id))
    .then((r) => r[0]);
  if (!current) throw notFound(`Award "${id}" not found`);
  const ballotCount = await count(db, awardBallots, eq(awardBallots.awardId, id));
  if (ballotCount > 0) {
    throw conflict(
      `"${current.name}" already has ${ballotCount} nominations. Deactivate it instead of deleting.`,
    );
  }
  await db.delete(awards).where(eq(awards.id, id));
}

// ---- helpers ------------------------------------------------------------------

async function count(
  db: Db,
  table: typeof entries | typeof voteScores | typeof awardBallots,
  where: ReturnType<typeof eq>,
): Promise<number> {
  const row = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(where)
    .then((r) => r[0]);
  return row?.count ?? 0;
}
