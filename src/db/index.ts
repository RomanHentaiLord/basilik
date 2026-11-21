import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return drizzle(neon(url), { schema });
}

/** null until DATABASE_URL is set — the judge works without a database. */
export const db = createDb();
export type Db = NonNullable<typeof db>;
