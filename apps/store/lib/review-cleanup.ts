import type { SupabaseClient } from "@supabase/supabase-js";
import { getStoreDatabase, getStoreShopId } from "./store-database";

const bucketName = "store-review-photos";
/** Storage removes at most this many objects per request. */
const removeChunk = 100;
/** Rows per category per run. A backlog drains over consecutive daily runs. */
export const reviewCleanupBatch = 500;

export type ReviewCleanupCounts = {
  authorizations: number; sessions: number; photoBudgets: number; writeBudgets: number;
  expiredDrafts: number; unreferencedPhotos: number; orphanObjects: number;
};
export type ReviewCleanupResult = ReviewCleanupCounts & { objectsRemoved: number };

const countKeys = ["authorizations", "sessions", "photoBudgets", "writeBudgets", "expiredDrafts", "unreferencedPhotos", "orphanObjects"] as const;

export class ReviewCleanupError extends Error {
  constructor(readonly step: "database" | "storage") { super(`Review cleanup failed at ${step}.`); }
}

function parse(value: unknown, shopId: string): { counts: ReviewCleanupCounts; paths: string[] } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const counts = {} as ReviewCleanupCounts;
  for (const key of countKeys) {
    const count = record[key];
    if (!Number.isInteger(count) || (count as number) < 0) return null;
    counts[key] = count as number;
  }
  const paths = record.objectPaths;
  // Only ever remove `<shop>/<id>.webp` in this shop's folder, whatever the database says.
  const shape = new RegExp(`^${shopId}/[0-9a-f-]{36}\\.webp$`);
  if (!Array.isArray(paths) || !paths.every((path) => typeof path === "string" && shape.test(path))) return null;
  return { counts, paths: paths as string[] };
}

/**
 * Store server only. Deletes expired sign-in and review rows in RMT, then
 * removes the photo objects they and earlier failed removals left behind.
 * A failed object removal is retried by the next run, which finds the object
 * again as an orphan.
 */
export async function runReviewCleanup({ database, shopId }: { database: SupabaseClient; shopId: string }): Promise<ReviewCleanupResult> {
  const result = await database.rpc("store_review_cleanup", { p_shop_id: shopId, p_limit: reviewCleanupBatch })
    .abortSignal(AbortSignal.timeout(30_000));
  const parsed = result.error ? null : parse(result.data, shopId);
  if (!parsed) throw new ReviewCleanupError("database");
  const bucket = database.storage.from(bucketName);
  let objectsRemoved = 0;
  for (let index = 0; index < parsed.paths.length; index += removeChunk) {
    const chunk = parsed.paths.slice(index, index + removeChunk);
    const removed = await bucket.remove(chunk);
    if (removed.error) throw new ReviewCleanupError("storage");
    objectsRemoved += chunk.length;
  }
  return { ...parsed.counts, objectsRemoved };
}

export function getReviewCleanup(env: NodeJS.ProcessEnv = process.env) {
  const database = getStoreDatabase(env);
  const shopId = getStoreShopId(env);
  return database && shopId ? () => runReviewCleanup({ database, shopId }) : null;
}
