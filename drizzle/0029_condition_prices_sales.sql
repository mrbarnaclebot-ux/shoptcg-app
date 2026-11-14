ALTER TABLE "price_point" ADD COLUMN "sales" integer;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "cond_lp_pct" integer DEFAULT 85 NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "cond_mp_pct" integer DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "cond_hp_pct" integer DEFAULT 55 NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "cond_dmg_pct" integer DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE "price_point" ADD CONSTRAINT "price_point_sales_nonneg" CHECK ("price_point"."sales" >= 0);--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_condition_pcts" CHECK ("store"."cond_lp_pct" between 1 and 100 and "store"."cond_mp_pct" between 1 and 100 and "store"."cond_hp_pct" between 1 and 100 and "store"."cond_dmg_pct" between 1 and 100);