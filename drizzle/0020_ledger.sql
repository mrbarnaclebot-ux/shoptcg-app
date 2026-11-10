CREATE TABLE "stock_move" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"qty_after" integer NOT NULL,
	"reason" text NOT NULL,
	"ref" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_move_reason" CHECK ("stock_move"."reason" in ('opening', 'added', 'adjusted', 'sold', 'voided'))
);
--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "cost" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "sale_line" ADD COLUMN "unit_cost" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "stock_move" ADD CONSTRAINT "stock_move_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_move_store_at_idx" ON "stock_move" USING btree ("store_id","at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_cost_positive" CHECK ("listing"."cost" > 0);--> statement-breakpoint
-- Stock on hand before the ledger existed becomes each listing's first line.
INSERT INTO "stock_move" ("store_id", "listing_id", "delta", "qty_after", "reason")
SELECT "store_id", "id", "qty", "qty", 'opening' FROM "listing" WHERE "qty" > 0;
--> statement-breakpoint
-- A trigger, so no code path that changes a quantity can skip the ledger. The
-- reason and the sale it belongs to arrive as transaction settings.
CREATE FUNCTION log_stock_move() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  d integer;
BEGIN
  IF TG_OP = 'INSERT' THEN d := NEW.qty; ELSE d := NEW.qty - OLD.qty; END IF;
  IF d = 0 THEN RETURN NULL; END IF;
  INSERT INTO stock_move (store_id, listing_id, delta, qty_after, reason, ref)
  VALUES (
    NEW.store_id, NEW.id, d, NEW.qty,
    coalesce(
      nullif(current_setting('app.stock_reason', true), ''),
      CASE WHEN TG_OP = 'INSERT' THEN 'added' ELSE 'adjusted' END
    ),
    nullif(current_setting('app.stock_ref', true), '')::uuid
  );
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER listing_stock_move AFTER INSERT OR UPDATE OF qty ON listing
  FOR EACH ROW EXECUTE FUNCTION log_stock_move();
