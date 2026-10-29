CREATE TABLE "award_winners" (
	"award_id" text PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_winners" (
	"category_id" text PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "award_winners" ADD CONSTRAINT "award_winners_award_id_awards_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."awards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_winners" ADD CONSTRAINT "award_winners_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_winners" ADD CONSTRAINT "category_winners_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_winners" ADD CONSTRAINT "category_winners_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;
