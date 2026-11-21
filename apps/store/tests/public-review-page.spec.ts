import { expect, test } from "@playwright/test";
import type { PublicReview, PublicReviewPage, ReviewCommand } from "@ryanmeetup/reviews";
import { handlePublicReviewPage } from "../lib/public-review-page";
import {
  DEFAULT_REVIEW_VIEW, FEED_REVIEW_PARAMS, PRODUCT_REVIEW_PARAMS, parseReviewView, reviewViewSearch, toReviewsData, writeReviewView,
} from "../lib/public-review-view";
import type { ReviewBackend } from "../lib/review-backend";

const review: PublicReview = {
  id: "00000000-0000-4000-8000-000000000001", rating: 4, title: "Ryan approved", body: "Still looking good.", displayName: "Ryan F.",
  publishedAt: "2026-11-18T12:00:00.000Z", editedAt: null, item: { productId: "100", productTitle: "Shirt", variantTitle: null },
  verifiedPurchase: true, source: "store", photos: [], reply: null,
};
const searchPage = { reviews: [review], total: 30, offset: 25 };
const request = (query = "productId=100&page=2") => new Request(`https://store.test/api/reviews/page?${query}`);
const search = { rating: null, source: null, sort: "newest", query: "" };

function setup(value: unknown = searchPage, failure = false) {
  const commands: ReviewCommand[] = [];
  const backend = (async (command: ReviewCommand) => {
    commands.push(command);
    if (failure) throw new Error("Private database detail");
    return value;
  }) as ReviewBackend;
  return { commands, backend };
}

test("anonymous page reads use one fixed product, a bounded page and the public allowlist", async () => {
  const { backend, commands } = setup();
  const response = await handlePublicReviewPage(request(), { backend });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual(searchPage);
  expect(commands).toEqual([{ operation: "reviews.search", productIds: ["100"], search, limit: 25, offset: 25, focusReviewId: null }]);
});

test("filters, page size and a permalink reach storage as fixed values", async () => {
  const { backend, commands } = setup({ reviews: [], total: 0, offset: 0 });
  const query = `productId=100&pageSize=50&rating=4&source=verified&sort=lowest&q=still&review=${review.id}`;
  expect(await (await handlePublicReviewPage(request(query), { backend })).json()).toEqual({ reviews: [], total: 0, offset: 0 });
  expect(commands).toEqual([{ operation: "reviews.search", productIds: ["100"], limit: 50, offset: 0, focusReviewId: review.id,
    search: { rating: 4, source: "verified", sort: "lowest", query: "still" } }]);
});

test("unknown, duplicate, malformed and caller-selected scope/limit parameters never reach storage", async () => {
  const { backend, commands } = setup();
  for (const query of ["", "productId=", "productId=0", "productId=gid://shopify/Product/100", "productId=1&productId=2", "productId=100&cursor=abc",
    "productId=100&page=0", "productId=100&page=1&page=2", "productId=100&pageSize=500", "productId=100&limit=500", "productId=100&rating=6",
    "productId=100&source=everywhere", "productId=100&sort=random", "productId=100&review=nope", "productId=100&shopId=2", "productId=100&subject=buyer"]) {
    expect((await handlePublicReviewPage(request(query), { backend })).status, query).toBe(400);
  }
  expect(commands).toEqual([]);
});

test("unconfigured storage cannot serve pages", async () => {
  const { commands } = setup();
  expect((await handlePublicReviewPage(request(), { backend: null })).status).toBe(503);
  expect(commands).toEqual([]);
});

test("private reply fields, another product's review and oversized pages are never returned", async () => {
  for (const value of [
    { ...searchPage, reviews: [{ ...review, reply: { body: "Public reply", publishedAt: review.publishedAt, author: "private-staff-id" } }] },
    { ...searchPage, reviews: [{ ...review, item: { ...review.item, productId: "200" } }] },
    { ...searchPage, total: 60, reviews: Array.from({ length: 26 }, (_, i) => ({ ...review, id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}` })) },
  ]) {
    const response = await handlePublicReviewPage(request(), { backend: setup(value).backend });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private-staff-id");
  }
  const response = await handlePublicReviewPage(request(), { backend: setup(null, true).backend });
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("Private database detail");
});

test("browser URLs fall back to the first, unfiltered page instead of failing", () => {
  const read = (query: string, names = FEED_REVIEW_PARAMS) => parseReviewView(new URLSearchParams(query), names);
  expect(read("")).toEqual(DEFAULT_REVIEW_VIEW);
  expect(read("page=nope&pageSize=7&rating=4.5&source=shopify&sort=random")).toEqual(DEFAULT_REVIEW_VIEW);
  expect(read("page=3&pageSize=10&rating=5&source=etsy&sort=oldest&q=%20coaster%20")).toEqual({
    page: 3, pageSize: 10, rating: "5", origin: "etsy", sort: "oldest", query: "coaster",
  });
  // A hostile page number stays inside what storage serves.
  expect(read("page=99999999&pageSize=50").page).toBe(2001);
  // Product pages keep their own names, so a product's `sort` or `page` never collides.
  expect(read("page=4&reviewPage=2&reviewRating=1", PRODUCT_REVIEW_PARAMS)).toMatchObject({ page: 2, rating: "1" });
});

test("views write only what differs from the default and convert to storage search", () => {
  const view = { ...DEFAULT_REVIEW_VIEW, page: 2, origin: "unmatched" };
  expect(writeReviewView(new URLSearchParams("color=red&page=9&sort=oldest"), view, FEED_REVIEW_PARAMS).toString()).toBe("color=red&page=2&source=unmatched");
  expect(reviewViewSearch(view)).toEqual({ rating: null, source: "unmatched", sort: "newest", query: "" });
  expect(reviewViewSearch({ ...view, rating: "3" }).rating).toBe(3);
});

test("product review data keeps the product id and complete total", () => {
  const page: PublicReviewPage = {
    scope: { productIds: ["100"] }, summary: { count: 25, average: 4, distribution: { 1: 0, 2: 0, 3: 0, 4: 25, 5: 0 } }, reviews: [review], nextCursor: null,
  };
  expect(toReviewsData(page)).toMatchObject({ count: 25, averageRating: 4, productId: "100" });
});
