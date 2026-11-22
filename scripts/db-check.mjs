// npm run db:check: connects with DATABASE_URL from .env.local and lists the tables.
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

nextEnv.loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is empty. Put the Neon connection string in .env.local.");
  process.exit(1);
}

try {
  const sql = neon(url);
  const [{ now }] = await sql`select now() as now`;
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`;
  console.log(`Connected to Neon. Server time: ${new Date(now).toISOString()}`);
  console.log(
    tables.length
      ? `Tables: ${tables.map((t) => t.table_name).join(", ")}`
      : "No tables yet. Run: npm run db:migrate",
  );
} catch (error) {
  console.error(`Could not connect: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
