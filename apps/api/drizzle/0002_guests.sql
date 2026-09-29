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
ALTER TABLE "entries" ADD COLUMN "guest_id" text;--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "voting_opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "submissions_open" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "submissions_open_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_guests_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_preregistrations" ADD CONSTRAINT "guest_preregistrations_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_preregistrations" ADD CONSTRAINT "guest_preregistrations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_user_id_guests_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "guest_sessions_user_idx" ON "guest_sessions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entries_guest_idx" ON "entries" USING btree ("guest_id");--> statement-breakpoint
-- The old single switch closed submissions too; keep whatever state it was in.
UPDATE "event_settings" SET "submissions_open" = "voting_open";--> statement-breakpoint
-- Every existing voter and contestant becomes a name-only guest. Names are
-- normalized as normalizeVoterName does; a contestant's spelling wins over a
-- voter's lowercased one when both exist.
INSERT INTO "guests" ("id", "name", "email", "name_key")
SELECT gen_random_uuid()::text, "display", gen_random_uuid()::text || '@guest.invalid', "key"
FROM (
	SELECT DISTINCT ON ("key") "key", "display"
	FROM (
		SELECT lower(regexp_replace(trim("contestant_name"), '\s+', ' ', 'g')) AS "key",
			regexp_replace(trim("contestant_name"), '\s+', ' ', 'g') AS "display", 0 AS "rank"
		FROM "entries"
		UNION ALL
		SELECT "voter_name", initcap("voter_name"), 1 FROM "votes"
		UNION ALL
		SELECT "voter_name", initcap("voter_name"), 1 FROM "award_ballots"
	) AS "names"
	WHERE length("key") > 0
	ORDER BY "key", "rank"
) AS "distinct_names";--> statement-breakpoint
UPDATE "entries" SET "guest_id" = "guests"."id"
FROM "guests"
WHERE "guests"."name_key" = lower(regexp_replace(trim("entries"."contestant_name"), '\s+', ' ', 'g'));
