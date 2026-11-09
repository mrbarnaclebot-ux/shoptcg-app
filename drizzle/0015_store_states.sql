ALTER TABLE "store" ADD COLUMN "state" text DEFAULT 'paused' NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "paused_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_state_valid" CHECK ("store"."state" in ('open', 'paused', 'off'));--> statement-breakpoint
-- Open stores stay open, with a fresh 14-hour window; closed ones are paused.
UPDATE "store" SET "state" = 'open', "opened_at" = now() WHERE "is_open";
