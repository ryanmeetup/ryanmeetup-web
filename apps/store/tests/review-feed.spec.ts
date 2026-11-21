import { expect, test } from "@playwright/test";
import { encodeReviewCursor, reviewCommandSchema, reviewResultSchema } from "@ryanmeetup/reviews";
import type { PublicReview, ReviewCommand } from "@ryanmeetup/reviews";
import { createReviewBackend, ReviewBackendError } from "../lib/review-backend";
import type { ReviewBackend } from "../lib/review-backend";
import { getReviewFeedPage, handleReviewFeedPage } from "../lib/review-feed";
import { fakeSupabase, supabaseCall } from "./fixtures/customer-auth-backend";

const review = (n: number, productId = "100"): PublicReview => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, rating: 5, title: "Fits", body: "Fits like a Ryan.", displayName: "Ryan F.",
  publishedAt: new Date(Date.UTC(2026, 10, 20, 12, 0, n)).toISOString(), editedAt: null,
  item: { productId, productTitle: "Old shirt title", variantTitle: null }, verifiedPurchase: false, source: "store", photos: [], reply: null,
});
const newestFirst = (count: number) => Array.from({ length: count }, (_, index) => review(count - index, String(100 + (index % 3))));
const products = async () => ({ "100": { handle: "name-tag-shirt", title: "Name Tag Shirt", image: null, options: [] } });

test("the feed pins the shop, asks for one extra row and cursors from the last review shown", async () => {
  const calls: unknown[] = [];
  const rows = newestFirst(21);
  const database = fakeSupabase(async (input, init) => { calls.push(supabaseCall(input, init)); return Response.json(rows); });
  const page = await createReviewBackend({ database, shopId: "123456" })({ operation: "reviews.feed", limit: 20, cursor: null });
  expect(calls).toEqual([{ name: "store_review_feed", args: { p_shop_id: "123456", p_limit: 21, p_after_published_at: null, p_after_id: null } }]);
  expect(page.reviews).toEqual(rows.slice(0, 20));
  expect(page.nextCursor).toBe(encodeReviewCursor({ publishedAt: rows[19].publishedAt, id: rows[19].id }));

  calls.length = 0;
  const last = await createReviewBackend({ database: fakeSupabase(async (input, init) => { calls.push(supabaseCall(input, init)); return Response.json([review(1)]); }), shopId: "123456" })(
    { operation: "reviews.feed", limit: 20, cursor: page.nextCursor });
  expect(calls).toEqual([{ name: "store_review_feed", args: { p_shop_id: "123456", p_limit: 21, p_after_published_at: rows[19].publishedAt, p_after_id: rows[19].id } }]);
  expect(last).toEqual({ reviews: [review(1)], nextCursor: null });
});

test("feed commands cannot choose the shop, a product, a buyer or an unbounded page", () => {
  expect(reviewCommandSchema({ operation: "reviews.feed", limit: 20, cursor: null })).not.toBeNull();
  for (const command of [
    { operation: "reviews.feed", limit: 20 }, { operation: "reviews.feed", limit: 0, cursor: null }, { operation: "reviews.feed", limit: 51, cursor: null },
    { operation: "reviews.feed", limit: 20, cursor: "not a cursor" }, { operation: "reviews.feed", limit: 20, cursor: null, shopId: "999" },
    { operation: "reviews.feed", limit: 20, cursor: null, productIds: ["100"] }, { operation: "reviews.feed", limit: 20, cursor: null, subject: "private" },
  ]) expect(reviewCommandSchema(command)).toBeNull();
});

