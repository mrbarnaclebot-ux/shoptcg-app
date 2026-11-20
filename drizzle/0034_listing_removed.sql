ALTER TABLE "stock_move" DROP CONSTRAINT "stock_move_reason";--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "request" ADD COLUMN "removed_items" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_move" ADD CONSTRAINT "stock_move_reason" CHECK ("stock_move"."reason" in ('opening', 'added', 'adjusted', 'sold', 'voided', 'bought', 'removed', 'restored'));