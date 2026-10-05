import type { Announcement } from '@contest/shared';
import { desc, eq, gt } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { announcements } from '../db/schema.ts';
import { notFound } from '../http/errors.ts';

type Row = typeof announcements.$inferSelect;

const toAnnouncement = (row: Row): Announcement => ({
  id: row.id,
  message: row.message,
  createdAt: row.createdAt.toISOString(),
  expiresAt: row.expiresAt.toISOString(),
});

/** What guests can still see, newest first. */
export async function listActiveAnnouncements(db: Db, now = new Date()): Promise<Announcement[]> {
  const rows = await db
    .select()
    .from(announcements)
    .where(gt(announcements.expiresAt, now))
    .orderBy(desc(announcements.id));
  return rows.map(toAnnouncement);
}

/** The host's recent history, live and expired, newest first. */
export async function listRecentAnnouncements(db: Db, limit = 20): Promise<Announcement[]> {
  const rows = await db.select().from(announcements).orderBy(desc(announcements.id)).limit(limit);
  return rows.map(toAnnouncement);
}

export async function createAnnouncement(
  db: Db,
  { message, durationMinutes }: { message: string; durationMinutes: number },
  now = new Date(),
): Promise<Announcement> {
  const [row] = await db
    .insert(announcements)
    .values({
      message,
      createdAt: now,
      expiresAt: new Date(now.getTime() + durationMinutes * 60_000),
    })
    .returning();
  return toAnnouncement(row!);
}

/** Ends an announcement now. Already expired ones keep their original time. */
export async function expireAnnouncement(
  db: Db,
  id: number,
  now = new Date(),
): Promise<Announcement> {
  const [row] = await db.select().from(announcements).where(eq(announcements.id, id));
  if (!row) throw notFound('Announcement not found');
  if (row.expiresAt <= now) return toAnnouncement(row);
  const [updated] = await db
    .update(announcements)
    .set({ expiresAt: now })
    .where(eq(announcements.id, id))
    .returning();
  return toAnnouncement(updated!);
}
