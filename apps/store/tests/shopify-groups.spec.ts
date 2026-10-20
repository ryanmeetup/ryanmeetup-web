import { expect, test } from "@playwright/test";
import { getProductGallery } from "../lib/product-gallery";
import { getCollection, getFeaturedProducts, getProduct, getProductHandles } from "../lib/shopify";
import { dad, mom, productNode, ryan, tee } from "./fixtures/products";

const originalFetch = globalThis.fetch;
const originalDomain = process.env.SHOPIFY_STORE_DOMAIN;
const originalToken = process.env.SHOPIFY_STOREFRONT_API_TOKEN;

test.beforeEach(() => {
  process.env.SHOPIFY_STORE_DOMAIN = "catalog.test";
  process.env.SHOPIFY_STOREFRONT_API_TOKEN = "test-token";
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalDomain === undefined) delete process.env.SHOPIFY_STORE_DOMAIN;
  else process.env.SHOPIFY_STORE_DOMAIN = originalDomain;
  if (originalToken === undefined) delete process.env.SHOPIFY_STOREFRONT_API_TOKEN;
  else process.env.SHOPIFY_STOREFRONT_API_TOKEN = originalToken;
});

function mockCatalog(failDiscovery = false) {
  const requests: { query: string; variables: { handle?: string; query?: string | null; after?: string | null } }[] = [];
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body));
    requests.push(request);
    let data;
    if (request.query.includes("CatalogProductSummaries")) {
      if (failDiscovery) return new Response(JSON.stringify({ errors: [{ message: "Catalog unavailable" }] }));
      const products = request.variables.query ? [ryan, mom, dad] : [ryan, tee, mom, dad];
      if (request.variables.query) expect(request.variables.query).toBe('tag:"name tag"');
      const page = request.variables.after ? products.slice(2) : products.slice(0, 2);
      data = { products: { edges: page.map(({ handle, title, tags }) => ({ node: { handle, title, tags } })), pageInfo: { endCursor: "catalog-page-1", hasNextPage: !request.variables.after } } };
    } else if (request.query.includes("FeaturedProducts")) {
      data = { products: { edges: [{ node: productNode(mom) }] } };
    } else if (request.query.includes("query Collection(")) {
      data = { collection: { id: "shirts", handle: "shirts", title: "Shirts", description: "", image: mom.featuredImage, products: { edges: [{ node: productNode(mom) }], pageInfo: { startCursor: null, endCursor: null, hasNextPage: false, hasPreviousPage: false } } } };
    } else {
      const product = [ryan, mom, dad, tee].find((product) => product.handle === request.variables.handle);
      data = { product: product ? productNode(product) : null };
    }
    return new Response(JSON.stringify({ data }), { headers: { "Content-Type": "application/json" } });
  };
  return requests;
}

test("group discovery follows every tag search page and includes a third design's photos and merchandise", async () => {
  const requests = mockCatalog();
  const listing = await getProduct("nametag-shirt");
  expect(listing?.designs?.map((design) => design.label)).toEqual(["Ryan", "Ryan’s Dad", "Ryan’s Mom"]);
  expect(listing?.variants.map((variant) => variant.id)).toEqual([...ryan.variants, ...dad.variants, ...mom.variants].map((variant) => variant.id));
  expect(getProductGallery(listing!, listing!.designs).map((entry) => entry.image.url)).toEqual([ryan.featuredImage!.url, dad.featuredImage!.url, mom.featuredImage!.url]);
  expect(requests.filter((request) => request.query.includes("CatalogProductSummaries")).map((request) => request.variables.after)).toEqual([null, "catalog-page-1"]);
});

test("featured and collection listings include tagged designs outside their current result slice", async () => {
  mockCatalog();
  const featured = await getFeaturedProducts();
  const collection = await getCollection("shirts");
  expect(featured.map((product) => product.handle)).toEqual(["nametag-shirt"]);
  expect(featured[0].designs).toHaveLength(3);
  expect(collection?.products.map((product) => product.handle)).toEqual(["nametag-shirt"]);
  expect(collection?.products[0].designs).toHaveLength(3);
});

test("sitemap discovery includes every catalog page and lists the group once", async () => {
  mockCatalog();
  expect(await getProductHandles()).toEqual(["nametag-shirt", tee.handle]);
});

test("tag search failures propagate instead of returning only previously known designs", async () => {
  mockCatalog(true);
  await expect(getProduct("nametag-shirt")).rejects.toThrow("Catalog unavailable");
});

test("the old Mom handle fetches Shopify's corrected Dad product", async () => {
  const requests = mockCatalog();
  const product = await getProduct("ryans-mom-name-tag-shirt");
  expect(product?.handle).toBe(dad.handle);
  expect(product?.title).toBe(dad.title);
  expect(requests.map((request) => request.variables.handle)).toEqual([dad.handle]);
});
