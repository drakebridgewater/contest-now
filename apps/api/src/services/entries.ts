import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PHOTO_STORED_EXTENSION, type CreateEntryFields, type Entry } from '@contest/shared';
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { categories, entries } from '../db/schema.ts';
import { badRequest, conflict, notFound } from '../http/errors.ts';
import { getSettings } from './contest.ts';
import { toStoredPhoto } from './photos.ts';

export interface PhotoStorage {
  uploadsDir: string;
  publicPath: string;
}

export function toEntry(row: typeof entries.$inferSelect, storage: PhotoStorage): Entry {
  return {
    id: row.id,
    entryName: row.entryName,
    contestantName: row.contestantName,
    categoryId: row.categoryId,
    photoUrl: `${storage.publicPath}/${row.photoPath}`,
    allergens: row.allergens,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listEntries(db: Db, storage: PhotoStorage): Promise<Entry[]> {
  const rows = await db.select().from(entries).orderBy(desc(entries.createdAt), desc(entries.id));
  return rows.map((row) => toEntry(row, storage));
}

export async function getEntry(db: Db, id: number): Promise<typeof entries.$inferSelect> {
  const row = await db
    .select()
    .from(entries)
    .where(eq(entries.id, id))
    .then((r) => r[0]);
  if (!row) throw notFound(`Entry ${id} not found`);
  return row;
}

/**
 * Converts an upload of any supported format to the stored one and writes it
 * under uploadsDir. Conversion happens fully in memory first, so a file that
 * turns out to be unreadable never leaves a stray half-written photo behind.
 */
export async function storePhoto(buffer: Buffer, storage: PhotoStorage): Promise<string> {
  const stored = await toStoredPhoto(buffer);
  const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}.${PHOTO_STORED_EXTENSION}`;
  await fs.mkdir(storage.uploadsDir, { recursive: true });
  await fs.writeFile(path.join(storage.uploadsDir, fileName), stored);
  return fileName;
}

export async function createEntry(
  db: Db,
  fields: CreateEntryFields,
  photo: Buffer,
  storage: PhotoStorage,
): Promise<Entry> {
  const settings = await getSettings(db);
  if (!settings.votingOpen) throw conflict('Submissions are closed');
  const category = await db
    .select()
    .from(categories)
    .where(eq(categories.id, fields.categoryId))
    .then((r) => r[0]);
  if (!category || !category.isActive) throw badRequest(`Unknown category "${fields.categoryId}"`);

  const photoPath = await storePhoto(photo, storage);
  try {
    const row = await db
      .insert(entries)
      .values({
        entryName: fields.entryName,
        contestantName: fields.contestantName,
        categoryId: fields.categoryId,
        allergens: fields.allergens,
        photoPath,
      })
      .returning()
      .then((r) => r[0]!);
    return toEntry(row, storage);
  } catch (error) {
    await fs.rm(path.join(storage.uploadsDir, photoPath), { force: true });
    throw error;
  }
}

export async function deleteEntry(db: Db, id: number, storage: PhotoStorage): Promise<void> {
  const row = await getEntry(db, id);
  await db.delete(entries).where(eq(entries.id, id));
  await fs.rm(path.join(storage.uploadsDir, row.photoPath), { force: true });
}
