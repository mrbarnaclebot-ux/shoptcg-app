CREATE TABLE "search_miss" (
	"user_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_item" DROP CONSTRAINT "catalog_item_provider_key";--> statement-breakpoint
ALTER TABLE "price_point" DROP CONSTRAINT "price_point_market_nonneg";--> statement-breakpoint
ALTER TABLE "price_point" ALTER COLUMN "market_usd" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "price_point" ALTER COLUMN "low_usd" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "price_point" ALTER COLUMN "high_usd" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "catalog_item" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "search_miss" ADD CONSTRAINT "search_miss_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_miss_user_at_idx" ON "search_miss" USING btree ("user_id","at");--> statement-breakpoint
ALTER TABLE "catalog_item" ADD CONSTRAINT "catalog_item_provider_key" UNIQUE NULLS NOT DISTINCT("provider","provider_id","language","grader","grade");--> statement-breakpoint
DELETE FROM "price_point" WHERE "market_usd" <= 0;--> statement-breakpoint
ALTER TABLE "price_point" ADD CONSTRAINT "price_point_market_positive" CHECK ("price_point"."market_usd" > 0);