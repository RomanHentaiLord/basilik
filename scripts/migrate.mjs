// Applies new migrations from drizzle/ to DATABASE_URL. Runs before every Vercel build
// (vercel.json) and every start of the server's container (scripts/start.sh).
// With --soft (deploys) it never stops the deploy: on an error it warns loudly and lets the
// site start (the pages fall back where they can). By hand (npm run db:migrate) an error fails.
import { migrateAll, url } from "./db.mjs";

const soft = process.argv.includes("--soft");

if (!url) {
  console.log("[migrate] DATABASE_URL is empty: no database to migrate.");
} else {
  try {
    await migrateAll();
    console.log("[migrate] the database is up to date.");
  } catch (error) {
    console.warn("[migrate] COULD NOT MIGRATE THE DATABASE.");
    console.warn(error instanceof Error ? error.message : error);
    if (!soft) process.exitCode = 1;
  }
}
