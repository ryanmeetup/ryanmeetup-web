import { expect, test } from "@playwright/test";
import { encodeReviewCursor } from "@ryanmeetup/reviews";
import type { PublicReview, PublicReviewPage, ReviewCommand } from "@ryanmeetup/reviews";
import { handlePublicReviewPage } from "../lib/public-review-page";
import { appendPublicReviews, productReviewPage, selectPublicReviews, toReviewsData } from "../lib/public-review-view";
import type { ReviewBackend } from "../lib/review-backend";

const review: PublicReview = {
  id: "00000000-0000-4000-8000-000000000001", rating: 4, title: "Ryan approved", body: "Still looking good.", displayName: "Ryan F.",
  publishedAt: "2026-11-18T12:00:00.000Z", editedAt: null, item: { productId: "100", productTitle: "Shirt", variantTitle: null },
  verifiedPurchase: true, source: "store", photos: [], reply: null,
};
const nextCursor = encodeReviewCursor({ id: review.id, publishedAt: review.publishedAt });
const after = encodeReviewCursor({ id: review.id, publishedAt: "2026-11-20T12:00:00.000Z" });
const page: PublicReviewPage = {
  scope: { productIds: ["100"] }, summary: { count: 25, average: 4, distribution: { 1: 0, 2: 0, 3: 0, 4: 25, 5: 0 } },
  reviews: [review], nextCursor,
};
const request = (query = `productId=100&cursor=${after}`) => new Request(`https://store.test/api/reviews/page?${query}`);

function setup(value: unknown = page, failure = false) {
  const commands: ReviewCommand[] = [];
  const backend = (async (command: ReviewCommand) => {
    commands.push(command);
    if (failure) throw new Error("Private database detail");
    return value;
  }) as ReviewBackend;
  return { commands, backend };
}

test("anonymous page reads use one fixed product, a bounded limit and the public allowlist", async () => {
  const { backend, commands } = setup();
  const response = await handlePublicReviewPage(request(), { backend });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual(page);
  expect(commands).toEqual([{ operation: "reviews.page", productIds: ["100"], limit: 20, cursor: after }]);
});

test("an omitted cursor reads the first page, including a genuinely empty product", async () => {
  const empty = { ...page, summary: { count: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }, reviews: [], nextCursor: null };
  const { backend, commands } = setup(empty);
  expect(await (await handlePublicReviewPage(request("productId=100"), { backend })).json()).toEqual(empty);
  expect(commands[0]).toMatchObject({ cursor: null });
});

test("unknown, duplicate, malformed and caller-selected scope/limit parameters never reach storage", async () => {
  const { backend, commands } = setup();
  for (const query of ["", "productId=", "productId=0", "productId=gid://shopify/Product/100", "productId=1&productId=2", "productId=100&cursor=",
    "productId=100&cursor=invalid", `productId=100&cursor=${after}&cursor=${after}`, "productId=100&limit=500", "productId=100&shopId=2", "productId=100&subject=buyer"]) {
    expect((await handlePublicReviewPage(request(query), { backend })).status).toBe(400);
  }
  expect(commands).toEqual([]);
});

test("unconfigured storage cannot continue pages", async () => {
  const { commands } = setup();
  expect((await handlePublicReviewPage(request(), { backend: null })).status).toBe(503);
  expect(commands).toEqual([]);
});

test("private reply fields, a different product and oversized pages are never returned", async () => {
  for (const value of [
    { ...page, reviews: [{ ...review, reply: { body: "Public reply", publishedAt: review.publishedAt, author: "private-staff-id" } }] },
    { ...page, scope: { productIds: ["200"] }, reviews: [{ ...review, item: { ...review.item, productId: "200" } }] },
    { ...page, reviews: Array.from({ length: 21 }, (_, i) => ({ ...review, id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}` })) },
  ]) {
    const response = await handlePublicReviewPage(request(), { backend: setup(value).backend });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private-staff-id");
  }
});

test("stalled, invalid or mismatched next cursors fail without exposing storage errors", async () => {
  for (const value of [{ ...page, nextCursor: after }, { ...page, nextCursor: "invalid" }, { ...page, nextCursor: encodeReviewCursor({ id: review.id, publishedAt: "2026-11-19T12:00:00.000Z" }) }]) {
    expect(productReviewPage(value, "100", after)).toBeNull();
    expect((await handlePublicReviewPage(request(), { backend: setup(value).backend })).status).toBe(503);
  }
  const response = await handlePublicReviewPage(request(), { backend: setup(null, true).backend });
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("Private database detail");
});

test("custom view pagination retains the product/cursor without changing complete totals", () => {
  expect(toReviewsData(page)).toMatchObject({ count: 25, averageRating: 4, pagination: { productId: "100", nextCursor } });
  expect(toReviewsData({ ...page, nextCursor: null })).not.toHaveProperty("pagination");
});

test("overlapping pages update existing rows in place without duplicate cards or mutations", () => {
  const first = toReviewsData(page).reviews[0];
  const updated = { ...first, reply: { body: "A new public reply", publishedAt: review.publishedAt } };
  const second = { ...first, id: "00000000-0000-4000-8000-000000000002" };
  expect(appendPublicReviews([first], [updated, second])).toEqual([updated, second]);
  expect(first.reply).toBeUndefined();
});

test("rating filters and all sort orders use stable ties without mutating the source", () => {
  const base = toReviewsData(page).reviews[0];
  const reviews = [
    { ...base, id: "a", rating: 5, createdAt: "2026-11-17T12:00:00.000Z" },
    { ...base, id: "b", rating: 1, createdAt: "2026-11-18T12:00:00.000Z" },
    { ...base, id: "c", rating: 5, createdAt: "2026-11-19T12:00:00.000Z" },
    { ...base, id: "d", rating: 5, createdAt: "2026-11-19T12:00:00.000Z" },
  ];
  const ids = (rating: string, sort: string) => selectPublicReviews(reviews, rating, sort).map((row) => row.id);
  expect(ids("all", "newest")).toEqual(["d", "c", "b", "a"]);
  expect(ids("all", "oldest")).toEqual(["a", "b", "c", "d"]);
  expect(ids("all", "highest")).toEqual(["d", "c", "a", "b"]);
  expect(ids("all", "lowest")).toEqual(["b", "d", "c", "a"]);
  expect(ids("5", "newest")).toEqual(["d", "c", "a"]);
  expect(ids("1", "highest")).toEqual(["b"]);
  expect(ids("3", "newest")).toEqual([]);
  expect(reviews.map((row) => row.id)).toEqual(["a", "b", "c", "d"]);
});

test("the source filter matches each badge and combines with the rating", () => {
  const base = toReviewsData(page).reviews[0];
  const reviews = [
    { ...base, id: "store", rating: 5, verification: "purchase" as const, createdAt: "2026-11-19T12:00:00.000Z" },
    { ...base, id: "etsy", rating: 5, verification: "etsy" as const, createdAt: "2026-11-18T12:00:00.000Z" },
    { ...base, id: "unmatched", rating: 1, verification: null, createdAt: "2026-11-17T12:00:00.000Z" },
  ];
  const ids = (origin: string, rating = "all") => selectPublicReviews(reviews, rating, "newest", origin).map((row) => row.id);
  expect(ids("all")).toEqual(["store", "etsy", "unmatched"]);
  expect(ids("verified")).toEqual(["store"]);
  expect(ids("etsy")).toEqual(["etsy"]);
  expect(ids("unmatched")).toEqual(["unmatched"]);
  expect(ids("etsy", "1")).toEqual([]);
});
