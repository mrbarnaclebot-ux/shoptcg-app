ALTER TABLE "request_line" DROP CONSTRAINT "request_line_listing_id_listing_id_fk";
--> statement-breakpoint
ALTER TABLE "request_line" ADD CONSTRAINT "request_line_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "time_zone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "store_name" text;--> statement-breakpoint
-- The one sanctioned write to a sale: the trigger comes straight back on.
ALTER TABLE "sale" DISABLE TRIGGER "sale_immutable";--> statement-breakpoint
UPDATE "sale" SET "store_name" = "store"."name" FROM "store" WHERE "store"."id" = "sale"."store_id";--> statement-breakpoint
ALTER TABLE "sale" ENABLE TRIGGER "sale_immutable";--> statement-breakpoint
ALTER TABLE "sale" ALTER COLUMN "store_name" SET NOT NULL;
