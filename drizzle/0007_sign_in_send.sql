CREATE TABLE "sign_in_send" (
	"key" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sign_in_send_key_at_idx" ON "sign_in_send" USING btree ("key","at");