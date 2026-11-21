import { expect, test } from "@playwright/test";
import { reviewCommandSchema } from "@ryanmeetup/reviews";
import { createReviewBackend, ReviewBackendError } from "../lib/review-backend";
import { getCustomReviews, numericProductId } from "../lib/custom-reviews";
import { getStoreDatabase } from "../lib/store-database";
import { demoProducts, isDemoProductId } from "../lib/demo-data";
import { fakeSupabase, supabaseCall, type SupabaseCall } from "./fixtures/customer-auth-backend";

const review = {
  id: "3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b", rating: 4, title: "Ryan approved", body: "Holding up well.", displayName: "Ryan L.",
  publishedAt: "2026-11-17T12:00:00.000Z", editedAt: null,
  item: { productId: "100", productTitle: "Name Tag Shirt", variantTitle: "Black / M" }, verifiedPurchase: true,
  photos: [{ url: "/api/reviews/media/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000003", width: 800, height: 600 }, { url: "https://cdn.example.test/b.webp", width: 800, height: 600 }], reply: null,
};
const page = { scope: { productIds: ["100"] }, summary: { count: 25, average: 4, distribution: { 1: 0, 2: 0, 3: 0, 4: 25, 5: 0 } }, reviews: [review], nextCursor: null };

const shopId = "123456";

/** Answers the two read RPCs from fixed bodies, recording each call. */
function database(responses: Record<string, [unknown, number?]> = { store_review_summary: [page.summary], store_public_reviews: [[review]] }) {
  const calls: SupabaseCall[] = [];
  const client = fakeSupabase(async (input, init) => {
    const call = supabaseCall(input, init);
    if (!call) throw new Error("Unexpected test request");
    calls.push(call);
    const [body, status = 200] = responses[call.name] ?? [{ code: "PGRST202", message: "unknown function" }, 404];
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  });
  return { calls, backend: createReviewBackend({ database: client, shopId }) };
}

test("the store database is RMT only, with loopback allowed outside production", () => {
  const key = "synthetic-supabase-secret";
  expect(getStoreDatabase({ NODE_ENV: "production", SUPABASE_URL: "https://lvfaartgcpphuokoswcm.supabase.co", SUPABASE_SECRET_KEY: key })).not.toBeNull();
  for (const env of [
    { NODE_ENV: "production", SUPABASE_URL: "https://vjsnobmfsfrsnwukfaoq.supabase.co", SUPABASE_SECRET_KEY: key },
    { NODE_ENV: "production", SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: key },
    { NODE_ENV: "production", SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SECRET_KEY: key },
    { NODE_ENV: "production", SUPABASE_URL: "https://lvfaartgcpphuokoswcm.supabase.co", SUPABASE_SECRET_KEY: "" },
  ]) expect(getStoreDatabase(env as NodeJS.ProcessEnv)).toBeNull();
  expect(getStoreDatabase({ NODE_ENV: "development", SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SECRET_KEY: key } as NodeJS.ProcessEnv)).not.toBeNull();
});

test("a page read runs the fixed RPCs for the configured shop", async () => {
  const { calls, backend } = database();
  expect(await backend({ operation: "reviews.page", productIds: ["100"], limit: 20, cursor: null })).toEqual(page);
  expect(calls.map(({ name }) => name).sort()).toEqual(["store_public_reviews", "store_review_summary"]);
  expect(calls.every(({ args }) => args.p_shop_id === shopId)).toBe(true);
  expect(calls.find(({ name }) => name === "store_public_reviews")?.args).toMatchObject({ p_product_ids: ["100"], p_limit: 21 });
});

