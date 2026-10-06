CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"role" text NOT NULL,
	"course" integer,
	"university" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;