import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CreateEntryFields, Entry } from '@contest/shared';
import { desc, eq } from 'drizzle-orm';
import sharp from 'sharp';
import type { Db } from '../db/client.ts';
import { categories, entries } from '../db/schema.ts';
import { badRequest, conflict, notFound } from '../http/errors.ts';
import { getSettings } from './contest.ts';

export interface PhotoStorage {
  uploadsDir: string;
  publicPath: string;
}

export const PHOTO_MAX_EDGE = 1600;

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

/** Re-encodes any decodable image to a bounded WebP and writes it under uploadsDir. */
export async function storePhoto(buffer: Buffer, storage: PhotoStorage): Promise<string> {
  const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}.webp`;
  await fs.mkdir(storage.uploadsDir, { recursive: true });
  try {
    await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({
        width: PHOTO_MAX_EDGE,
        height: PHOTO_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toFile(path.join(storage.uploadsDir, fileName));
  } catch {
    throw badRequest('Could not read that photo. Please try a JPEG or PNG image.');
  }
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
