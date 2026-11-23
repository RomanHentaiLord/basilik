// Applies new migrations from drizzle/ to DATABASE_URL. Runs before every Vercel build
// (vercel.json), so a deploy never meets a database older than its code.
// Never fails the build: without a database it skips, and on an error it warns loudly
// and lets the deploy go on (the pages fall back where they can; run npm run db:migrate by hand).
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

nextEnv.loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL is empty: no database to migrate.");
} else {
  try {
    await migrate(drizzle(neon(url)), { migrationsFolder: "drizzle" });
    console.log("[migrate] the database is up to date.");
  } catch (error) {
    console.warn("[migrate] COULD NOT MIGRATE THE DATABASE. Run `npm run db:migrate` by hand.");
    console.warn(error instanceof Error ? error.message : error);
  }
}
