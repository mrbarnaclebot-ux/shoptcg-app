CREATE TABLE "store_old_slug" (
	"slug" text PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_old_slug" ADD CONSTRAINT "store_old_slug_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_old_slug_store_id_idx" ON "store_old_slug" USING btree ("store_id");