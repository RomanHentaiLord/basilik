import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
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
    rank: text("rank"), // pet … hand, see RANKS
    title: text("title").notNull().default(""),
    flavor: text("flavor").notNull(),
    balance: doublePrecision("balance").notNull().default(0),
    peak: doublePrecision("peak").notNull().default(0),
    /** Start of the current stretch at or above the threshold. */
    faithfulSince: timestamp("faithful_since", { withTimezone: true }),
    /** The first time the wallet ever reached the threshold: orders the Book and the First Witnesses. */
    firstFaithfulAt: timestamp("first_faithful_at", { withTimezone: true }),
    lastSellAt: timestamp("last_sell_at", { withTimezone: true }),
    traitorAt: timestamp("traitor_at", { withTimezone: true }),
    betrayalSignature: text("betrayal_signature"),
    betrayalAmount: doublePrecision("betrayal_amount"),
    scar: boolean("scar").notNull().default(false),
    firstWitness: boolean("first_witness").notNull().default(false),
    /** "judge" when a visitor checked the wallet (full history), "indexer" when seen in the sales scan. */
    source: text("source").notNull().default("indexer"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastJudgedAt: timestamp("last_judged_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("wallets_status_idx").on(table.status),
    index("wallets_first_faithful_idx").on(table.firstFaithfulAt),
    index("wallets_traitor_at_idx").on(table.traitorAt),
  ],
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
    uniqueIndex("events_signature_address_idx").on(table.signature, table.address),
  ],
);

/** Small pieces of indexer state: the scan cursor, the market's all-time high, a run lock. */
export const indexerState = pgTable("indexer_state", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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

/**
 * Every burn of the coin, one row per transaction: the Altar's offerings (fees spent on a
 * buyback, then burned) and any holder who burns their own tokens.
 */
export const burns = pgTable(
  "burns",
  {
    id: serial("id").primaryKey(),
    signature: text("signature").notNull().unique(),
    /** Tokens burned, in UI units. */
    amount: doublePrecision("amount").notNull(),
    /** The wallet that burned them. */
    burner: text("burner"),
    /** Seals broken when the burn happened. */
    seal: integer("seal"),
    at: timestamp("at", { withTimezone: true }).notNull(),
  },
  (table) => [index("burns_at_idx").on(table.at), index("burns_burner_idx").on(table.burner)],
);
