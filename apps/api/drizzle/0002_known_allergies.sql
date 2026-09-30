ALTER TABLE "event_settings" ADD COLUMN "known_allergies" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
-- Existing events start with the default list; new ones get it from seedDefaults.
UPDATE "event_settings" SET "known_allergies" = ARRAY['cashews', 'pistachios', 'fish', 'soy', 'sunflower-seeds', 'pumpkin-seeds', 'lentils', 'cranberries', 'gluten']::text[] WHERE "known_allergies" = '{}';
