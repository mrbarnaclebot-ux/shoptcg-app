CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"promo_opt_in" boolean DEFAULT false NOT NULL,
	"opted_in_at" timestamp with time zone,
	"opted_out_at" timestamp with time zone,
	"unsubscribe_token" text NOT NULL,
	"first_purchase_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_purchase_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purchases" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "customer_unsubscribe_token_unique" UNIQUE("unsubscribe_token"),
	CONSTRAINT "customer_store_email_key" UNIQUE("store_id","email"),
	CONSTRAINT "customer_email_lower" CHECK ("customer"."email" = lower("customer"."email"))
);
--> statement-breakpoint
CREATE TABLE "receipt_email" (
	"sale_id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipt_email_status" CHECK ("receipt_email"."status" in ('pending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "sale" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"receipt_no" text NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_email" text NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_kind" text,
	"discount_pct" numeric(5, 2),
	"total" numeric(12, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"payment_note" text,
	"second_currency" text,
	"fx_rate" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "sale_store_seq_key" UNIQUE("store_id","seq"),
	CONSTRAINT "sale_total_sum" CHECK ("sale"."total" = "sale"."subtotal" - "sale"."discount"),
	CONSTRAINT "sale_discount_range" CHECK ("sale"."discount" between 0 and "sale"."subtotal"),
	CONSTRAINT "sale_total_nonneg" CHECK ("sale"."total" >= 0),
	CONSTRAINT "sale_discount_kind" CHECK ("sale"."discount_kind" in ('amount', 'percent')),
	CONSTRAINT "sale_discount_pct_range" CHECK ("sale"."discount_pct" between 0 and 100),
	CONSTRAINT "sale_payment_method" CHECK ("sale"."payment_method" in ('cash', 'card', 'transfer', 'other')),
	CONSTRAINT "sale_payment_note" CHECK (("sale"."payment_method" = 'other') = ("sale"."payment_note" is not null) and char_length("sale"."payment_note") between 1 and 40)
);
--> statement-breakpoint
CREATE TABLE "sale_line" (
	"sale_id" uuid NOT NULL,
	"line_no" smallint NOT NULL,
	"listing_id" uuid NOT NULL,
	"catalog_item_id" uuid,
	"name" text NOT NULL,
	"set_name" text,
	"number" text,
	"grade_label" text,
	"language" text NOT NULL,
	"image_url" text,
	"qty" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"quoted_price" numeric(12, 2) NOT NULL,
	"market_usd" numeric(12, 2),
	CONSTRAINT "sale_line_pk" PRIMARY KEY("sale_id","line_no"),
	CONSTRAINT "sale_line_qty_range" CHECK ("sale_line"."qty" between 1 and 99),
	CONSTRAINT "sale_line_price_nonneg" CHECK ("sale_line"."unit_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "receipt_seq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_email" ADD CONSTRAINT "receipt_email_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sale_store_created_idx" ON "sale" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE FUNCTION forbid_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'sale_immutable' USING ERRCODE = 'P0001';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER sale_immutable BEFORE UPDATE ON sale
  FOR EACH ROW EXECUTE FUNCTION forbid_update();
--> statement-breakpoint
CREATE TRIGGER sale_line_immutable BEFORE UPDATE ON sale_line
  FOR EACH ROW EXECUTE FUNCTION forbid_update();
