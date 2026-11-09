CREATE TABLE "push_subscription" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"buyer_name" text,
	"buyer_email" text,
	"promo_opt_in" boolean DEFAULT false NOT NULL,
	"terms_version" text NOT NULL,
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"session_id" text NOT NULL,
	"ip_hash" text,
	"is_test" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "request_status" CHECK ("request"."status" in ('pending', 'confirmed', 'declined', 'expired', 'cancelled')),
	CONSTRAINT "request_code_format" CHECK ("request"."code" ~ '^[2-9A-HJKMNP-TV-Z]{4}$'),
	CONSTRAINT "request_buyer_name_length" CHECK (char_length("request"."buyer_name") between 1 and 80),
	CONSTRAINT "request_buyer_email_format" CHECK (char_length("request"."buyer_email") <= 254 and "request"."buyer_email" = lower("request"."buyer_email")),
	CONSTRAINT "request_expiry_after_create" CHECK ("request"."expires_at" > "request"."created_at")
);
--> statement-breakpoint
CREATE TABLE "request_line" (
	"request_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"quoted_price" numeric(12, 2) NOT NULL,
	CONSTRAINT "request_line_pk" PRIMARY KEY("request_id","listing_id"),
	CONSTRAINT "request_line_qty_range" CHECK ("request_line"."qty" between 1 and 99),
	CONSTRAINT "request_line_price_nonneg" CHECK ("request_line"."quoted_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_line" ADD CONSTRAINT "request_line_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_line" ADD CONSTRAINT "request_line_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "request_pending_code_idx" ON "request" USING btree ("store_id","code") WHERE "request"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "request_store_created_idx" ON "request" USING btree ("store_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "request_session_idx" ON "request" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "request_ip_idx" ON "request" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "request_pending_expiry_idx" ON "request" USING btree ("expires_at") WHERE "request"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "request_line_listing_idx" ON "request_line" USING btree ("listing_id");--> statement-breakpoint
CREATE VIEW "public"."active_hold" AS (select rl.listing_id, rl.request_id, r.store_id, rl.qty, r.expires_at from request_line rl join request r on r.id = rl.request_id where r.status = 'pending' and r.expires_at > now());--> statement-breakpoint
-- Backstop for any code path: a line may never hold more than is left after
-- other active holds. Locking the listing row serialises concurrent inserts.
CREATE FUNCTION request_line_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  stock integer;
  held integer;
BEGIN
  SELECT qty INTO stock FROM listing WHERE id = NEW.listing_id FOR UPDATE;
  SELECT coalesce(sum(qty), 0) INTO held FROM active_hold WHERE listing_id = NEW.listing_id;
  IF NEW.qty > coalesce(stock, 0) - held THEN
    RAISE EXCEPTION 'hold_exceeds_stock' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER request_line_capacity BEFORE INSERT ON request_line
  FOR EACH ROW EXECUTE FUNCTION request_line_capacity();
