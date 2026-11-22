import { expect, test } from "@playwright/test";
import { splitPolicyLastUpdated } from "../lib/policies";
import { cleanEditorHtml, dropPlaceholderAltText, getCustomerAccountUrl, getPolicies, getProductSitemapEntries } from "../lib/shopify";

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

test("the customer account link prefers Shopify's URL and falls back to the shop's account address", async () => {
  process.env.SHOPIFY_STORE_DOMAIN = "catalog.test";
  process.env.SHOPIFY_STOREFRONT_API_TOKEN = "test-token";
  let customerAccountUrl: string | null = null;
  globalThis.fetch = async () => new Response(JSON.stringify({ data: { shop: { id: "gid://shopify/Shop/71870054511", customerAccountUrl } } }));

  expect(await getCustomerAccountUrl()).toBe("https://shopify.com/71870054511/account");
  customerAccountUrl = "https://account.example.com";
  expect(await getCustomerAccountUrl()).toBe("https://account.example.com");
});

test("demo mode has no customer account", async () => {
  delete process.env.SHOPIFY_STORE_DOMAIN;
  delete process.env.SHOPIFY_STOREFRONT_API_TOKEN;
  globalThis.fetch = async () => { throw new Error("Demo mode should not call Shopify."); };

  expect(await getCustomerAccountUrl()).toBeNull();
});

test("Printful's placeholder alt text is dropped so images fall back to the product title", () => {
  const payload = JSON.parse(JSON.stringify({
    product: { title: "Product mockup", featuredImage: { altText: "Product mockup" }, images: [{ altText: " product MOCKUP " }, { altText: "Back of the Name Tag Shirt" }, { altText: null }] },
  }), dropPlaceholderAltText);
  expect(payload.product.title).toBe("Product mockup");
  expect(payload.product.featuredImage.altText).toBeNull();
  expect(payload.product.images.map((image: { altText: string | null }) => image.altText)).toEqual([null, "Back of the Name Tag Shirt", null]);
});

test("editor HTML loses pasted meta tags and the empty paragraphs they leave", () => {
  expect(cleanEditorHtml('<p><meta charset="utf-8"></p>\n<p>Last updated: November 21, 2026</p>\n<p><meta charset="utf-8"><meta charset="utf-8">Every order ships.</p><p>&nbsp;</p>'))
    .toBe("<p>Last updated: November 21, 2026</p>\n<p>Every order ships.</p>");
});

test("policy bodies arrive cleaned, so the last-updated line is found", async () => {
  process.env.SHOPIFY_STORE_DOMAIN = "catalog.test";
  process.env.SHOPIFY_STOREFRONT_API_TOKEN = "test-token";
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: { shop: { privacyPolicy: null, refundPolicy: null, termsOfService: null, shippingPolicy: { handle: "shipping-policy", title: "Shipping Policy", body: '<p><meta charset="utf-8"></p><p>Last updated: November 21, 2026</p><p>Ships fast.</p>' } } },
  }));
  const [policy] = await getPolicies();
  expect(splitPolicyLastUpdated(policy.body)).toEqual({ lastUpdated: "November 21, 2026", body: "<p>Ships fast.</p>" });
});

test("sitemap entries give a grouped listing its newest member's update time", async () => {
  process.env.SHOPIFY_STORE_DOMAIN = "catalog.test";
  process.env.SHOPIFY_STOREFRONT_API_TOKEN = "test-token";
  const node = (handle: string, title: string, tags: string[], updatedAt: string) => ({ node: { handle, title, tags, updatedAt } });
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: { products: { pageInfo: { endCursor: null, hasNextPage: false }, edges: [
      node("super-ryan-shirt", "Super Ryan Shirt - Black", ["listing:Super Ryan Shirt"], "2026-11-02T00:00:00Z"),
      node("super-ryan-blue", "Super Ryan Shirt - Blue", ["listing:Super Ryan Shirt"], "2026-11-09T00:00:00Z"),
      node("super-ryan-red", "Super Ryan Shirt - Red", ["listing:Super Ryan Shirt"], "2026-11-05T00:00:00Z"),
      node("ryans-glossy-mug", "Ryan Name Tag Mug", [], "2026-11-14T00:00:00Z"),
    ] } },
  }));
  const entries = await getProductSitemapEntries();
  expect(entries).toHaveLength(2);
  expect(entries).toContainEqual({ handle: "ryans-glossy-mug", lastModified: "2026-11-14T00:00:00Z" });
  expect(entries.find((entry) => entry.handle !== "ryans-glossy-mug")?.lastModified).toBe("2026-11-09T00:00:00Z");
});
