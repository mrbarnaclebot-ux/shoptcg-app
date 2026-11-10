CREATE TABLE "basket" (
	"store_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"lines" jsonb NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "basket_pk" PRIMARY KEY("store_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "visit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "basket" ADD CONSTRAINT "basket_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit" ADD CONSTRAINT "visit_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "basket_store_seen_idx" ON "basket" USING btree ("store_id","seen_at");--> statement-breakpoint
CREATE INDEX "visit_store_seen_idx" ON "visit" USING btree ("store_id","last_seen");--> statement-breakpoint
CREATE INDEX "visit_store_device_idx" ON "visit" USING btree ("store_id","device_id","last_seen");