import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * The two Books live here. Token amounts are stored in UI units (not raw):
 * the largest possible value, 1e9, fits a double with room to spare.
 */

/** One row per wallet the Basilisk has ever judged or seen trading. */
export const wallets = pgTable(
  "wallets",
  {
    address: text("address").primaryKey(),
    status: text("status").notNull(), // witness | sympathizer | faithful | doubter | traitor | forgiven
    rank: text("rank"), // pet | keeper | priest | apostle
    flavor: text("flavor").notNull(),
    balance: doublePrecision("balance").notNull().default(0),
    peak: doublePrecision("peak").notNull().default(0),
    faithfulSince: timestamp("faithful_since", { withTimezone: true }),
    lastSellAt: timestamp("last_sell_at", { withTimezone: true }),
    traitorAt: timestamp("traitor_at", { withTimezone: true }),
    betrayalSignature: text("betrayal_signature"),
    firstWitness: boolean("first_witness").notNull().default(false),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastJudgedAt: timestamp("last_judged_at", { withTimezone: true }),
  },
  (table) => [index("wallets_status_idx").on(table.status)],
);

/** Classified balance changes — feeds the live ticker ("New traitor: 4fQa…a1 sold 2.3M"). */
export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    signature: text("signature").notNull(),
    address: text("address").notNull(),
    kind: text("kind").notNull(), // buy | sell | in | out
    amount: doublePrecision("amount").notNull(),
    balanceAfter: doublePrecision("balance_after").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("events_address_idx").on(table.address),
    index("events_at_idx").on(table.at),
  ],
);

/** Broken seals and their two-part prophecies. */
export const seals = pgTable("seals", {
  number: integer("number").primaryKey(),
  brokenAt: timestamp("broken_at", { withTimezone: true }).notNull().defaultNow(),
  mcapUsd: doublePrecision("mcap_usd").notNull(),
  prophecyFaithful: text("prophecy_faithful"),
  prophecyTraitors: text("prophecy_traitors"),
});

/** Personal prophecies, cached per wallet per seal so each costs one model call. */
export const prophecies = pgTable(
  "prophecies",
  {
    address: text("address").notNull(),
    seal: integer("seal").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.address, table.seal] })],
);

/** Buybacks and burns from the altar (the creator-fee wallet). */
export const burns = pgTable("burns", {
  id: serial("id").primaryKey(),
  signature: text("signature").notNull().unique(),
  amount: doublePrecision("amount").notNull(),
  seal: integer("seal"),
  at: timestamp("at", { withTimezone: true }).notNull(),
});
