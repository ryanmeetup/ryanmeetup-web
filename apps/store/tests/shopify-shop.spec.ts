import { expect, test } from "@playwright/test";
import { getCustomerAccountUrl, getPolicies } from "../lib/shopify";

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

test("policies come from Shopify in footer order and skip blank ones", async () => {
  process.env.SHOPIFY_STORE_DOMAIN = "catalog.test";
  process.env.SHOPIFY_STOREFRONT_API_TOKEN = "test-token";
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: {
      shop: {
        privacyPolicy: { handle: "privacy-policy", title: "Privacy Policy", body: "<p>Privacy.</p>" },
        refundPolicy: { handle: "refund-policy", title: "Refund Policy", body: "<p>No returns.</p>" },
        shippingPolicy: { handle: "shipping-policy", title: "Shipping Policy", body: "  " },
        termsOfService: null,
      },
    },
  }));

  expect((await getPolicies()).map((policy) => policy.handle)).toEqual(["refund-policy", "privacy-policy"]);
});

test("demo mode has no policies to show", async () => {
  delete process.env.SHOPIFY_STORE_DOMAIN;
  delete process.env.SHOPIFY_STOREFRONT_API_TOKEN;
  globalThis.fetch = async () => { throw new Error("Demo mode should not call Shopify."); };

  expect(await getPolicies()).toEqual([]);
});

test("the customer account link appears once Shopify reports one", async () => {
  process.env.SHOPIFY_STORE_DOMAIN = "catalog.test";
  process.env.SHOPIFY_STOREFRONT_API_TOKEN = "test-token";
  let customerAccountUrl: string | null = null;
  globalThis.fetch = async () => new Response(JSON.stringify({ data: { shop: { customerAccountUrl } } }));

  expect(await getCustomerAccountUrl()).toBeNull();
  customerAccountUrl = "https://shopify.com/1/account";
  expect(await getCustomerAccountUrl()).toBe("https://shopify.com/1/account");
});

test("demo mode has no customer account", async () => {
  delete process.env.SHOPIFY_STORE_DOMAIN;
  delete process.env.SHOPIFY_STOREFRONT_API_TOKEN;
  globalThis.fetch = async () => { throw new Error("Demo mode should not call Shopify."); };

  expect(await getCustomerAccountUrl()).toBeNull();
});
