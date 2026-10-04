ALTER TABLE "categories" ADD COLUMN "kind" text DEFAULT 'tasting' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "noun" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_kind" CHECK ("categories"."kind" in ('tasting', 'showcase'));