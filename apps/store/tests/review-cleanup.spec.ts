import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GET as cleanupRoute } from "../app/api/cron/review-cleanup/route";
import { ReviewCleanupError, reviewCleanupBatch, runReviewCleanup } from "../lib/review-cleanup";

const shopId = "123";
const photo = (n: number) => `${shopId}/${n.toString(16).padStart(8, "0")}-0000-4000-8000-000000000000.webp`;
const counts = { authorizations: 4, sessions: 3, photoBudgets: 2, writeBudgets: 1, expiredDrafts: 1, unreferencedPhotos: 0, orphanObjects: 0 };

function database(result: { data: unknown; error: unknown }, removeError: unknown = null) {
  const rpcs: { name: string; args: Record<string, unknown> }[] = [];
  const removed: string[][] = [];
  const client = {
    rpc: (name: string, args: Record<string, unknown>) => { rpcs.push({ name, args }); return { abortSignal: async () => result }; },
    storage: { from: (bucket: string) => { expect(bucket).toBe("store-review-photos"); return { remove: async (paths: string[]) => { removed.push(paths); return { error: removeError }; } }; } },
  };
  return { rpcs, removed, client: client as unknown as SupabaseClient };
}

test.describe("review cleanup", () => {
  test("deletes rows, then removes their objects in bounded chunks", async () => {
    const paths = Array.from({ length: 250 }, (_, index) => photo(index));
    const { rpcs, removed, client } = database({ data: { ...counts, orphanObjects: 249, objectPaths: paths }, error: null });
    const result = await runReviewCleanup({ database: client, shopId });
    expect(rpcs).toEqual([{ name: "store_review_cleanup", args: { p_shop_id: shopId, p_limit: reviewCleanupBatch } }]);
    expect(removed.map((chunk) => chunk.length)).toEqual([100, 100, 50]);
    expect(result).toEqual({ ...counts, orphanObjects: 249, objectsRemoved: 250 });
  });

  test("nothing to remove makes no storage request", async () => {
    const { removed, client } = database({ data: { ...counts, objectPaths: [] }, error: null });
    expect((await runReviewCleanup({ database: client, shopId })).objectsRemoved).toBe(0);
    expect(removed).toEqual([]);
  });

  test("refuses to remove anything outside the shop's photo folder", async () => {
    for (const path of ["456/00000000-0000-4000-8000-000000000000.webp", `${shopId}/../task-attachments/x`, `${shopId}/x.webp`]) {
      const { removed, client } = database({ data: { ...counts, objectPaths: [photo(1), path] }, error: null });
      await expect(runReviewCleanup({ database: client, shopId })).rejects.toEqual(new ReviewCleanupError("database"));
      expect(removed).toEqual([]);
    }
  });

  test("database and storage failures are reported by step", async () => {
    for (const result of [{ data: null, error: { code: "57014" } }, { data: { ...counts }, error: null }, { data: { ...counts, sessions: -1, objectPaths: [] }, error: null }]) {
      await expect(runReviewCleanup({ database: database(result).client, shopId })).rejects.toMatchObject({ step: "database" });
    }
    const failing = database({ data: { ...counts, objectPaths: [photo(1)] }, error: null }, { message: "down" });
    await expect(runReviewCleanup({ database: failing.client, shopId })).rejects.toMatchObject({ step: "storage" });
  });

  test("the cron route needs Vercel's bearer secret", async () => {
    const old = process.env.CRON_SECRET;
    try {
      delete process.env.CRON_SECRET;
      expect((await cleanupRoute(new Request("https://store.test/api/cron/review-cleanup"))).status).toBe(401);
      process.env.CRON_SECRET = "synthetic-cron-secret";
      for (const authorization of [undefined, "Bearer wrong", "synthetic-cron-secret"]) {
        const headers: HeadersInit = authorization ? { authorization } : {};
        expect((await cleanupRoute(new Request("https://store.test/api/cron/review-cleanup", { headers }))).status).toBe(401);
      }
    } finally {
      if (old === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = old;
    }
  });
});
