import { expect, test } from "@playwright/test";
import { demoProducts } from "../lib/demo-data";
import { groupProductListings } from "../lib/product-groups";
import { getRelatedBrowseLink, pickRelatedListings } from "../lib/related-listings";
import { getRelatedListings } from "../lib/shopify";
import type { ProductListing } from "../lib/types";

type Options = { handle?: string; productType?: string; availableForSale?: boolean; externalUrl?: string; members?: string[] };

function listing(id: string, { handle = id, productType = "Apparel", availableForSale = true, externalUrl, members }: Options = {}) {
  const designs = members?.map((member) => ({ label: member, value: member, product: { handle: member } }));
  return { id, handle, productType, availableForSale, externalUrl, designs } as unknown as ProductListing;
}
const ids = (items: ProductListing[]) => items.map((item) => item.id);

test("Shopify's picks lead, then shared collections, then the same product type", () => {
  const current = listing("tee");
  const catalog = [current, listing("hoodie"), listing("cap", { productType: "Accessory" }), listing("tote", { productType: "Accessory" }), listing("mug", { productType: "Accessory" }), listing("sweatshirt")];
  expect(ids(pickRelatedListings(current, catalog, {
    recommended: ["tote"],
    collections: [["tee", "cap"], ["mug", "hoodie"]],
  }))).toEqual(["tote", "cap", "hoodie", "sweatshirt"]);
});

test("a grouped listing collapses its recommended designs and never recommends itself", () => {
  const current = listing("group:name-tag-shirt", { handle: "name-tag-shirt", members: ["ryan-name-tag-shirt", "ryans-mom-name-tag-shirt"] });
  const superShirt = listing("group:super-ryan-shirt", { handle: "super-ryan-shirt", members: ["super-black", "super-royal"] });
  const catalog = [current, superShirt, listing("tee")];
  // Shopify mostly recommends a member's own siblings, then other products by member handle.
  const recommended = ["ryans-mom-name-tag-shirt", "super-royal", "super-black", "tee"];
  expect(ids(pickRelatedListings(current, catalog, { recommended }))).toEqual(["group:super-ryan-shirt", "tee"]);
});

test("only purchasable store listings are offered, up to the limit", () => {
  const current = listing("tee");
  const catalog = [current, listing("sold-out", { availableForSale: false }), listing("ryd", { externalUrl: "https://ryanmeetup.com/cards" }), listing("a"), listing("b"), listing("c")];
  expect(ids(pickRelatedListings(current, catalog, { recommended: ["sold-out", "ryd"], limit: 2 }))).toEqual(["a", "b"]);
});

test("nothing related leaves the row empty for its fallback", () => {
  const current = listing("flag", { productType: "Flag" });
  expect(pickRelatedListings(current, [current, listing("tee")])).toEqual([]);
});

test("the browse link names the product type only when every card shares it", () => {
  const pins = listing("pins", { productType: "Accessory" });
  expect(getRelatedBrowseLink(pins, [listing("tote", { productType: "Accessory" })])).toEqual({ href: "/accessories", label: "Browse all accessories" });
  expect(getRelatedBrowseLink(pins, [listing("tote", { productType: "Accessory" }), listing("shirt")])).toEqual({ href: "/collections/all", label: "Shop all merch" });
  expect(getRelatedBrowseLink(pins, [])).toEqual({ href: "/collections/all", label: "Shop all merch" });
});

test.describe("from Shopify", () => {
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

  test("the demo catalog offers same-type listings", async () => {
    delete process.env.SHOPIFY_STORE_DOMAIN;
    delete process.env.SHOPIFY_STOREFRONT_API_TOKEN;
    const [tee] = groupProductListings(demoProducts.filter((product) => product.handle === "ryan-meetup-tee"));
    const related = await getRelatedListings(tee);
    expect(related.length).toBeGreaterThan(0);
    expect(related.every((item) => item.productType === "Apparel" && item.id !== tee.id)).toBe(true);
  });

  test("a failed recommendation request still fills the row from the catalog", async () => {
    process.env.SHOPIFY_STORE_DOMAIN = "related.test";
    process.env.SHOPIFY_STOREFRONT_API_TOKEN = "test-token";
    const tee = demoProducts.find((product) => product.handle === "ryan-meetup-tee")!;
    const cap = demoProducts.find((product) => product.handle === "ryan-society-cap")!;
    const tote = demoProducts.find((product) => product.handle === "certified-ryan-tote")!;
    const node = (product: typeof tee) => ({ ...product, images: { edges: [], pageInfo: { endCursor: null, hasNextPage: false } }, variants: { edges: product.variants.map((variant) => ({ node: variant })), pageInfo: { endCursor: null, hasNextPage: false } } });
    const queries: string[] = [];
    globalThis.fetch = async (_input, init) => {
      const { query } = JSON.parse(String(init?.body)) as { query: string };
      queries.push(query);
      if (query.includes("RelatedProducts")) return new Response(JSON.stringify({ errors: [{ message: "Recommendations unavailable" }] }));
      const empty = { endCursor: null, hasNextPage: false };
      const data = query.includes("CatalogCollectionProducts")
        ? { products: { edges: [tee, cap, tote].map((product) => ({ node: node(product) })), pageInfo: empty } }
        : query.includes("BestSellingHandles")
          ? { products: { edges: [], pageInfo: empty } }
          : { collections: { edges: [{ node: { id: "gear", handle: "gear", title: "Gear", description: "", image: null, products: { edges: [{ node: { handle: tee.handle } }, { node: { handle: tote.handle } }] } } }], pageInfo: empty } };
      return new Response(JSON.stringify({ data }), { headers: { "Content-Type": "application/json" } });
    };
    expect((await getRelatedListings(tee)).map((item) => item.handle)).toEqual([tote.handle]);
    expect(queries.some((query) => query.includes("productRecommendations(productHandle: $handle, intent: RELATED)"))).toBe(true);
  });
});
