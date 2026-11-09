ALTER TABLE "store" ADD COLUMN "table_label" text;--> statement-breakpoint
CREATE INDEX "listing_store_public_idx" ON "listing" USING btree ("store_id") WHERE "listing"."active";--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_table_label_format" CHECK ("store"."table_label" ~ '^[A-Za-z0-9-]{1,8}$');