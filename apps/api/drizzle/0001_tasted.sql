ALTER TABLE "votes" ADD COLUMN "tasted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "votes" SET "tasted" = true WHERE EXISTS (SELECT 1 FROM "vote_scores" WHERE "vote_scores"."vote_id" = "votes"."id");
