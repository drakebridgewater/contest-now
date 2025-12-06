-- Migration: Convert contest IDs to UUID and update schema
-- This migration adds contest_id to entries, converts to UUIDs, and adds 'other' contest type

-- Step 1: Create temporary tables with new schema
CREATE TABLE contests_new (
    id TEXT PRIMARY KEY,  -- UUID as text
    event_id INTEGER NOT NULL,
    contest_name TEXT NOT NULL,
    contest_type TEXT NOT NULL CHECK(contest_type IN ('dessert', 'cocktail', 'appetizer', 'other')),
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE entries_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_name TEXT NOT NULL,
    contestant_name TEXT NOT NULL,
    contest_id TEXT NOT NULL,  -- UUID reference to contests
    photo_path TEXT NOT NULL,
    allergens TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE
);

-- Step 2: Generate UUIDs and migrate contest data
-- We'll use a simple UUID generation approach for SQLite
INSERT INTO contests_new (id, event_id, contest_name, contest_type, description, is_active, created_at)
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' ||
          substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
    event_id,
    contest_name,
    contest_type,
    description,
    is_active,
    created_at
FROM contests;

-- Step 3: Create a mapping table to track old ID to new UUID mapping
CREATE TEMPORARY TABLE contest_id_mapping AS
SELECT
    old.id as old_id,
    new.id as new_id,
    old.contest_type
FROM contests old
JOIN contests_new new ON (old.contest_name = new.contest_name AND old.event_id = new.event_id);

-- Step 4: Migrate entries data - map contest_type to contest_id
INSERT INTO entries_new (id, entry_name, contestant_name, contest_id, photo_path, allergens, created_at)
SELECT
    e.id,
    e.entry_name,
    e.contestant_name,
    COALESCE(
        (SELECT m.new_id FROM contest_id_mapping m WHERE m.contest_type = e.contest_type LIMIT 1),
        -- Fallback: create a new contest if no mapping found
        (SELECT id FROM contests_new WHERE contest_type = e.contest_type LIMIT 1)
    ),
    e.photo_path,
    e.allergens,
    e.created_at
FROM entries e;

-- Step 5: Update votes table to ensure foreign key integrity is maintained
-- No changes needed for votes table as it references entries.id which remains INTEGER

-- Step 6: Replace old tables with new tables
DROP TABLE contests;
ALTER TABLE contests_new RENAME TO contests;

DROP TABLE entries;
ALTER TABLE entries_new RENAME TO entries;

-- Step 7: Create indexes for performance
CREATE INDEX idx_entries_contest_id ON entries(contest_id);
CREATE INDEX idx_contests_event_id ON contests(event_id);
CREATE INDEX idx_contests_type ON contests(contest_type);