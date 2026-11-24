// Shared by the scripts: a SQL client and a Drizzle database for DATABASE_URL,
// Neon over HTTP for a Neon address, a plain Postgres connection for any other.
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());

export const url = process.env.DATABASE_URL ?? "";
export const isNeon = /\.neon\.tech\b/.test(url);

/** A tagged-template SQL client: sql`select 1`. Call close() when done. */
export function sqlClient() {
  if (isNeon) return { sql: neon(url), close: async () => {} };
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  return { sql, close: () => sql.end() };
}

/** Applies every new migration in drizzle/. */
export async function migrateAll() {
  if (isNeon) {
    const { drizzle } = await import("drizzle-orm/neon-http");
    const { migrate } = await import("drizzle-orm/neon-http/migrator");
    await migrate(drizzle(neon(url)), { migrationsFolder: "drizzle" });
    return;
  }
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
  } finally {
    await sql.end();
  }
}
