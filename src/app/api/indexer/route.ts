import { runIndexerOnce } from "@/server/indexer";

/** One pass reads about 80 transactions; give it room on serverless hosts. */
export const maxDuration = 60;

/**
 * GET /api/indexer — one pass of the sales scanner.
 * Called by GitHub Actions (or any cron) with `Authorization: Bearer <INDEXER_SECRET>`.
 * On Vercel, a Vercel Cron sends CRON_SECRET the same way, so either secret works.
 */
export async function GET(request: Request) {
  const secrets = [process.env.INDEXER_SECRET, process.env.CRON_SECRET]
    .map((secret) => secret?.trim())
    .filter((secret): secret is string => Boolean(secret));
  if (secrets.length === 0) {
    return Response.json({ error: "Set INDEXER_SECRET to call the indexer." }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  if (!secrets.some((secret) => auth === `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const outcome = await runIndexerOnce({ force: true });
  return Response.json(outcome);
}
