CREATE TABLE "burns" (
	"id" serial PRIMARY KEY NOT NULL,
	"signature" text NOT NULL,
	"amount" double precision NOT NULL,
	"seal" integer,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "burns_signature_unique" UNIQUE("signature")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"signature" text NOT NULL,
	"address" text NOT NULL,
	"kind" text NOT NULL,
	"amount" double precision NOT NULL,
	"balance_after" double precision NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prophecies" (
	"address" text NOT NULL,
	"seal" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prophecies_address_seal_pk" PRIMARY KEY("address","seal")
);
--> statement-breakpoint
CREATE TABLE "seals" (
	"number" integer PRIMARY KEY NOT NULL,
	"broken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mcap_usd" double precision NOT NULL,
	"prophecy_faithful" text,
	"prophecy_traitors" text
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"address" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"rank" text,
	"flavor" text NOT NULL,
	"balance" double precision DEFAULT 0 NOT NULL,
	"peak" double precision DEFAULT 0 NOT NULL,
	"faithful_since" timestamp with time zone,
	"last_sell_at" timestamp with time zone,
	"traitor_at" timestamp with time zone,
	"betrayal_signature" text,
	"first_witness" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_judged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "events_address_idx" ON "events" USING btree ("address");--> statement-breakpoint
CREATE INDEX "events_at_idx" ON "events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "wallets_status_idx" ON "wallets" USING btree ("status");