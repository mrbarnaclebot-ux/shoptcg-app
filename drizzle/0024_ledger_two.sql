CREATE TABLE "buy" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"method" text NOT NULL,
	"seller" text,
	"total" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buy_method" CHECK ("buy"."method" in ('cash', 'card', 'paypal', 'trade')),
	CONSTRAINT "buy_seller" CHECK (char_length("buy"."seller") between 1 and 40),
	CONSTRAINT "buy_total_nonneg" CHECK ("buy"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "buy_line" (
	"buy_id" uuid NOT NULL,
	"line_no" smallint NOT NULL,
	"listing_id" uuid NOT NULL,
	"name" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	CONSTRAINT "buy_line_pk" PRIMARY KEY("buy_id","line_no"),
	CONSTRAINT "buy_line_qty_range" CHECK ("buy_line"."qty" between 1 and 999),
	CONSTRAINT "buy_line_price_positive" CHECK ("buy_line"."unit_price" > 0)
);
--> statement-breakpoint
CREATE TABLE "till" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opening_float" numeric(12, 2),
	"closed_at" timestamp with time zone,
	"counted" numeric(12, 2),
	"expected" numeric(12, 2),
	CONSTRAINT "till_float_nonneg" CHECK ("till"."opening_float" >= 0),
	CONSTRAINT "till_counted_nonneg" CHECK ("till"."counted" >= 0),
	CONSTRAINT "till_closed_fields" CHECK (("till"."closed_at" is null) = ("till"."counted" is null) and ("till"."counted" is null) = ("till"."expected" is null))
);
--> statement-breakpoint
ALTER TABLE "stock_move" DROP CONSTRAINT "stock_move_reason";--> statement-breakpoint
ALTER TABLE "buy" ADD CONSTRAINT "buy_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buy_line" ADD CONSTRAINT "buy_line_buy_id_buy_id_fk" FOREIGN KEY ("buy_id") REFERENCES "public"."buy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "till" ADD CONSTRAINT "till_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "buy_store_created_idx" ON "buy" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "till_open_key" ON "till" USING btree ("store_id") WHERE "till"."closed_at" is null;--> statement-breakpoint
CREATE INDEX "till_store_closed_idx" ON "till" USING btree ("store_id","closed_at");--> statement-breakpoint
ALTER TABLE "stock_move" ADD CONSTRAINT "stock_move_reason" CHECK ("stock_move"."reason" in ('opening', 'added', 'adjusted', 'sold', 'voided', 'bought'));