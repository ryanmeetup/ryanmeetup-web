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

test("private authentication uses the documented header and keeps credentials out of request URLs", async () => {
  const requests: { url: URL; headers: Headers }[] = [];
  globalThis.fetch = async (input, options) => {
    requests.push({ url: new URL(String(input)), headers: new Headers(options?.headers) });
    return Response.json(requests.length === 1 ? { product: { id: 42 } } : { reviews: [review] });
  };
  expect((await getReviews("gid://shopify/Product/123")).count).toBe(1);
  expect(requests).toHaveLength(2);
  for (const request of requests) {
    expect(request.headers.get("X-Api-Token")).toBe("test-token");
    expect(request.url.searchParams.has("api_token")).toBe(false);
    expect(request.url.searchParams.get("shop_domain")).toBe("reviews.test");
  }
});

test("review reads use Judge.me's registered domain independently of the Shopify catalog", async () => {
  process.env.SHOPIFY_STORE_DOMAIN = "catalog.test";
  process.env.JUDGEME_SHOP_DOMAIN = "registered-reviews.test";
  const domains: (string | null)[] = [];
  globalThis.fetch = async (input) => {
    domains.push(new URL(String(input)).searchParams.get("shop_domain"));
    return Response.json(domains.length === 1 ? { product: { id: 42 } } : { reviews: [review] });
  };
  expect((await getReviews("gid://shopify/Product/123")).count).toBe(1);
  expect(domains).toEqual(["registered-reviews.test", "registered-reviews.test"]);
  expect(process.env.SHOPIFY_STORE_DOMAIN).toBe("catalog.test");
});
