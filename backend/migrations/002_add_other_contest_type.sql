-- Migration: Add 'other' contest type support
-- This migration updates the contests table to allow 'other' contest type

-- Step 1: Create new contests table with updated constraint
CREATE TABLE contests_temp (
    id TEXT PRIMARY KEY,
    event_id INTEGER NOT NULL,
    contest_name TEXT NOT NULL,
    contest_type TEXT NOT NULL CHECK(contest_type IN ('dessert', 'cocktail', 'appetizer', 'other')),
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Step 2: Copy data from old table to new table
INSERT INTO contests_temp SELECT * FROM contests;

-- Step 3: Drop old table and rename new table
DROP TABLE contests;
ALTER TABLE contests_temp RENAME TO contests;

-- Step 4: Recreate indexes for performance
CREATE INDEX idx_contests_event_id ON contests(event_id);
CREATE INDEX idx_contests_type ON contests(contest_type);