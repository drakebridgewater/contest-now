CREATE TABLE "award_ballots" (
	"id" serial PRIMARY KEY NOT NULL,
	"voter_name" text NOT NULL,
	"award_id" text NOT NULL,
	"entry_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "award_ballots_voter_award" UNIQUE("voter_name","award_id")
);
--> statement-breakpoint
CREATE TABLE "award_categories" (
	"award_id" text NOT NULL,
	"category_id" text NOT NULL,
	CONSTRAINT "award_categories_award_id_category_id_pk" PRIMARY KEY("award_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "awards" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "criteria" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"help_text" text DEFAULT '' NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "criteria_category_slug" UNIQUE("category_id","slug"),
	CONSTRAINT "criteria_weight_positive" CHECK ("criteria"."weight" > 0)
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_name" text NOT NULL,
	"contestant_name" text NOT NULL,
	"category_id" text NOT NULL,
	"photo_path" text NOT NULL,
	"allergens" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"event_name" text NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"photo_share_url" text DEFAULT '' NOT NULL,
	"voting_open" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_settings_singleton" CHECK ("event_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "vote_scores" (
	"vote_id" integer NOT NULL,
	"criterion_id" integer NOT NULL,
	"rating" smallint NOT NULL,
	CONSTRAINT "vote_scores_vote_id_criterion_id_pk" PRIMARY KEY("vote_id","criterion_id"),
	CONSTRAINT "vote_scores_rating_range" CHECK ("vote_scores"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"voter_name" text NOT NULL,
	"entry_id" integer NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_voter_entry" UNIQUE("voter_name","entry_id")
);
--> statement-breakpoint
ALTER TABLE "award_ballots" ADD CONSTRAINT "award_ballots_award_id_awards_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."awards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_ballots" ADD CONSTRAINT "award_ballots_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_categories" ADD CONSTRAINT "award_categories_award_id_awards_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."awards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_categories" ADD CONSTRAINT "award_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criteria" ADD CONSTRAINT "criteria_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_scores" ADD CONSTRAINT "vote_scores_vote_id_votes_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."votes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_scores" ADD CONSTRAINT "vote_scores_criterion_id_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."criteria"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "award_ballots_voter_idx" ON "award_ballots" USING btree ("voter_name");--> statement-breakpoint
CREATE INDEX "entries_category_idx" ON "entries" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "votes_voter_idx" ON "votes" USING btree ("voter_name");