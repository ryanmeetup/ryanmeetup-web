import { expect, test } from "@playwright/test";
import { reviewCommandSchema, reviewResultSchema } from "@ryanmeetup/reviews";
import type { PublicReview, ReviewCommand } from "@ryanmeetup/reviews";
import { DEFAULT_REVIEW_VIEW } from "../lib/public-review-view";
import { createReviewBackend, ReviewBackendError } from "../lib/review-backend";
import type { ReviewBackend } from "../lib/review-backend";
import { getReviewFeedPage, handleReviewFeedPage } from "../lib/review-feed";
import { fakeSupabase, supabaseCall } from "./fixtures/customer-auth-backend";

const review = (n: number, productId = "100"): PublicReview => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, rating: 5, title: "Fits", body: "Fits like a Ryan.", displayName: "Ryan F.",
  publishedAt: new Date(Date.UTC(2026, 10, 20, 12, 0, n)).toISOString(), editedAt: null,
  item: { productId, productTitle: "Old shirt title", variantTitle: null }, verifiedPurchase: false, source: "store", photos: [], reply: null,
});
const products = async () => ({ "100": { handle: "name-tag-shirt", title: "Name Tag Shirt", image: null, options: [] } });
const search = { rating: null, source: null, sort: "newest", query: "" } as const;
const command = { operation: "reviews.search", productIds: null, search, limit: 25, offset: 0, focusReviewId: null } as const;

test("search pins the shop and passes the fixed filters, page and focus to storage", async () => {
  const calls: unknown[] = [];
  const data = { reviews: [review(2), review(1)], total: 30, offset: 25 };
  const database = fakeSupabase(async (input, init) => { calls.push(supabaseCall(input, init)); return Response.json(data); });
  const focus = review(1).id;
  const page = await createReviewBackend({ database, shopId: "123456" })({
    ...command, productIds: ["100"], search: { rating: 5, source: "etsy", sort: "lowest", query: "coaster" }, offset: 25, focusReviewId: focus,
  });
  expect(calls).toEqual([{ name: "store_public_review_search", args: {
    p_shop_id: "123456", p_product_ids: ["100"], p_rating: 5, p_source: "etsy", p_sort: "lowest", p_query: "coaster", p_limit: 25, p_offset: 25, p_focus_id: focus,
  } }]);
  expect(page).toEqual(data);

  calls.length = 0;
  await createReviewBackend({ database, shopId: "123456" })(command);
  expect(calls).toEqual([{ name: "store_public_review_search", args: {
    p_shop_id: "123456", p_product_ids: null, p_rating: null, p_source: null, p_sort: "newest", p_query: null, p_limit: 25, p_offset: 0, p_focus_id: null,
  } }]);
});

test("search commands cannot choose the shop, a buyer, free-form filters or an unbounded page", () => {
  expect(reviewCommandSchema(command)).not.toBeNull();
  expect(reviewCommandSchema({ ...command, productIds: ["100"], search: { rating: 3, source: "unmatched", sort: "oldest", query: "ryan" } })).not.toBeNull();
  for (const bad of [
    { ...command, limit: 0 }, { ...command, limit: 51 }, { ...command, offset: -1 }, { ...command, offset: 100_001 }, { ...command, offset: 1.5 },
    { ...command, productIds: [] }, { ...command, productIds: ["gid://shopify/Product/1"] }, { ...command, focusReviewId: "not-a-review" },
    { ...command, shopId: "999" }, { ...command, subject: "private" }, { operation: "reviews.search", search, limit: 25, offset: 0 },
    { ...command, search: { ...search, rating: 6 } }, { ...command, search: { ...search, rating: 4.5 } }, { ...command, search: { ...search, source: "shopify" } },
    { ...command, search: { ...search, sort: "random" } }, { ...command, search: { ...search, query: " padded " } },
    { ...command, search: { ...search, query: "r".repeat(201) } }, { ...command, search: { ...search, column: "body" } },
  ]) expect(reviewCommandSchema(bad), JSON.stringify(bad)).toBeNull();
  // The old cursor feed is gone; nothing may still send it.
  expect(reviewCommandSchema({ operation: "reviews.feed", limit: 20, cursor: null })).toBeNull();
});

