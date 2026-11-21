import { afterEach, describe, expect, it, vi } from "vitest";
import { bulkReviewTargets } from "@/lib/store-reviews/bulk-moderation";
import { saveBulkReviewActions } from "@/lib/store-reviews/bulk-moderation-client";
import type { ModerationReview, ModerationRevision } from "@/lib/store-reviews/moderation";

const timestamp = "2026-11-18T12:00:00.123456Z";
function review(id: string, overrides: Partial<ModerationReview> = {}): ModerationReview {
  const latest: ModerationRevision = { id: `revision-${id}`, rating: 1, title: null, body: "Review text", displayName: "Ryan", submittedAt: timestamp };
  return { id, state: "active", createdAt: timestamp, updatedAt: timestamp,
    item: { productId: "100", productTitle: "Shirt", variantTitle: null }, verifiedPurchase: false, source: "store",
    pending: latest, published: null, rejected: null, latest, reply: null, recentEvents: [], ...overrides };
}

describe("bulk review decisions", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses existing eligibility rules, including hidden approvals and buyer withdrawals", () => {
    const pending = review("pending");
    const hidden = review("hidden", { state: "hidden" });
    const rejected = review("rejected", { pending: null, rejected: pending.latest });
    const withdrawn = review("withdrawn", { state: "withdrawn", pending: null });
    const reviews = [pending, hidden, rejected, withdrawn];
    expect(bulkReviewTargets(reviews, "approve").map((row) => row.id)).toEqual(["pending", "hidden"]);
    expect(bulkReviewTargets(reviews, "republish")).toEqual([rejected]);
    expect(bulkReviewTargets(reviews, "restore")).toEqual([hidden]);
    expect(bulkReviewTargets(reviews, "hide")).toEqual([]);
    expect(bulkReviewTargets(reviews, "delete")).toEqual(reviews);
  });

  it("saves eligible reviews sequentially with their exact revision and timestamp", async () => {
    let inFlight = 0;
    const transport = vi.fn(async () => {
      expect(inFlight++).toBe(0);
      await Promise.resolve();
      inFlight--;
      return Response.json({ saved: true });
    });
    vi.stubGlobal("fetch", transport);
    const progress = vi.fn();
    const result = await saveBulkReviewActions({ action: "approve", reviews: [review("one"), review("two"), review("withdrawn", { state: "withdrawn" })], note: null, onProgress: progress });
    expect(result).toEqual({ saved: 2, conflicts: 0, uncertain: 0, photosLeft: 0, unattempted: 0 });
    expect(progress.mock.calls).toEqual([[1], [2]]);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport).toHaveBeenNthCalledWith(2, "/api/admin/reviews", expect.objectContaining({
      method: "POST", body: JSON.stringify({ action: "approve", reviewId: "two", expectedUpdatedAt: timestamp, revisionId: "revision-two", note: null }),
    }));
  });

  it("skips a changed review and continues independent reviews without retrying", async () => {
    const transport = vi.fn().mockResolvedValueOnce(Response.json({ code: "CONFLICT" }, { status: 409 }))
      .mockResolvedValueOnce(Response.json({ saved: true }));
    vi.stubGlobal("fetch", transport);
    const result = await saveBulkReviewActions({ action: "reject", reviews: [review("one"), review("two")], note: "Please describe the product." });
    expect(result).toMatchObject({ saved: 1, conflicts: 1, uncertain: 0, unattempted: 0 });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it.each(["lost response", "missing acknowledgement"])("stops on %s and reports saved and unattempted reviews", async (failure) => {
    const transport = vi.fn().mockResolvedValueOnce(Response.json({ saved: true }));
    if (failure === "lost response") transport.mockRejectedValueOnce(new TypeError("Network request failed"));
    else transport.mockResolvedValueOnce(Response.json({ saved: false }));
    vi.stubGlobal("fetch", transport);
    const result = await saveBulkReviewActions({ action: "approve", reviews: [review("one"), review("two"), review("three")], note: null });
    expect(result).toMatchObject({ saved: 1, conflicts: 0, uncertain: 1, unattempted: 1 });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("requires the normal reasons before sending any destructive request", async () => {
    const transport = vi.fn();
    vi.stubGlobal("fetch", transport);
    for (const action of ["reject", "hide", "delete"] as const) {
      await expect(saveBulkReviewActions({ action, reviews: [review("one")], note: null })).rejects.toThrow("reason is required");
    }
    expect(transport).not.toHaveBeenCalled();
  });

  it("deletes through the audited endpoint and reports private photo cleanup failures", async () => {
    const transport = vi.fn().mockResolvedValueOnce(Response.json({ deleted: true, photosRemoved: false }))
      .mockResolvedValueOnce(Response.json({ deleted: true, photosRemoved: true }));
    vi.stubGlobal("fetch", transport);
    const result = await saveBulkReviewActions({ action: "delete", reviews: [review("one"), review("two")], reason: "spam", note: "Same spam link." });
    expect(result).toMatchObject({ saved: 2, photosLeft: 1 });
    expect(transport).toHaveBeenNthCalledWith(1, "/api/admin/reviews", expect.objectContaining({
      method: "DELETE", body: JSON.stringify({ reviewId: "one", expectedUpdatedAt: timestamp, reason: "spam", note: "Same spam link." }),
    }));
  });
});
