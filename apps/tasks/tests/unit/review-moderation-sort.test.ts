import { describe, expect, it } from "vitest";
import { sortModerationReviews } from "@/lib/store-reviews/moderation";
import type { ModerationReview, ModerationRevision } from "@/lib/store-reviews/moderation";

const revision = (submittedAt: string): ModerationRevision =>
  ({ id: submittedAt, rating: 5, title: null, body: "Nice.", displayName: "Ryan", submittedAt });
function review(id: string, productTitle: string, submittedAt: string, status: Partial<ModerationReview> = {}): ModerationReview {
  const latest = revision(submittedAt);
  return { id, state: "active", createdAt: submittedAt, updatedAt: submittedAt, verifiedPurchase: true, source: "store",
    item: { productId: "1", productTitle, variantTitle: null }, pending: null, published: latest, latest, rejected: null,
    recentEvents: [], reply: null, ...status } as ModerationReview;
}

// Queue order is newest first.
const queue = [
  review("withdrawn", "ryan rock shirt", "2026-11-23T18:00:00.000000Z", { state: "withdrawn", published: null }),
  review("waiting", "Pin Set #10", "2026-11-22T18:00:00.000000Z", { pending: revision("2026-11-22T18:00:00.000000Z"), published: null }),
  review("hidden", "Pin Set #2", "2026-11-21T18:00:00.000000Z", { state: "hidden" }),
  review("published", "RYAN Rock Shirt", "2026-11-20T18:00:00.000000Z"),
];
const ids = (rows: ModerationReview[]) => rows.map((row) => row.id);

describe("sortModerationReviews", () => {
  it("keeps the queue order with no sort", () => {
    expect(sortModerationReviews(queue, null)).toBe(queue);
  });
  it("orders products naturally and case-insensitively, keeping queue order for ties", () => {
    expect(ids(sortModerationReviews(queue, { key: "product", descending: false }))).toEqual(["hidden", "waiting", "withdrawn", "published"]);
    expect(ids(sortModerationReviews(queue, { key: "product", descending: true }))).toEqual(["withdrawn", "published", "waiting", "hidden"]);
  });
  it("orders statuses by workflow", () => {
    expect(ids(sortModerationReviews(queue, { key: "status", descending: false }))).toEqual(["waiting", "published", "hidden", "withdrawn"]);
  });
  it("orders by the submission the row shows", () => {
    expect(ids(sortModerationReviews(queue, { key: "submitted", descending: false }))).toEqual(["published", "hidden", "waiting", "withdrawn"]);
  });
});
