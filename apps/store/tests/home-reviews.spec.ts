import { expect, test } from "@playwright/test";
import { reviewCommandSchema, reviewResultSchema } from "@ryanmeetup/reviews";
import type { PublicReview, ReviewCommand } from "@ryanmeetup/reviews";
import { getHomeReviews } from "../lib/home-reviews";
import { createReviewBackend, ReviewBackendError } from "../lib/review-backend";
import type { ReviewBackend } from "../lib/review-backend";
import { fakeSupabase, supabaseCall } from "./fixtures/customer-auth-backend";

const review: PublicReview = {
  id: "00000000-0000-4000-8000-000000000001", rating: 1, title: "Runs small", body: "Try the next size up.", displayName: "Ryan F.",
  publishedAt: "2026-11-20T12:00:00.000Z", editedAt: null, item: { productId: "100", productTitle: "Old shirt title", variantTitle: null },
  verifiedPurchase: true, source: "store", photos: [], reply: null,
};
const backend = (value: unknown) => (async () => value) as ReviewBackend;

test("latest reviews pin the shop and use one bounded public read", async () => {
  const calls: unknown[] = [];
  const database = fakeSupabase(async (input, init) => {
    calls.push(supabaseCall(input, init));
    return Response.json([review]);
  });
  const read = createReviewBackend({ database, shopId: "123456" });
  expect(await read({ operation: "reviews.latest" })).toEqual([review]);
  expect(calls).toEqual([{ name: "store_latest_reviews", args: { p_shop_id: "123456" } }]);
  for (const extra of [{ shopId: "999" }, { limit: 100 }, { rating: 5 }, { subject: "private" }]) {
    expect(reviewCommandSchema({ operation: "reviews.latest", ...extra })).toBeNull();
  }
});

test("latest results reject private fields, oversized feeds, duplicates and out-of-order rows", async () => {
  const older = { ...review, id: "00000000-0000-4000-8000-000000000002", publishedAt: "2026-11-19T12:00:00.000Z" };
  expect(reviewResultSchema("reviews.latest", { data: [review, older] })).not.toBeNull();
  for (const rows of [null, [{ ...review, customerEmail: "private@example.test" }], [review, review], [older, review], Array.from({ length: 7 }, () => review)]) {
    expect(reviewResultSchema("reviews.latest", { data: rows })).toBeNull();
    const database = fakeSupabase(async () => Response.json(rows));
    await expect(createReviewBackend({ database, shopId: "123456" })({ operation: "reviews.latest" })).rejects.toThrow(ReviewBackendError);
  }
});

test("home cards reuse approved images, preserve low ratings and link to the reviewed product", async () => {
  const commands: ReviewCommand[] = [];
  const read = (async (command: ReviewCommand) => { commands.push(command); return [{ ...review, photos: [
    { url: "https://untrusted.test/image.webp", width: 48, height: 32 },
    { url: `/api/reviews/media/${review.id}/00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000003`, width: 48, height: 32 },
  ] }]; }) as ReviewBackend;
  const rows = await getHomeReviews({ backend: read, products: async (ids) => {
    expect(ids).toEqual(["100"]);
    return { "100": { handle: "name-tag-shirt", title: "Name Tag Shirt", image: null, options: [] } };
  } });
  expect(commands).toEqual([{ operation: "reviews.latest" }]);
  expect(rows[0].review).toMatchObject({ rating: 1, verification: "purchase", photoUrls: [expect.stringContaining("/api/reviews/media/")] });
  expect(rows[0].review.photoUrls).toHaveLength(1);
  expect(rows[0].product).toEqual({ title: "Name Tag Shirt", href: "/products/name-tag-shirt" });
});

test("empty and unavailable review reads leave the catalog alone and never fabricate cards", async () => {
  for (const read of [null, backend([]), backend([{ ...review, privateNote: "secret" }]), (async () => { throw Error("Database down"); }) as ReviewBackend]) {
    expect(await getHomeReviews({ backend: read, products: async () => { throw Error("Must not need products"); } })).toEqual([]);
  }
});

test("missing products keep the original review without inventing a broken product link", async () => {
  const rows = await getHomeReviews({ backend: backend([review]), products: async () => ({}) });
  expect(rows[0].product).toEqual({ title: "Old shirt title", href: null });
  const unavailable = await getHomeReviews({ backend: backend([review]), products: async () => { throw Error("Shopify unavailable"); } });
  expect(unavailable).toEqual(rows);
});

test("grouped product links keep the selected design without a review anchor", async () => {
  const rows = await getHomeReviews({ backend: backend([review]), products: async () => ({
    "100": { handle: "ryans-dad", title: "Dad shirt", image: null, options: [], href: "/products/name-tag-shirt?design=ryans-dad" },
  }) });
  expect(rows[0].product.href).toBe("/products/name-tag-shirt?design=ryans-dad");
});
