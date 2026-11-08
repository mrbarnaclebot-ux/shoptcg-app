CREATE TABLE "listing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"catalog_item_id" uuid,
	"kind" text NOT NULL,
	"language" text NOT NULL,
	"name" text,
	"set_name" text,
	"number" text,
	"grader" text,
	"grade" text,
	"image_url" text,
	"condition" text,
	"qty" integer DEFAULT 1 NOT NULL,
	"override_price" numeric(12, 2),
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_kind" CHECK ("listing"."kind" in ('raw', 'graded', 'sealed')),
	CONSTRAINT "listing_language" CHECK ("listing"."language" in ('en', 'ja', 'zh')),
	CONSTRAINT "listing_item_source" CHECK ("listing"."catalog_item_id" is not null or char_length(trim("listing"."name")) > 0),
	CONSTRAINT "listing_condition" CHECK ("listing"."condition" in ('NM', 'LP', 'MP', 'HP', 'DMG')),
	CONSTRAINT "listing_condition_kind" CHECK (("listing"."kind" = 'raw') = ("listing"."condition" is not null)),
	CONSTRAINT "listing_custom_graded" CHECK ("listing"."catalog_item_id" is not null or "listing"."kind" <> 'graded' or ("listing"."grader" is not null and "listing"."grade" is not null)),
	CONSTRAINT "listing_qty_nonneg" CHECK ("listing"."qty" >= 0),
	CONSTRAINT "listing_override_positive" CHECK ("listing"."override_price" > 0)
);
--> statement-breakpoint
ALTER TABLE "store" DROP CONSTRAINT "store_rounding_nonneg";--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "nfc_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_catalog_item_id_catalog_item_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_store_idx" ON "listing" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "listing_catalog_item_idx" ON "listing" USING btree ("catalog_item_id");--> statement-breakpoint
ALTER TABLE "catalog_item" DROP COLUMN "last_seen_at";--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_rounding_step" CHECK ("store"."rounding" in (0, 0.5, 1));--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_price_rule_range" CHECK ("store"."price_rule_pct" between -90 and 500);--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_fx_pair" CHECK (("store"."second_currency" is null) = ("store"."fx_rate" is null));