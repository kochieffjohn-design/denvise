CREATE TABLE "daily_usage" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"kind" text NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "daily_usage_user_id_day_kind_pk" PRIMARY KEY("user_id","day","kind")
);
--> statement-breakpoint
ALTER TABLE "daily_usage" ADD CONSTRAINT "daily_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;