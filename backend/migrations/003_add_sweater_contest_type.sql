-- Migration: Add sweater contest type and ranking votes table
-- This migration adds 'sweater' to the contest types and creates the ranking_votes table

-- Step 1: Create the new ranking_votes table
CREATE TABLE IF NOT EXISTS ranking_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voter_name TEXT NOT NULL,
    entry_id INTEGER NOT NULL,
    rank INTEGER NOT NULL CHECK(rank >= 1 AND rank <= 5),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
    UNIQUE(voter_name, entry_id)
);

-- Step 2: Update the contests table to allow 'sweater' type
-- Note: SQLite doesn't support ALTER TABLE to modify CHECK constraints
-- So we need to recreate the table with the new constraint

-- Create new contests table with sweater type
CREATE TABLE contests_new (
    id TEXT PRIMARY KEY,
    event_id INTEGER NOT NULL,
    contest_name TEXT NOT NULL,
    contest_type TEXT NOT NULL CHECK(contest_type IN ('dessert', 'cocktail', 'appetizer', 'sweater', 'other')),
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Copy data from old table
INSERT INTO contests_new SELECT * FROM contests;

-- Drop old table and rename new table
DROP TABLE contests;
ALTER TABLE contests_new RENAME TO contests;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_contests_event_id ON contests(event_id);
CREATE INDEX IF NOT EXISTS idx_contests_type ON contests(contest_type);

-- Step 3: Update the entries table to allow 'sweater' type
CREATE TABLE entries_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_name TEXT NOT NULL,
    contestant_name TEXT NOT NULL,
    contest_id TEXT NOT NULL,
    contest_type TEXT NOT NULL CHECK(contest_type IN ('dessert', 'cocktail', 'appetizer', 'sweater', 'other')),
    photo_path TEXT NOT NULL,
    allergens TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE
);

-- Copy data from old table
INSERT INTO entries_new SELECT * FROM entries;

-- Drop old table and rename new table
DROP TABLE entries;
ALTER TABLE entries_new RENAME TO entries;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_entries_contest_id ON entries(contest_id);

-- Step 4: Create index for ranking_votes
CREATE INDEX IF NOT EXISTS idx_ranking_votes_voter ON ranking_votes(voter_name);
CREATE INDEX IF NOT EXISTS idx_ranking_votes_entry ON ranking_votes(entry_id);

