ALTER TABLE "store" ADD COLUMN "offer_delivery" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "offer_pickup" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "accept_cash" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "accept_transfer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "bank_details" text;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "checkout_note" text;--> statement-breakpoint
ALTER TABLE "request" ADD COLUMN "fulfil" text;--> statement-breakpoint
ALTER TABLE "request" ADD COLUMN "pay_with" text;--> statement-breakpoint
ALTER TABLE "request" ADD COLUMN "buyer_phone" text;--> statement-breakpoint
ALTER TABLE "request" ADD COLUMN "delivery_address" text;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_bank_details_length" CHECK (char_length("store"."bank_details") <= 500);--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_checkout_note_length" CHECK (char_length("store"."checkout_note") <= 300);--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_fulfil" CHECK ("request"."fulfil" is null or "request"."fulfil" in ('delivery', 'pickup'));--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_pay_with" CHECK ("request"."pay_with" is null or "request"."pay_with" in ('cash', 'transfer'));--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_buyer_phone_length" CHECK (char_length("request"."buyer_phone") <= 20);--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_delivery_address_length" CHECK (char_length("request"."delivery_address") <= 300);