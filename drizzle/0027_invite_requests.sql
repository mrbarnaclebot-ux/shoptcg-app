CREATE TABLE "invite_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"about" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handled_at" timestamp with time zone,
	"outcome" text,
	CONSTRAINT "invite_request_outcome_check" CHECK ("invite_request"."outcome" is null or "invite_request"."outcome" in ('invited', 'dismissed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "invite_request_open_email_idx" ON "invite_request" USING btree ("email") WHERE "invite_request"."handled_at" is null;