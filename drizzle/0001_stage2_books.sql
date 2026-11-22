CREATE TABLE "indexer_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "first_faithful_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "betrayal_amount" double precision;--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "scar" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "source" text DEFAULT 'indexer' NOT NULL;--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "events_signature_address_idx" ON "events" USING btree ("signature","address");--> statement-breakpoint
CREATE INDEX "wallets_first_faithful_idx" ON "wallets" USING btree ("first_faithful_at");--> statement-breakpoint
CREATE INDEX "wallets_traitor_at_idx" ON "wallets" USING btree ("traitor_at");