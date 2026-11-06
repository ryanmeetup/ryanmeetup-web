import { expect, test } from "@playwright/test";
import { POST } from "../app/api/reviews/route";

const originalFetch = globalThis.fetch;
const originalDomain = process.env.SHOPIFY_STORE_DOMAIN;
const originalJudgeMeDomain = process.env.JUDGEME_SHOP_DOMAIN;
let providerRequests: { url: string; body: Record<string, unknown> }[] = [];
let providerStatus = 200;

const validReview = { name: "Ryan", email: "ryan@example.com", productId: "gid://shopify/Product/123", rating: 5, body: "Holding up great." };

test.beforeEach(() => {
  providerRequests = [];
  providerStatus = 200;
  process.env.SHOPIFY_STORE_DOMAIN = "reviews.test";
  delete process.env.JUDGEME_SHOP_DOMAIN;
  globalThis.fetch = async (input, init) => {
    providerRequests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return new Response("{}", { status: providerStatus });
  };
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalDomain === undefined) delete process.env.SHOPIFY_STORE_DOMAIN;
  else process.env.SHOPIFY_STORE_DOMAIN = originalDomain;
  if (originalJudgeMeDomain === undefined) delete process.env.JUDGEME_SHOP_DOMAIN;
  else process.env.JUDGEME_SHOP_DOMAIN = originalJudgeMeDomain;
});

function submit(body: unknown, contentType = "application/json") {
  return POST(new Request("https://store.test/api/reviews", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
}

test("a complete review is forwarded to Judge.me without an API token", async () => {
  const response = await submit({ ...validReview, verified: true, api_token: "invented" });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(providerRequests).toEqual([{
    url: "https://judge.me/api/v1/reviews",
    body: { shop_domain: "reviews.test", platform: "shopify", id: 123, name: "Ryan", email: "ryan@example.com", rating: 5, body: "Holding up great." },
  }]);
});

test("submission uses Judge.me's registered domain instead of the Shopify catalog domain", async () => {
  process.env.SHOPIFY_STORE_DOMAIN = "catalog.test";
  process.env.JUDGEME_SHOP_DOMAIN = "registered-reviews.test";
  expect((await submit(validReview)).status).toBe(200);
  expect(providerRequests[0].body.shop_domain).toBe("registered-reviews.test");
  expect(process.env.SHOPIFY_STORE_DOMAIN).toBe("catalog.test");
});

test("incomplete or out-of-range reviews are rejected before Judge.me", async () => {
  for (const review of [
    { ...validReview, body: " " },
    { ...validReview, rating: 4.5 },
    { ...validReview, rating: 6 },
    { ...validReview, productId: "gid://shopify/Product/demo-1" },
    { ...validReview, email: "not-an-email" },
  ]) {
    expect((await submit(review)).status).toBe(400);
  }
  expect((await submit("{")).status).toBe(400);
  for (const malformed of [null, [], true]) {
    expect((await submit(malformed)).status).toBe(400);
  }
  expect(providerRequests).toHaveLength(0);
});

test("photo uploads are refused until photos have a host", async () => {
  const response = await submit("--boundary", "multipart/form-data; boundary=boundary");
  expect(response.status).toBe(415);
  expect(providerRequests).toHaveLength(0);
});

test("a Judge.me rejection is reported as a retryable failure", async () => {
  providerStatus = 422;
  const response = await submit(validReview);
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ error: "Judge.me could not accept that review. Please try again." });
});

test("missing shop configuration closes submissions", async () => {
  delete process.env.SHOPIFY_STORE_DOMAIN;
  expect((await submit(validReview)).status).toBe(503);
  expect(providerRequests).toHaveLength(0);
});
