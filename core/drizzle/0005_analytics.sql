CREATE TABLE "acquisition" (
	"user_id" text PRIMARY KEY NOT NULL,
	"ref" text,
	"source" text,
	"medium" text,
	"campaign" text,
	"landing" text,
	"first_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_day" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	CONSTRAINT "activity_day_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "analytics_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"anon_id" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"props" jsonb,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acquisition" ADD CONSTRAINT "acquisition_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_day" ADD CONSTRAINT "activity_day_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_event_name_at_idx" ON "analytics_event" USING btree ("name","at");--> statement-breakpoint
CREATE INDEX "analytics_event_anon_idx" ON "analytics_event" USING btree ("anon_id");