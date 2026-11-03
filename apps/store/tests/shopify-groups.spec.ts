import { expect, test } from "@playwright/test";
import { getProductGallery } from "../lib/product-gallery";
import { getCollection, getCollections, getHomeCatalog, getProduct, getProductHandles } from "../lib/shopify";
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
      const products = [ryan, tee, mom, dad];
      const page = request.variables.after ? products.slice(2) : products.slice(0, 2);
      data = { products: { edges: page.map(({ handle, title, tags }) => ({ node: { handle, title, tags } })), pageInfo: { endCursor: "catalog-page-1", hasNextPage: !request.variables.after } } };
    } else if (request.query.includes("CatalogCollectionProducts")) {
      const catalog = [ryan, tee, mom, dad].filter((product) => !request.variables.query || request.variables.query === `product_type:${JSON.stringify(product.productType)}`);
      const page = request.variables.after ? catalog.slice(2) : catalog.slice(0, 2);
      data = { products: { edges: page.map((product) => ({ node: productNode(product) })), pageInfo: { endCursor: "type-page-1", hasNextPage: !request.variables.after && catalog.length > 2 } } };
    } else if (request.query.includes("query Collections")) {
      data = { collections: { edges: [{ node: { id: "shopify-apparel", handle: "apparel", title: "Shopify Apparel", description: "", image: null } }, { node: { id: "frontpage", handle: "frontpage", title: "Home page", description: "", image: null } }, { node: { id: "shirts", handle: "shirts", title: "Shirts", description: "", image: null } }] } };
    } else if (request.query.includes("CollectionMemberships")) {
      const collection = (id: string, title: string, products: { handle: string }[]) => ({ node: { id, handle: id, title, description: "", image: null, products: { edges: products.map(({ handle }) => ({ node: { handle } })) } } });
      data = { collections: { edges: [collection("apparel", "Shopify Apparel", [tee]), collection("frontpage", "Home page", [tee, dad]), collection("shirts", "Shirts", [mom]), collection("empty", "Empty", [])] } };
    } else if (request.query.includes("CollectionHandles")) {
      data = { collections: { edges: [{ node: { handle: "shirts" } }, { node: { handle: "i-❤️-ry" } }] } };
    } else if (request.query.includes("query Collection(") && request.variables.handle === "i-❤️-ry") {
      data = { collection: { id: "heart", handle: "i-❤️-ry", title: "I ❤️ RY", description: "", image: null, products: { edges: [{ node: productNode(tee) }], pageInfo: { endCursor: null, hasNextPage: false } } } };
    } else if (request.query.includes("query Collection(")) {
      const page = request.variables.after ? [tee] : [mom];
      data = { collection: request.variables.handle === "shirts" ? { id: "shirts", handle: "shirts", title: "Shirts", description: "", image: mom.featuredImage, products: { edges: page.map((product) => ({ node: productNode(product) })), pageInfo: { endCursor: "collection-page-1", hasNextPage: !request.variables.after } } } : null };
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
  const listing = await getProduct("name-tag-shirt");
  expect(listing?.designs?.map((design) => design.label)).toEqual(["Ryan", "Ryan’s Dad", "Ryan’s Mom"]);
  expect(listing?.variants.map((variant) => variant.id)).toEqual([...ryan.variants, ...dad.variants, ...mom.variants].map((variant) => variant.id));
  expect(getProductGallery(listing!, listing!.designs).map((entry) => entry.image.url)).toEqual([ryan.featuredImage!.url, dad.featuredImage!.url, mom.featuredImage!.url]);
  expect(requests.filter((request) => request.query.includes("CatalogProductSummaries")).map((request) => request.variables.after)).toEqual([null, "catalog-page-1"]);
});

test("collection pages load every page and include tagged designs outside the collection", async () => {
  const requests = mockCatalog();
  const collection = await getCollection("shirts");
  expect(collection?.collection.title).toBe("Shirts");
  expect(collection?.products.map((product) => product.handle)).toEqual(["name-tag-shirt", tee.handle]);
  expect(collection?.products[0].designs).toHaveLength(3);
  expect(requests.filter((request) => request.query.includes("query Collection(")).map((request) => request.variables.after)).toEqual([null, "collection-page-1"]);
  expect(await getCollection("missing")).toBeNull();
  expect(await getCollection("frontpage")).toBeNull();
});

test("the home page features the home page collection and gives every other collection a section", async () => {
  mockCatalog();
  const home = await getHomeCatalog();
  expect(home.featured.collection.title).toBe("Home page");
  expect(home.featured.products.map((product) => product.handle)).toEqual([tee.handle, "name-tag-shirt"]);
  expect(home.featured.products[1].designs).toHaveLength(3);
  expect(home.sections.map(({ collection, products, total }) => [collection.title, products.map((product) => product.handle), total])).toEqual([["Shirts", ["name-tag-shirt"], 1]]);
  expect(home.more.map((product) => product.handle)).toEqual([tee.handle]);
});

test("shop all lists every product once and breaks it up into the home page's collection sections", async () => {
  mockCatalog();
  const all = await getCollection("all");
  expect(all?.products.map((product) => product.handle)).toEqual(["name-tag-shirt", tee.handle]);
  expect(all?.sections?.map(({ collection, products, total }) => [collection.title, products.map((product) => product.handle), total])).toEqual([["Shirts", ["name-tag-shirt"], 1]]);
  expect(all?.sections?.[0].products[0].designs).toHaveLength(3);
  expect(all?.more?.map((product) => product.handle)).toEqual([tee.handle]);
  expect((await getCollection("apparel"))?.sections).toBeUndefined();
});

test("sitemap discovery includes every catalog page and lists the group once", async () => {
  mockCatalog();
  expect(await getProductHandles()).toEqual(["name-tag-shirt", tee.handle]);
});

test("catalog discovery failures propagate instead of returning only previously known designs", async () => {
  mockCatalog(true);
  await expect(getProduct("name-tag-shirt")).rejects.toThrow("Catalog unavailable");
});

test("type pages list every product of that Shopify type with each group once", async () => {
  const requests = mockCatalog();
  const apparel = await getCollection("apparel");
  expect(apparel?.collection.title).toBe("Apparel");
  expect(apparel?.products.map((product) => product.handle)).toEqual(["name-tag-shirt", tee.handle]);
  expect(apparel?.products[0].designs).toHaveLength(3);
  const typeRequests = requests.filter((request) => request.query.includes("CatalogCollectionProducts"));
  expect(typeRequests.map((request) => [request.variables.query, request.variables.after])).toEqual([['product_type:"Apparel"', null], ['product_type:"Apparel"', "type-page-1"]]);
  expect((await getCollection("accessories"))?.products).toEqual([]);
});

test("the type pages lead the collection list, shadow same-handle Shopify collections, and omit the home page collection", async () => {
  mockCatalog();
  expect((await getCollections()).map((collection) => collection.title)).toEqual(["All Ryan Goods", "Apparel", "Accessories", "Shirts"]);
});

test("a collection whose Shopify handle has a heart emoji is served at its heart URL", async () => {
  const requests = mockCatalog();
  const collection = await getCollection("i-heart-ry");
  expect(collection?.collection).toMatchObject({ handle: "i-heart-ry", title: "I ❤️ RY" });
  expect(collection?.products.map((product) => product.handle)).toEqual([tee.handle]);
  expect(requests.filter((request) => request.query.includes("query Collection(")).map((request) => request.variables.handle)).toEqual(["i-heart-ry", "i-❤️-ry"]);
  expect(await getCollection("i-heart-nothing")).toBeNull();
});
