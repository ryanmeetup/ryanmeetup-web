import { expect, test } from "@playwright/test";
import { POST } from "../app/api/reviews/route";

const originalFetch = globalThis.fetch;
const keys = ["REVIEWS_PROVIDER", "SHOPIFY_STORE_DOMAIN", "JUDGEME_SHOP_DOMAIN", "JUDGEME_PRIVATE_API_TOKEN", "REVIEWS_PREVIEW_ENABLED", "VERCEL"] as const;
const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
let providerRequests: string[];

const validReview = { name: "Ryan", email: "ryan@example.com", productId: "gid://shopify/Product/123", rating: 5, body: "Holding up great." };

test.beforeEach(() => {
  process.env.REVIEWS_PROVIDER = "judgeme";
  process.env.SHOPIFY_STORE_DOMAIN = "catalog.test";
  process.env.JUDGEME_SHOP_DOMAIN = "registered-reviews.test";
  process.env.JUDGEME_PRIVATE_API_TOKEN = "synthetic-private-token";
  providerRequests = [];
  globalThis.fetch = async (input) => {
    providerRequests.push(String(input));
    throw new Error("Retired submissions must never reach a provider.");
  };
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of keys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function request(body: unknown = validReview, headers: Record<string, string> = {}, url = "https://store.test/api/reviews") {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://store.test", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function expectRetired(input: Request) {
  const response = await POST(input);
  expect(response.status).toBe(410);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ error: "Please open your customer account to leave a review." });
  expect(input.bodyUsed).toBe(false);
  expect(providerRequests).toEqual([]);
}

test("the default and explicit Judge.me modes refuse anonymous submissions even with working credentials", async () => {
  for (const provider of [undefined, "", "  ", "judgeme"]) {
    if (provider === undefined) delete process.env.REVIEWS_PROVIDER;
    else process.env.REVIEWS_PROVIDER = provider;
    await expectRetired(request({ ...validReview, verified: true, api_token: "invented" }));
  }
});

test("browser-supplied provider fields and credentials cannot restore the retired relay", async () => {
  await expectRetired(request({ ...validReview, provider: "custom", shop_domain: "other.test", subject: "invented-buyer" }, {
    "X-Review-Provider": "custom", Cookie: "store-review-preview=custom", Authorization: "Bearer invented",
  }, "https://store.test/api/reviews?provider=custom"));
});

test("a local Judge.me override cannot reopen forwarding when the environment uses custom", async () => {
  delete process.env.VERCEL;
  process.env.REVIEWS_PREVIEW_ENABLED = "true";
  process.env.REVIEWS_PROVIDER = "custom";
  await expectRetired(request(validReview, { Origin: "http://localhost:3002", Cookie: "store-review-preview=judgeme" }, "http://localhost:3002/api/reviews"));
});

test("retired requests are closed before parsing bodies or contacting external storage", async () => {
  for (const body of ["{", null, [], true, { ...validReview, rating: 6 }]) await expectRetired(request(body));
  await expectRetired(request("--boundary", { "Content-Type": "multipart/form-data; boundary=boundary", Origin: "https://other.test" }));
});

test("missing or invalid configuration cannot restore anonymous forwarding", async () => {
  delete process.env.SHOPIFY_STORE_DOMAIN;
  delete process.env.JUDGEME_SHOP_DOMAIN;
  delete process.env.JUDGEME_PRIVATE_API_TOKEN;
  await expectRetired(request());
  process.env.REVIEWS_PROVIDER = "typo";
  expect((await POST(request())).status).toBe(503);
  expect(providerRequests).toEqual([]);
});
