import { expect, test } from "@playwright/test";
import { POST } from "../app/api/reviews/route";
import { getReviewAccount } from "../lib/review-collection";
import { getReviewProvider } from "../lib/review-provider";
import { getReviews } from "../lib/reviews";

const originalFetch = globalThis.fetch;
const keys = ["REVIEWS_PROVIDER", "JUDGEME_SHOP_DOMAIN", "JUDGEME_PRIVATE_API_TOKEN", "SHOPIFY_STORE_DOMAIN", "SHOPIFY_STOREFRONT_API_TOKEN"] as const;
const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
let requests: string[];

test.beforeEach(() => {
  delete process.env.REVIEWS_PROVIDER;
  process.env.JUDGEME_SHOP_DOMAIN = "reviews.test";
  process.env.JUDGEME_PRIVATE_API_TOKEN = "test-token";
  process.env.SHOPIFY_STORE_DOMAIN = "catalog.test";
  process.env.SHOPIFY_STOREFRONT_API_TOKEN = "test-token";
  requests = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    return Response.json(url.includes("products/-1") ? { product: { id: 42 } } : {
      reviews: [{ id: 1, body: "Great gear.", rating: 5, created_at: "2026-11-05T12:00:00Z", hidden: false, curated: "ok" }],
    });
  };
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of keys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function submit() {
  return POST(new Request("https://store.test/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://store.test" },
    body: JSON.stringify({ productId: "gid://shopify/Product/123", rating: 5, body: "Great gear.", name: "Ryan", email: "ryan@example.com" }),
  }));
}

test("unset, blank, and explicit Judge.me configuration preserve existing reads", async () => {
  for (const value of [undefined, "", "  ", "judgeme"]) {
    if (value === undefined) delete process.env.REVIEWS_PROVIDER;
    else process.env.REVIEWS_PROVIDER = value;
    expect(getReviewProvider()).toBe("judgeme");
    expect(await getReviews("gid://shopify/Product/123")).toMatchObject({ status: "available", count: 1, averageRating: 5 });
  }
  expect(requests).toHaveLength(8);
});

for (const value of ["custom", "typo", "JudgeMe"]) {
  test(`${value} closes legacy reads and writes even with working Judge.me credentials`, async () => {
    process.env.REVIEWS_PROVIDER = value;
    expect(await getReviews("gid://shopify/Product/123")).toEqual({ status: "unavailable", count: 0, averageRating: 0, reviews: [] });
    expect(await getReviewAccount()).toEqual({ url: null });
    const response = await submit();
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Review collection is temporarily unavailable. Please try again later." });
    expect(requests).toEqual([]);

    // Missing Shopify credentials must never reopen the legacy demo composer.
    delete process.env.SHOPIFY_STORE_DOMAIN;
    delete process.env.SHOPIFY_STOREFRONT_API_TOKEN;
    expect(await getReviewAccount()).toEqual({ url: null });
  });
}

test("switching back restores Judge.me and browser input cannot select a write provider", async () => {
  process.env.REVIEWS_PROVIDER = "custom";
  expect((await submit()).status).toBe(503);
  process.env.REVIEWS_PROVIDER = "judgeme";
  expect((await submit()).status).toBe(200);
  expect((await getReviews("gid://shopify/Product/123")).count).toBe(1);
  requests = [];
  process.env.REVIEWS_PROVIDER = "custom";
  const response = await POST(new Request("https://store.test/api/reviews?provider=judgeme", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Review-Provider": "judgeme", Cookie: "reviews-provider=judgeme" },
    body: JSON.stringify({ provider: "judgeme" }),
  }));
  expect(response.status).toBe(503);
  expect(requests).toEqual([]);
});