test("feed results reject private fields, duplicates, out-of-order rows and cursors that don't match the page", async () => {
  const [newer, older] = [review(2), review(1)];
  const cursor = encodeReviewCursor({ publishedAt: older.publishedAt, id: older.id });
  expect(reviewResultSchema("reviews.feed", { data: { reviews: [newer, older], nextCursor: cursor } })).not.toBeNull();
  for (const data of [
    { reviews: [{ ...newer, customerEmail: "private@example.test" }], nextCursor: null }, { reviews: [newer, newer], nextCursor: null },
    { reviews: [older, newer], nextCursor: null }, { reviews: [newer, older], nextCursor: encodeReviewCursor({ publishedAt: newer.publishedAt, id: newer.id }) },
    { reviews: [], nextCursor: cursor }, { reviews: newestFirst(51), nextCursor: null }, { reviews: [newer] },
  ]) expect(reviewResultSchema("reviews.feed", { data })).toBeNull();
  for (const rows of [null, [{ ...newer, privateNote: "secret" }], [older, newer]]) {
    const database = fakeSupabase(async () => Response.json(rows));
    await expect(createReviewBackend({ database, shopId: "123456" })({ operation: "reviews.feed", limit: 20, cursor: null })).rejects.toThrow(ReviewBackendError);
  }
});

test("feed pages link existing products to their page, not the review anchor, and keep stored titles for missing ones", async () => {
  const commands: ReviewCommand[] = [];
  const read = (async (command: ReviewCommand) => { commands.push(command); return { reviews: [review(2), review(1, "200")], nextCursor: null }; }) as ReviewBackend;
  const page = await getReviewFeedPage({ backend: read, products });
  expect(commands).toEqual([{ operation: "reviews.feed", limit: 20, cursor: null }]);
  expect(page?.items.map((item) => item.product)).toEqual([
    { title: "Name Tag Shirt", href: "/products/name-tag-shirt" }, { title: "Old shirt title", href: null },
  ]);
  expect(page?.nextCursor).toBeNull();
});

test("unavailable, invalid and stuck feed reads report a failure instead of an empty shop", async () => {
  const cursor = encodeReviewCursor({ publishedAt: review(1).publishedAt, id: review(1).id });
  for (const backend of [null, (async () => { throw Error("Database down"); }) as ReviewBackend, (async () => ({ reviews: [{ ...review(1), privateNote: "x" }], nextCursor: null })) as ReviewBackend]) {
    expect(await getReviewFeedPage({ backend, products })).toBeNull();
  }
  expect(await getReviewFeedPage({ backend: (async () => ({ reviews: [review(1)], nextCursor: cursor })) as ReviewBackend, cursor, products })).toBeNull();
  expect(await getReviewFeedPage({ backend: (async () => { throw Error("Must not read"); }) as ReviewBackend, cursor: "bad cursor", products })).toBeNull();
  expect(await getReviewFeedPage({ backend: (async () => ({ reviews: [], nextCursor: null })) as ReviewBackend, products })).toEqual({ items: [], nextCursor: null });
});

test("the feed route accepts only a single valid cursor and never reads storage otherwise", async () => {
  const cursor = encodeReviewCursor({ publishedAt: review(2).publishedAt, id: review(2).id });
  const untouched = (async () => { throw Error("Must not read"); }) as ReviewBackend;
  for (const query of ["", "?cursor=", "?cursor=bad", `?cursor=${cursor}&cursor=${cursor}`, `?cursor=${cursor}&productId=100`, `?cursor=${cursor}&limit=500`]) {
    const response = await handleReviewFeedPage(new Request(`https://store.test/api/reviews/feed${query}`), { backend: untouched, products });
    expect(response.status, query).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
  }
  const ok = await handleReviewFeedPage(new Request(`https://store.test/api/reviews/feed?cursor=${cursor}`),
    { backend: (async () => ({ reviews: [review(1)], nextCursor: null })) as ReviewBackend, products });
  expect(ok.status).toBe(200);
  expect((await ok.json()).items).toHaveLength(1);
  expect((await handleReviewFeedPage(new Request(`https://store.test/api/reviews/feed?cursor=${cursor}`), { backend: null })).status).toBe(503);
});
