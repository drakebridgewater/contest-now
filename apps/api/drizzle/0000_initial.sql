CREATE TABLE "auth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "award_ballots" (
	"id" serial PRIMARY KEY NOT NULL,
	"guest_id" text NOT NULL,
	"award_id" text NOT NULL,
	"entry_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "award_ballots_guest_award" UNIQUE("guest_id","award_id")
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
	"guest_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"event_name" text NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"photo_share_url" text DEFAULT '' NOT NULL,
	"voting_open" boolean DEFAULT true NOT NULL,
	"voting_opens_at" timestamp with time zone,
	"submissions_open" boolean DEFAULT true NOT NULL,
	"submissions_open_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_settings_singleton" CHECK ("event_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "guest_preregistrations" (
	"guest_id" text NOT NULL,
	"category_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_preregistrations_guest_id_category_id_pk" PRIMARY KEY("guest_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "guest_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"scope" text DEFAULT 'full' NOT NULL,
	CONSTRAINT "guest_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name_key" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"rsvp_status" text DEFAULT 'pending' NOT NULL,
	"plus_one_first_name" text DEFAULT '' NOT NULL,
	"plus_one_last_name" text DEFAULT '' NOT NULL,
	"allergies" text[] DEFAULT '{}'::text[] NOT NULL,
	"invite_token_hash" text,
	"invite_created_at" timestamp with time zone,
	"invite_sent_at" timestamp with time zone,
	"invite_opened_at" timestamp with time zone,
	CONSTRAINT "guests_email_unique" UNIQUE("email"),
	CONSTRAINT "guests_nameKey_unique" UNIQUE("name_key"),
	CONSTRAINT "guests_inviteTokenHash_unique" UNIQUE("invite_token_hash"),
	CONSTRAINT "guests_rsvp_status" CHECK ("guests"."rsvp_status" in ('pending', 'yes', 'maybe', 'no'))
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
	"guest_id" text NOT NULL,
	"entry_id" integer NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"tasted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_guest_entry" UNIQUE("guest_id","entry_id")
);
--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_guests_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_ballots" ADD CONSTRAINT "award_ballots_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_ballots" ADD CONSTRAINT "award_ballots_award_id_awards_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."awards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_ballots" ADD CONSTRAINT "award_ballots_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_categories" ADD CONSTRAINT "award_categories_award_id_awards_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."awards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_categories" ADD CONSTRAINT "award_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criteria" ADD CONSTRAINT "criteria_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_preregistrations" ADD CONSTRAINT "guest_preregistrations_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_preregistrations" ADD CONSTRAINT "guest_preregistrations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_user_id_guests_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_scores" ADD CONSTRAINT "vote_scores_vote_id_votes_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."votes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_scores" ADD CONSTRAINT "vote_scores_criterion_id_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."criteria"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "award_ballots_guest_idx" ON "award_ballots" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "entries_category_idx" ON "entries" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "entries_guest_idx" ON "entries" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "guest_sessions_user_idx" ON "guest_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "votes_guest_idx" ON "votes" USING btree ("guest_id");