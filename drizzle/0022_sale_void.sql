CREATE TABLE "sale_void" (
	"sale_id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"restocked" boolean NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_void_reason" CHECK (char_length("sale_void"."reason") between 1 and 80)
);
--> statement-breakpoint
ALTER TABLE "sale_void" ADD CONSTRAINT "sale_void_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_void" ADD CONSTRAINT "sale_void_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;