test("search results reject private fields, duplicates and impossible totals", async () => {
  const [newer, older] = [review(2), review(1)];
  expect(reviewResultSchema("reviews.search", { data: { reviews: [older, newer], total: 2, offset: 0 } })).not.toBeNull();
  expect(reviewResultSchema("reviews.search", { data: { reviews: [], total: 0, offset: 0 } })).not.toBeNull();
  for (const data of [
    { reviews: [{ ...newer, customerEmail: "private@example.test" }], total: 1, offset: 0 }, { reviews: [newer, newer], total: 2, offset: 0 },
    { reviews: [newer], total: 0, offset: 0 }, { reviews: [newer], total: 5, offset: 5 }, { reviews: [], total: 3, offset: 0 },
    { reviews: [newer], total: 1, offset: -1 }, { reviews: [newer], total: 1 }, { reviews: [newer], nextCursor: null },
  ]) expect(reviewResultSchema("reviews.search", { data }), JSON.stringify(data)).toBeNull();
  for (const data of [null, { reviews: [{ ...newer, privateNote: "secret" }], total: 1, offset: 0 }, { reviews: Array.from({ length: 26 }, (_, i) => review(i + 1)), total: 30, offset: 0 }]) {
    const database = fakeSupabase(async () => Response.json(data));
    await expect(createReviewBackend({ database, shopId: "123456" })(command)).rejects.toThrow(ReviewBackendError);
  }
});

test("feed pages ask for the reader's view and link existing products to their page, keeping stored titles for missing ones", async () => {
  const commands: ReviewCommand[] = [];
  const read = (async (sent: ReviewCommand) => { commands.push(sent); return { reviews: [review(2), review(1, "200")], total: 52, offset: 50 }; }) as ReviewBackend;
  const page = await getReviewFeedPage({ backend: read, products, view: { ...DEFAULT_REVIEW_VIEW, page: 3, rating: "5", origin: "etsy", sort: "oldest", query: "mug" } });
  expect(commands).toEqual([{ ...command, search: { rating: 5, source: "etsy", sort: "oldest", query: "mug" }, offset: 50 }]);
  expect(page?.items.map((item) => item.product)).toMatchObject([
    { title: "Name Tag Shirt", href: "/products/name-tag-shirt" }, { title: "Old shirt title", href: null },
  ]);
  expect(page).toMatchObject({ total: 52, offset: 50 });
});

test("unavailable and invalid feed reads report a failure instead of an empty shop", async () => {
  for (const backend of [null, (async () => { throw Error("Database down"); }) as ReviewBackend, (async () => ({ reviews: [{ ...review(1), privateNote: "x" }], total: 1, offset: 0 })) as ReviewBackend]) {
    expect(await getReviewFeedPage({ backend, products })).toBeNull();
  }
  expect(await getReviewFeedPage({ backend: (async () => ({ reviews: [], total: 0, offset: 0 })) as ReviewBackend, products })).toEqual({ items: [], total: 0, offset: 0 });
});

test("the feed route reads only the fixed view parameters and never reads storage otherwise", async () => {
  const untouched = (async () => { throw Error("Must not read"); }) as ReviewBackend;
  for (const query of ["?cursor=abc", "?page=0", "?page=two", "?page=1&page=2", "?pageSize=20", "?rating=4.5", "?source=shopify",
    "?sort=random", "?q=%20padded", "?productId=100", "?limit=500", `?review=${review(1).id}`]) {
    const response = await handleReviewFeedPage(new Request(`https://store.test/api/reviews/feed${query}`), { backend: untouched, products });
    expect(response.status, query).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
  }
  const commands: ReviewCommand[] = [];
  const ok = await handleReviewFeedPage(new Request("https://store.test/api/reviews/feed?page=2&pageSize=10&rating=1&source=unmatched&sort=highest&q=fits"), {
    backend: (async (sent: ReviewCommand) => { commands.push(sent); return { reviews: [review(1)], total: 11, offset: 10 }; }) as ReviewBackend, products,
  });
  expect(ok.status).toBe(200);
  expect(commands).toEqual([{ ...command, search: { rating: 1, source: "unmatched", sort: "highest", query: "fits" }, limit: 10, offset: 10 }]);
  expect(await ok.json()).toMatchObject({ total: 11, offset: 10, items: [{ review: { id: review(1).id } }] });
  expect((await handleReviewFeedPage(new Request("https://store.test/api/reviews/feed"), { backend: null })).status).toBe(503);
});
