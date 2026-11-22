import { createHash, timingSafeEqual } from "node:crypto";
import { privateJson } from "@/lib/request-guard";
import { getReviewCleanup, ReviewCleanupError } from "@/lib/review-cleanup";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Compare digests so length leaks nothing. */
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`));
}

/** Daily review and sign-in housekeeping; see `store_review_cleanup` in the RMT migrations. */
export async function GET(request: Request) {
  if (!authorized(request)) return privateJson(401, { error: "Unauthorized." });
  const cleanup = getReviewCleanup();
  if (!cleanup) return privateJson(503, { error: "Review cleanup is unavailable." });
  try {
    const result = await cleanup();
    console.info(JSON.stringify({ event: "store_review_cleanup", ...result }));
    return privateJson(200, result);
  } catch (error) {
    const step = error instanceof ReviewCleanupError ? error.step : "unexpected";
    console.error(JSON.stringify({ event: "store_review_cleanup_failed", step }));
    return privateJson(500, { error: "Review cleanup could not be completed." });
  }
}