test("a review without a matching order sends no order details, and reviewed products come from their own RPC", async () => {
  const submission = { rating: 4, title: "Gift", body: "Wearing it weekly.", nameStyle: "first-initial" } as const;
  const product = { productId: "100", variantId: null, productTitle: "Name Tag Shirt", variantTitle: null };
  const submit = (purchase: object) => reviewCommandSchema({ operation: "review.submit", subject: "buyer", purchase, submission, displayName: "Ryan L." });
  expect(submit({ ...product, orderId: null, lineId: null })).not.toBeNull();
  expect(submit({ ...product, orderId: "9000", lineId: "1" })).not.toBeNull();
  for (const half of [{ orderId: "9000", lineId: null }, { orderId: null, lineId: "1" }, { orderId: null, lineId: null, variantId: "200" }, { orderId: null, lineId: null, variantTitle: "Black / M" }]) {
    expect(submit({ ...product, ...half })).toBeNull();
  }
  const { calls, backend } = database({ store_buyer_reviewed_products: [["100"]] });
  expect(await backend({ operation: "reviews.reviewedProducts", subject: "buyer", productIds: ["100", "101"] })).toEqual(["100"]);
  expect(calls).toEqual([{ name: "store_buyer_reviewed_products", args: { p_shop_id: shopId, p_subject: "buyer", p_product_ids: ["100", "101"] } }]);
  // A product the page didn't ask about is an unexpected row, not an answer.
  await expect(database({ store_buyer_reviewed_products: [["999"]] }).backend({ operation: "reviews.reviewedProducts", subject: "buyer", productIds: ["100"] })).rejects.toThrow(ReviewBackendError);
});

test("malformed commands never reach the database", async () => {
  const { calls, backend } = database();
  // @ts-expect-error -- an operation outside the contract
  await expect(backend({ operation: "review.approve" })).rejects.toThrow(ReviewBackendError);
  await expect(backend({ operation: "reviews.page", productIds: ["gid://shopify/Product/1"], limit: 20, cursor: null })).rejects.toThrow(ReviewBackendError);
  expect(calls).toHaveLength(0);
});

test("buyer review rows ignore fields this build doesn't know, but still require every known one", async () => {
  const mine = {
    id: review.id, lineId: "200", item: review.item, status: "pending", hasPendingEdit: false, rejectionReason: null, rejectedPhotos: [], publishedAt: null,
    createdAt: "2026-11-17T12:00:00.000000Z", updatedAt: "2026-11-17T12:00:00.000000Z",
    current: { rating: 4, title: "Ryan approved", body: "Holding up well.", nameStyle: "anonymous", displayName: "Anonymous Ryan" },
  };
  // A later migration may add fields before this deployment learns about them.
  const newer = { ...mine, addedLater: "staff only", item: { ...mine.item, addedLater: 1 }, current: { ...mine.current, addedLater: true } };
  const { backend } = database({ store_buyer_reviews: [[newer]] });
  expect(await backend({ operation: "reviews.mine", subject: "buyer", cursor: null })).toEqual({ reviews: [mine], nextCursor: null });
  expect(await backend({ operation: "review.mine", subject: "buyer", reviewId: review.id })).toEqual(mine);
  // Rows from before photo rejection reasons existed read as having none.
  const older: Record<string, unknown> = { ...mine }; delete older.rejectedPhotos;
  expect(await database({ store_buyer_reviews: [[older]] }).backend({ operation: "review.mine", subject: "buyer", reviewId: review.id })).toEqual(mine);
  const rejectedPhotos = [{ id: "00000000-0000-4000-8000-000000000201", reason: "Swap in a photo of the shirt." }];
  expect(await database({ store_buyer_reviews: [[{ ...mine, rejectedPhotos }]] }).backend({ operation: "review.mine", subject: "buyer", reviewId: review.id })).toEqual({ ...mine, rejectedPhotos });
  for (const invalid of [[{ id: "not-a-uuid", reason: "x" }], [{ id: rejectedPhotos[0].id, reason: " " }], [{ ...rejectedPhotos[0], staff: "Ryan" }], [rejectedPhotos[0], rejectedPhotos[0]]])
    await expect(database({ store_buyer_reviews: [[{ ...mine, rejectedPhotos: invalid }]] }).backend({ operation: "review.mine", subject: "buyer", reviewId: review.id })).rejects.toThrow(ReviewBackendError);
  await expect(database({ store_buyer_reviews: [[{ ...mine, status: "hidden", rejectedPhotos }]] }).backend({ operation: "review.mine", subject: "buyer", reviewId: review.id })).rejects.toThrow(ReviewBackendError);
  const { rejectionReason: _dropped, ...missing } = mine;
  await expect(database({ store_buyer_reviews: [[missing]] }).backend({ operation: "reviews.mine", subject: "buyer", cursor: null })).rejects.toThrow(ReviewBackendError);
});

