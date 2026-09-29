import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { describe, expect, it } from 'vitest';
import { schema } from '../src/db/schema.ts';

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');

/** A copy of the migrations folder that stops before `tag`. */
async function migrationsBefore(tag: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'contest-migrations-'));
  await fs.cp(migrationsFolder, dir, { recursive: true });
  const journalPath = path.join(dir, 'meta/_journal.json');
  const journal = JSON.parse(await fs.readFile(journalPath, 'utf8')) as {
    entries: { tag: string }[];
  };
  const stop = journal.entries.findIndex((e) => e.tag === tag);
  journal.entries = journal.entries.slice(0, stop);
  await fs.writeFile(journalPath, JSON.stringify(journal));
  return dir;
}

describe('0002_guests migration', () => {
  it('turns existing voters and cooks into guests and links their entries', async () => {
    const client = new PGlite();
    const db = drizzle({ client, schema, casing: 'snake_case' });
    const before = await migrationsBefore('0002_guests');
    await migrate(db, { migrationsFolder: before });
    await client.exec(`
      insert into event_settings (id, event_name, voting_open) values (1, 'Party', false);
      insert into categories (id, name) values ('dessert', 'Dessert');
      insert into entries (entry_name, contestant_name, category_id, photo_path)
        values ('Pie', '  Ann  Lee ', 'dessert', 'a.webp'), ('Tart', 'Bo', 'dessert', 'b.webp');
      insert into votes (voter_name, entry_id, tasted) values ('ann lee', 1, true), ('cy', 1, true);
    `);

    await migrate(db, { migrationsFolder });

    const guests = await client.query<{ name: string; name_key: string; email: string }>(
      'select name, name_key, email from guests order by name_key',
    );
    expect(guests.rows.map((g) => [g.name, g.name_key])).toEqual([
      ['Ann Lee', 'ann lee'],
      ['Bo', 'bo'],
      ['Cy', 'cy'],
    ]);
    expect(guests.rows.every((g) => g.email.endsWith('@guest.invalid'))).toBe(true);
    const linked = await client.query<{ n: number }>(
      'select count(*)::int as n from entries where guest_id is not null',
    );
    expect(linked.rows[0]?.n).toBe(2);
    // The old single switch had closed submissions too.
    const settings = await client.query<{ submissions_open: boolean }>(
      'select submissions_open from event_settings',
    );
    expect(settings.rows[0]?.submissions_open).toBe(false);

    await client.close();
    await fs.rm(before, { recursive: true, force: true });
  });
});
