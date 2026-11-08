CREATE TABLE "catalog_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"kind" text NOT NULL,
	"language" text NOT NULL,
	"name" text NOT NULL,
	"set_name" text NOT NULL,
	"number" text,
	"image_url" text,
	"grader" text,
	"grade" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_item_provider_key" UNIQUE NULLS NOT DISTINCT("provider","provider_id","grader","grade"),
	CONSTRAINT "catalog_item_kind" CHECK ("catalog_item"."kind" in ('raw', 'graded', 'sealed')),
	CONSTRAINT "catalog_item_language" CHECK ("catalog_item"."language" in ('en', 'ja', 'zh')),
	CONSTRAINT "catalog_item_grader" CHECK ("catalog_item"."grader" in ('PSA', 'BGS', 'CGC', 'SGC')),
	CONSTRAINT "catalog_item_grade" CHECK ("catalog_item"."grade" ~ '^(10|[1-9](\.5)?)$'),
	CONSTRAINT "catalog_item_graded_fields" CHECK (("catalog_item"."kind" = 'graded') = ("catalog_item"."grader" is not null and "catalog_item"."grade" is not null) and ("catalog_item"."grader" is null) = ("catalog_item"."grade" is null))
);
--> statement-breakpoint
CREATE TABLE "price_point" (
	"catalog_item_id" uuid NOT NULL,
	"date" date NOT NULL,
	"market_usd" numeric NOT NULL,
	"low_usd" numeric,
	"high_usd" numeric,
	"sample_size" integer,
	"source" text NOT NULL,
	CONSTRAINT "price_point_pk" PRIMARY KEY("catalog_item_id","date","source"),
	CONSTRAINT "price_point_market_nonneg" CHECK ("price_point"."market_usd" >= 0),
	CONSTRAINT "price_point_low_nonneg" CHECK ("price_point"."low_usd" >= 0),
	CONSTRAINT "price_point_high_nonneg" CHECK ("price_point"."high_usd" >= 0),
	CONSTRAINT "price_point_sample_nonneg" CHECK ("price_point"."sample_size" >= 0)
);
--> statement-breakpoint
ALTER TABLE "price_point" ADD CONSTRAINT "price_point_catalog_item_id_catalog_item_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_item_name_idx" ON "catalog_item" USING btree ("kind","language",lower("name") text_pattern_ops);