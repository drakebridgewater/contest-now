import { isEntryInAwardScope } from '@contest/shared';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import {
  awardCategories,
  awards,
  awardWinners,
  categories,
  categoryWinners,
} from '../db/schema.ts';
import { badRequest, notFound } from '../http/errors.ts';
import { getEntry } from './entries.ts';

/** Marks `entryId` as the category's winner, or clears the pick when it is null. */
export async function setCategoryWinner(
  db: Db,
  categoryId: string,
  entryId: number | null,
): Promise<void> {
  const category = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .then((r) => r[0]);
  if (!category) throw notFound(`Category "${categoryId}" not found`);
  if (entryId === null) {
    await db.delete(categoryWinners).where(eq(categoryWinners.categoryId, categoryId));
    return;
  }
  const entry = await getEntry(db, entryId);
  if (entry.categoryId !== categoryId) {
    throw badRequest(`"${entry.entryName}" is not in this category`);
  }
  await db
    .insert(categoryWinners)
    .values({ categoryId, entryId })
    .onConflictDoUpdate({
      target: categoryWinners.categoryId,
      set: { entryId, updatedAt: new Date() },
    });
}

/** Marks `entryId` as the award's winner, or clears the pick when it is null. */
export async function setAwardWinner(
  db: Db,
  awardId: string,
  entryId: number | null,
): Promise<void> {
  const award = await db
    .select({ id: awards.id })
    .from(awards)
    .where(eq(awards.id, awardId))
    .then((r) => r[0]);
  if (!award) throw notFound(`Award "${awardId}" not found`);
  if (entryId === null) {
    await db.delete(awardWinners).where(eq(awardWinners.awardId, awardId));
    return;
  }
  const entry = await getEntry(db, entryId);
  const scope = await db
    .select({ categoryId: awardCategories.categoryId })
    .from(awardCategories)
    .where(eq(awardCategories.awardId, awardId));
  if (!isEntryInAwardScope({ categoryIds: scope.map((s) => s.categoryId) }, entry)) {
    throw badRequest(`"${entry.entryName}" is not eligible for this award`);
  }
  await db
    .insert(awardWinners)
    .values({ awardId, entryId })
    .onConflictDoUpdate({ target: awardWinners.awardId, set: { entryId, updatedAt: new Date() } });
}
