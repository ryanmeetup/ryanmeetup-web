import { expect, test } from "@playwright/test";
import { getReviews } from "../lib/reviews";

const originalFetch = globalThis.fetch;
const originalToken = process.env.JUDGEME_PRIVATE_API_TOKEN;
const originalDomain = process.env.SHOPIFY_STORE_DOMAIN;
const originalJudgeMeDomain = process.env.JUDGEME_SHOP_DOMAIN;

const review = { id: 1, body: "Ryan merch in the wild.", created_at: "2026-11-05T12:00:00Z", rating: 4, reviewer: { name: "Ryan" }, hidden: false, curated: "ok" };

test.beforeEach(() => {
  process.env.JUDGEME_PRIVATE_API_TOKEN = "test-token";
  process.env.SHOPIFY_STORE_DOMAIN = "reviews.test";
  delete process.env.JUDGEME_SHOP_DOMAIN;
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.JUDGEME_PRIVATE_API_TOKEN;
  else process.env.JUDGEME_PRIVATE_API_TOKEN = originalToken;
  if (originalDomain === undefined) delete process.env.SHOPIFY_STORE_DOMAIN;
  else process.env.SHOPIFY_STORE_DOMAIN = originalDomain;
  if (originalJudgeMeDomain === undefined) delete process.env.JUDGEME_SHOP_DOMAIN;
  else process.env.JUDGEME_SHOP_DOMAIN = originalJudgeMeDomain;
});

function providerReviews(reviews: unknown[]) {
  let calls = 0;
  globalThis.fetch = async () => Response.json(++calls === 1 ? { product: { id: 42 } } : { reviews });
}

test("only published reviews and explicitly visible Judge.me photos reach the storefront", async () => {
  const visible = "https://judgeme.imgix.net/merch.jpg";
  const fallback = "https://pub-images.judge.me/another.jpg";
  providerReviews([
    { ...review, pictures: [
      { hidden: false, urls: { huge: visible } },
      { hidden: true, urls: { huge: "https://judgeme.imgix.net/private.jpg" } },
      { urls: { huge: "https://judgeme.imgix.net/unknown-status.jpg" } },
      { hidden: false, urls: { huge: "https://unknown.test/image.jpg" } },
      { hidden: false, urls: { huge: "javascript:alert(1)", original: fallback } },
      { hidden: false, urls: { huge: visible } },
    ] },
    { ...review, id: 2, hidden: true },
    { ...review, id: 3, curated: "spam" },
    { ...review, id: 4, curated: "pending" },
  ]);
  const data = await getReviews("gid://shopify/Product/123");
  expect(data.count).toBe(1);
  expect(data.reviews[0].photoUrls).toEqual([visible, fallback]);
});

test("whole-star reviews retain fractional averages and support reviews without photos", async () => {
  providerReviews([review, { ...review, id: 2, rating: 5 }]);
  const data = await getReviews("gid://shopify/Product/123");
  expect(data.averageRating).toBe(4.5);
  expect(data.reviews.map((item) => item.photoUrls)).toEqual([[], []]);
});