test("unexpected, leaky, or failed responses become one generic error", async () => {
  for (const responses of [
    { store_review_summary: [page.summary], store_public_reviews: [[{ ...review, customerEmail: "ryan@example.com" }]] },
    { store_review_summary: [{ ...page.summary, count: 3 }], store_public_reviews: [[review]] },
    { store_review_summary: ["not json"], store_public_reviews: [[review]] },
    { store_review_summary: [{ code: "XX000", message: "private database detail" }, 500], store_public_reviews: [[review]] },
  ] as Record<string, [unknown, number?]>[]) {
    const { backend } = database(responses);
    const error = await backend({ operation: "reviews.page", productIds: ["100"], limit: 20, cursor: null }).catch((caught: Error) => caught);
    expect(error).toBeInstanceOf(ReviewBackendError);
    expect((error as Error).message).toBe("Review storage is temporarily unavailable.");
  }
});

test("custom reads map a page to the storefront shape, keeping only renderable photo hosts", async () => {
  expect(await getCustomReviews("gid://shopify/Product/100", database().backend)).toEqual({
    status: "available", averageRating: 4, count: 25, productId: "100",
    reviews: [{ id: review.id, rating: 4, title: "Ryan approved", body: "Holding up well.", reviewerName: "Ryan L.", createdAt: review.publishedAt, verification: "purchase", photoUrls: ["/api/reviews/media/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000003"] }],
  });
});

test("custom reads report unavailable instead of an empty success", async () => {
  const unavailable = { status: "unavailable", averageRating: 0, count: 0, reviews: [] };
  expect(await getCustomReviews("gid://shopify/Product/100", null)).toEqual(unavailable);
  expect(await getCustomReviews("not-a-product", database().backend)).toEqual(unavailable);
  const failing = database({ store_review_summary: [{ message: "down" }, 503], store_public_reviews: [{ message: "down" }, 503] }).backend;
  expect(await getCustomReviews("gid://shopify/Product/100", failing)).toEqual(unavailable);
  expect(numericProductId("gid://shopify/Product/8123456789")).toBe("8123456789");
  expect(numericProductId("demo-1")).toBeNull();
});

test("demo products have unique numeric IDs, so custom reviews work on the demo catalog", () => {
  const ids = demoProducts.map(({ id }) => id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) {
    expect(numericProductId(id)).toMatch(/^9\d{10}$/);
    expect(isDemoProductId(id)).toBe(true);
  }
  expect(isDemoProductId("gid://shopify/Product/8123456789")).toBe(false);
});

test("photo commands use atomic RPCs and strictly validate ordered private IDs", async () => {
  const photoId = "00000000-0000-4000-8000-000000000001";
  const submission = { rating: 5, title: "Great shirt", body: "Love it.", nameStyle: "anonymous" };
  const submit = { operation: "review.submit", subject: "buyer", purchase: { orderId: null, lineId: null, productId: "100", variantId: null, productTitle: "Shirt", variantTitle: null }, submission, displayName: "Anonymous Ryan", photoIds: [photoId] };
  const { backend, calls } = database({ store_submit_review_with_photos: [[{ review_id: null, outcome: "invalid_photos" }]], store_edit_buyer_review_with_photos: ['"invalid_photos"'] });
  const command = reviewCommandSchema(submit);
  expect(command).not.toBeNull();
  expect(await backend(command!)).toEqual({ reviewId: null, outcome: "invalid_photos" });
  expect(calls[0]).toMatchObject({ name: "store_submit_review_with_photos", args: { p_shop_id: shopId, p_subject: "buyer", p_photo_ids: [photoId] } });
  for (const photoIds of [null, undefined, [photoId, photoId], Array(6).fill(photoId), ["https://example.test/a.webp"], ["../private"]]) {
    expect(reviewCommandSchema({ ...submit, photoIds })).toBeNull();
  }
  const edit = reviewCommandSchema({ operation: "review.edit", subject: "buyer", reviewId: review.id, expectedUpdatedAt: "2026-11-20T00:00:00.000001Z", submission, displayName: "Anonymous Ryan", photoIds: [] });
  expect(await backend(edit!)).toBe("invalid_photos");
  expect(calls[1]).toMatchObject({ name: "store_edit_buyer_review_with_photos", args: { p_photo_ids: [] } });
});
