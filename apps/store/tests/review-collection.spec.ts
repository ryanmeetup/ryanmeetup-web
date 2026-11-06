import { expect, test } from "@playwright/test";
import { getReviewAccount } from "../lib/review-collection";

const originalFetch = globalThis.fetch;
const originalDomain = process.env.SHOPIFY_STORE_DOMAIN;
const originalToken = process.env.SHOPIFY_STOREFRONT_API_TOKEN;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalDomain === undefined) delete process.env.SHOPIFY_STORE_DOMAIN;
  else process.env.SHOPIFY_STORE_DOMAIN = originalDomain;
  if (originalToken === undefined) delete process.env.SHOPIFY_STOREFRONT_API_TOKEN;
  else process.env.SHOPIFY_STOREFRONT_API_TOKEN = originalToken;
});

test("collection uses Shopify's account URL and its hosted account fallback", async () => {
  process.env.SHOPIFY_STORE_DOMAIN = "catalog.test";
  process.env.SHOPIFY_STOREFRONT_API_TOKEN = "test-token";
  let customerAccountUrl: string | null = "https://account.example.com";
  globalThis.fetch = async () => Response.json({ data: { shop: { id: "gid://shopify/Shop/71870054511", customerAccountUrl } } });
  expect(await getReviewAccount()).toEqual({ url: "https://account.example.com" });
  customerAccountUrl = null;
  expect(await getReviewAccount()).toEqual({ url: "https://shopify.com/71870054511/account" });
});

test("an unconfigured demo keeps review collection in preview mode without calling Shopify", async () => {
  delete process.env.SHOPIFY_STORE_DOMAIN;
  delete process.env.SHOPIFY_STOREFRONT_API_TOKEN;
  globalThis.fetch = async () => { throw new Error("Demo mode must not call Shopify."); };
  expect(await getReviewAccount()).toBeUndefined();
});

test("a Shopify outage keeps configured collection unavailable instead of reopening the preview form", async () => {
  process.env.SHOPIFY_STORE_DOMAIN = "catalog.test";
  process.env.SHOPIFY_STOREFRONT_API_TOKEN = "test-token";
  globalThis.fetch = async () => { throw new Error("Shopify unavailable"); };
  const originalError = console.error;
  const errors: unknown[][] = [];
  console.error = (...args: unknown[]) => { errors.push(args); };
  try {
    expect(await getReviewAccount()).toEqual({ url: null });
    expect(errors).toHaveLength(1);
  } finally {
    console.error = originalError;
  }
});
