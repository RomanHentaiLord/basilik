import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { AnyDb } from "./books";
import * as schema from "./schema";

/** A fresh in-memory Postgres with every migration applied. For tests only. */
export async function testDb(): Promise<AnyDb> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db as unknown as AnyDb;
}
