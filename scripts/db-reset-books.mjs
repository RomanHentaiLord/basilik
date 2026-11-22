// npm run db:reset-books -- --yes
// Empties both Books (wallets, events, indexer cursor). Use it after testing the indexer
// on someone else's coin, before pointing TOKEN_MINT at ours. The tables themselves stay.
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

nextEnv.loadEnvConfig(process.cwd());

if (!process.argv.includes("--yes")) {
  console.error("This deletes every wallet, event and the indexer cursor. Run again with: npm run db:reset-books -- --yes");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is empty. Put the Neon connection string in .env.local.");
  process.exit(1);
}

const sql = neon(url);
await sql`truncate table wallets, events, indexer_state`;
console.log("The Books are empty: wallets, events and the indexer cursor were cleared.");
