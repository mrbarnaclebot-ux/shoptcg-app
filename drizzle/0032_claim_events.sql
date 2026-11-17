CREATE TABLE "claim_block" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"phone" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"price_mode" text NOT NULL,
	"allow_unclaim" boolean DEFAULT false NOT NULL,
	"pay_within_hours" integer DEFAULT 24 NOT NULL,
	"max_per_buyer" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_event_title_length" CHECK (char_length("claim_event"."title") between 1 and 80),
	CONSTRAINT "claim_event_window" CHECK ("claim_event"."ends_at" > "claim_event"."starts_at" and "claim_event"."ends_at" <= "claim_event"."starts_at" + interval '7 days'),
	CONSTRAINT "claim_event_price_mode" CHECK ("claim_event"."price_mode" in ('market', 'custom')),
	CONSTRAINT "claim_event_pay_within" CHECK ("claim_event"."pay_within_hours" between 1 and 168),
	CONSTRAINT "claim_event_max_per_buyer" CHECK ("claim_event"."max_per_buyer" between 1 and 99)
);
--> statement-breakpoint
CREATE TABLE "claim_event_item" (
	"event_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"price" numeric(12, 2),
	"max_per_buyer" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "claim_event_item_pk" PRIMARY KEY("event_id","listing_id"),
	CONSTRAINT "claim_event_item_price_positive" CHECK ("claim_event_item"."price" > 0),
	CONSTRAINT "claim_event_item_max" CHECK ("claim_event_item"."max_per_buyer" between 1 and 99)
);
--> statement-breakpoint
ALTER TABLE "request" ADD COLUMN "claim_event_id" uuid;--> statement-breakpoint
ALTER TABLE "request" ADD COLUMN "last_claim_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "claim_block" ADD CONSTRAINT "claim_block_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_event" ADD CONSTRAINT "claim_event_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_event_item" ADD CONSTRAINT "claim_event_item_event_id_claim_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."claim_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_event_item" ADD CONSTRAINT "claim_event_item_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claim_block_store_idx" ON "claim_block" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "claim_event_store_idx" ON "claim_event" USING btree ("store_id","ends_at");--> statement-breakpoint
CREATE INDEX "claim_event_item_listing_idx" ON "claim_event_item" USING btree ("listing_id");--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_claim_event_id_claim_event_id_fk" FOREIGN KEY ("claim_event_id") REFERENCES "public"."claim_event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "request_claim_phone_idx" ON "request" USING btree ("claim_event_id","buyer_phone") WHERE "request"."claim_event_id" is not null and "request"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "request_claim_email_idx" ON "request" USING btree ("claim_event_id","buyer_email") WHERE "request"."claim_event_id" is not null and "request"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "request_claim_session_idx" ON "request" USING btree ("claim_event_id","session_id") WHERE "request"."claim_event_id" is not null and "request"."status" = 'pending';