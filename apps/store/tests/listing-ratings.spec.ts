import { expect, test } from "@playwright/test";
import { reviewResultSchema } from "@ryanmeetup/reviews";
import { createReviewBackend, ReviewBackendError } from "../lib/review-backend";
import { MIN_LISTING_RATING_REVIEWS, poolListingRating, withListingRatings } from "../lib/listing-ratings";
import type { ProductListing } from "../lib/types";
import { fakeSupabase, supabaseCall, type SupabaseCall } from "./fixtures/customer-auth-backend";

const shopId = "123456";

/** A summary whose totals agree with its distribution, as the RPC returns it. */
function summary(distribution: [number, number, number, number, number]) {
  const count = distribution.reduce((sum, n) => sum + n, 0);
  const total = distribution.reduce((sum, n, index) => sum + n * (index + 1), 0);
  return { count, average: count ? total / count : 0, distribution: { 1: distribution[0], 2: distribution[1], 3: distribution[2], 4: distribution[3], 5: distribution[4] } };
}

/** Answers store_review_summary per product ID, recording each call. */
function database(byProduct: Record<string, unknown>, status = 200) {
  const calls: SupabaseCall[] = [];
  const client = fakeSupabase(async (input, init) => {
    const call = supabaseCall(input, init);
    if (!call || call.name !== "store_review_summary") throw new Error("Unexpected test request");
    calls.push(call);
    const [productId] = call.args.p_product_ids as string[];
    return new Response(JSON.stringify(byProduct[productId] ?? summary([0, 0, 0, 0, 0])), { status });
  });
  return { calls, backend: createReviewBackend({ database: client, shopId }) };
}

const listing = (id: string, extra: Partial<ProductListing> = {}) => ({ id: `gid://shopify/Product/${id}`, title: `Product ${id}`, ...extra }) as ProductListing;

test("summaries read each product on its own for the configured shop", async () => {
  const { calls, backend } = database({ "100": summary([0, 0, 0, 1, 5]) });
  const result = await backend({ operation: "reviews.summaries", productIds: ["100", "200"] });
  expect(result).toEqual({ "100": summary([0, 0, 0, 1, 5]), "200": summary([0, 0, 0, 0, 0]) });
  expect(calls.map(({ args }) => args)).toEqual([
    { p_shop_id: shopId, p_product_ids: ["100"] },
    { p_shop_id: shopId, p_product_ids: ["200"] },
  ]);
});

test("summaries reject malformed commands and inconsistent or failed responses", async () => {
  const { calls, backend } = database({});
  for (const productIds of [[], ["gid://shopify/Product/1"], ["1", "1"], Array.from({ length: 51 }, (_, index) => `${index + 1}`)]) {
    await expect(backend({ operation: "reviews.summaries", productIds })).rejects.toThrow(ReviewBackendError);
  }
  expect(calls).toHaveLength(0);
  await expect(database({ "100": { ...summary([0, 0, 0, 0, 5]), count: 9 } }).backend({ operation: "reviews.summaries", productIds: ["100"] })).rejects.toThrow(ReviewBackendError);
  await expect(database({ "100": { code: "XX000", message: "down" } }, 500).backend({ operation: "reviews.summaries", productIds: ["100"] })).rejects.toThrow(ReviewBackendError);
  expect(reviewResultSchema("reviews.summaries", { data: { "gid://shopify/Product/1": summary([0, 0, 0, 0, 1]) } })).toBeNull();
});

test("a rating appears only once enough reviews pool together", () => {
  expect(poolListingRating([summary([1, 0, 0, 0, MIN_LISTING_RATING_REVIEWS - 2])])).toBeNull();
  expect(poolListingRating([summary([1, 0, 0, 0, MIN_LISTING_RATING_REVIEWS - 1])])).toEqual({ average: 4.2, count: 5 });
  // Weighted by count, not a mean of averages.
  expect(poolListingRating([summary([0, 0, 0, 0, 4]), summary([2, 0, 0, 0, 0]), undefined])).toEqual({ average: 22 / 6, count: 6 });
});

test("catalogs gain ratings across products, sections, and design groups, and survive a failed read", async () => {
  const { backend } = database({ "100": summary([0, 0, 0, 2, 4]), "200": summary([0, 0, 0, 0, 2]), "300": summary([0, 0, 0, 0, 3]), "400": summary([0, 0, 1, 0, 0]) });
  const group = listing("300", { designs: [{ label: "A", value: "a", product: listing("300") }, { label: "B", value: "b", product: listing("200") }] });
  const catalog = { products: [listing("100"), listing("200"), group], sections: [{ collection: { id: "c", handle: "c", title: "C", description: "", image: null }, products: [listing("100")], total: 1 }], more: [listing("400")] };
  const rated = await withListingRatings(catalog, backend);
  expect(rated.products.map((product) => product.rating)).toEqual([{ average: 28 / 6, count: 6 }, undefined, { average: 5, count: 5 }]);
  expect(rated.sections[0].products[0].rating).toEqual({ average: 28 / 6, count: 6 });
  expect(rated.more[0].rating).toBeUndefined();
  // Counts cover every listing that was read, below the rating threshold and across design groups.
  expect(rated.products.map((product) => product.reviewCount)).toEqual([6, 2, 5]);
  expect(rated.more[0].reviewCount).toBe(1);
  const empty = { products: [listing("500"), listing("200")] };
  expect((await withListingRatings(empty, backend)).products.map((product) => product.reviewCount)).toEqual([0, 2]);
  expect((await withListingRatings({ products: [listing("not-a-number")] }, backend)).products[0].reviewCount).toBeUndefined();

  const failing = database({}, 503).backend;
  expect(await withListingRatings(catalog, failing)).toBe(catalog);
  expect(await withListingRatings(catalog, null)).toBe(catalog);
});
