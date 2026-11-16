ALTER TABLE "listing" DROP CONSTRAINT "listing_kind";--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_kind" CHECK ("listing"."kind" in ('raw', 'graded', 'sealed', 'other'));--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_whatsapp_format" CHECK ("store"."whatsapp" ~ '^[0-9]{8,15}$');