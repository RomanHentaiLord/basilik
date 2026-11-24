import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { AnyDb } from "./books";
import * as schema from "./schema";

/** Neon over HTTP for a Neon address, a plain Postgres connection pool for any other. */
export function isNeonUrl(url: string): boolean {
  return /\.neon\.tech\b/.test(url);
}

function createDb(): AnyDb | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (isNeonUrl(url)) return drizzleNeon(neon(url), { schema }) as unknown as AnyDb;
  // Our own Postgres next to the site (the server's docker compose): a small pool is plenty.
  return drizzlePostgres(postgres(url, { max: 10 }), { schema }) as unknown as AnyDb;
}

/** null until DATABASE_URL is set — the judge works without a database. */
export const db = createDb();
export type Db = AnyDb;
