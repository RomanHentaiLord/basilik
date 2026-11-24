// npm run db:check: connects with DATABASE_URL from .env.local and lists the tables.
import { isNeon, sqlClient, url } from "./db.mjs";

if (!url) {
  console.error("DATABASE_URL is empty. Put the database address in .env.local.");
  process.exit(1);
}

const { sql, close } = sqlClient();
try {
  const [{ now }] = await sql`select now() as now`;
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`;
  console.log(`Connected to ${isNeon ? "Neon" : "Postgres"}. Server time: ${new Date(now).toISOString()}`);
  console.log(
    tables.length
      ? `Tables: ${tables.map((t) => t.table_name).join(", ")}`
      : "No tables yet. Run: npm run db:migrate",
  );
} catch (error) {
  console.error(`Could not connect: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await close();
}
