ALTER TABLE "sale" ALTER COLUMN "buyer_email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "request" ADD COLUMN "walk_up" boolean DEFAULT false NOT NULL;