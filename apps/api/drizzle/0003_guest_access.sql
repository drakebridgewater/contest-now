ALTER TABLE "guests" ADD COLUMN "access" text DEFAULT 'invited' NOT NULL;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_access" CHECK ("guests"."access" in ('invited', 'requested', 'declined', 'walk_in'));--> statement-breakpoint
-- Everyone already on the list stays invited, except name-only guests the host
-- never made a link for: they came from the voting tablet, so they are walk-ins.
UPDATE "guests" SET "access" = 'walk_in' WHERE "email" LIKE '%@guest.invalid' AND "invite_token_hash" IS NULL;
