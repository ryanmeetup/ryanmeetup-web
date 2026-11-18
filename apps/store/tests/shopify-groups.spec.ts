import { expect, test } from "@playwright/test";
import { getProductGallery } from "../lib/product-gallery";
import { getCollection, getCollections, getHomeCatalog, getProduct, getProductHandles, sortCollectionsBySales } from "../lib/shopify";
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

function mockCatalog(failDiscovery = false, spotlight: { handle: string }[] = []) {
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
    } else if (request.query.includes("BestSellingHandles")) {
      data = { products: { edges: [mom, tee, dad, ryan].map(({ handle }) => ({ node: { handle } })), pageInfo: { endCursor: null, hasNextPage: false } } };
    } else if (request.query.includes("CollectionMemberships")) {
      const collection = (id: string, title: string, products: { handle: string }[]) => ({ node: { id, handle: id, title, description: "", image: null, products: { edges: products.map(({ handle }) => ({ node: { handle } })) } } });
      const all = [collection("apparel", "Shopify Apparel", [tee]), collection("frontpage", "Home page", [tee, dad]), collection("shirts", "Shirts", [mom]), collection("empty", "Empty", []), ...(spotlight.length ? [collection("spotlight", "Fresh off the press", spotlight)] : [])];
      // Two pages, so a shop with more collections than one page still lists all of them.
      const page = request.variables.after ? all.slice(2) : all.slice(0, 2);
      data = { collections: { edges: page, pageInfo: { endCursor: "collections-page-1", hasNextPage: !request.variables.after } } };
    } else if (request.query.includes("CollectionHandles")) {
      data = { collections: { edges: [{ node: { handle: "shirts" } }, { node: { handle: "i-❤️-ry" } }], pageInfo: { endCursor: null, hasNextPage: false } } };
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
  expect(collection?.products.map((product) => product.handle)).toEqual([tee.handle, "name-tag-shirt"]);
  expect(collection?.products[1].designs).toHaveLength(3);
  const pages = requests.filter((request) => request.query.includes("query Collection("));
  expect(pages.map((request) => request.variables.after)).toEqual([null, "collection-page-1"]);
  expect(pages.every(({ query }) => query.includes("sortKey: BEST_SELLING"))).toBe(true);
  expect(await getCollection("missing")).toBeNull();
  expect(await getCollection("frontpage")).toBeNull();
});

test("the home page spotlights the newest listing, keeps popular picks in the favorites, and tiles every other collection", async () => {
  mockCatalog();
  const home = await getHomeCatalog();
  expect(home.spotlight).toMatchObject({ label: "New arrival", curated: false });
  expect(home.spotlight?.listing.handle).toBe("name-tag-shirt");
  expect(home.favorites.collection.title).toBe("Home page");
  expect(home.favorites.products.map((product) => product.handle)).toEqual([tee.handle, "name-tag-shirt"]);
  expect(home.collections.map(({ collection, image, total }) => [collection.title, image?.url, total])).toEqual([["Shirts", ryan.featuredImage!.url, 1]]);
});

test("a spotlight collection picks the featured drop and stays out of the collection tiles", async () => {
  mockCatalog(false, [tee]);
  const home = await getHomeCatalog();
  expect(home.spotlight).toMatchObject({ label: "Fresh off the press", curated: true });
  expect(home.spotlight?.listing.handle).toBe(tee.handle);
  expect(home.favorites.products.map((product) => product.handle)).toEqual([tee.handle, "name-tag-shirt"]);
  expect(home.collections.map(({ collection }) => collection.handle)).toEqual(["shirts"]);
});

test("without Shopify collections the home page tiles the type pages", async () => {
  delete process.env.SHOPIFY_STORE_DOMAIN;
  const home = await getHomeCatalog();
  expect(home.collections.map(({ collection }) => collection.handle)).toEqual(["apparel", "accessories", "ryd"]);
  expect(home.collections.every(({ image }) => image)).toBe(true);
  expect(home.favorites.products).toHaveLength(4);
});

test("shop all lists every product once and breaks it up into the home page's collection sections", async () => {
  mockCatalog();
  const all = await getCollection("all");
  expect(all?.products.map((product) => product.handle)).toEqual([tee.handle, "name-tag-shirt", "ryd"]);
  expect(all?.sections?.map(({ collection, products, total }) => [collection.title, products.map((product) => product.handle), total])).toEqual([["Shirts", ["name-tag-shirt"], 1]]);
  expect(all?.sections?.[0].products[0].designs).toHaveLength(3);
  expect(all?.more?.map((product) => product.handle)).toEqual([tee.handle, "ryd"]);
  expect((await getCollection("apparel"))?.sections?.every(({ grouping }) => grouping)).toBe(true);
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
  expect(apparel?.products.map((product) => product.handle)).toEqual([tee.handle, "name-tag-shirt"]);
  expect(apparel?.products[1].designs).toHaveLength(3);
  const typeRequests = requests.filter((request) => request.query.includes("CatalogCollectionProducts"));
  expect(typeRequests.map((request) => [request.variables.query, request.variables.after])).toEqual([['product_type:"Apparel"', null], ['product_type:"Apparel"', "type-page-1"]]);
  expect((await getCollection("accessories"))?.products.map(({ handle }) => handle)).toEqual(["ryd"]);
});

test("type pages split into garment groupings from each product's Shopify category", async () => {
  mockCatalog();
  const apparel = await getCollection("apparel");
  expect(apparel?.sections?.map(({ collection, products, grouping }) => [collection.handle, products.map(({ handle }) => handle), grouping])).toEqual([["t-shirts", [tee.handle, "name-tag-shirt"], true]]);
  expect(apparel?.more).toEqual([]);
  // RY-D has no Shopify category; the RY-Ds grouping places it by listing handle and leads Accessories.
  const accessories = await getCollection("accessories");
  expect(accessories?.sections?.map(({ collection, products, grouping }) => [collection.handle, products.map(({ handle }) => handle), grouping])).toEqual([["ryd", ["ryd"], true]]);
  expect(accessories?.more).toEqual([]);
});

test("the type pages lead the collection list, shadow same-handle Shopify collections, and omit the home page collection", async () => {
  const requests = mockCatalog();
  expect((await getCollections()).map((collection) => collection.title)).toEqual(["Collections", "Apparel", "Accessories", "RY-Ds", "Shirts", "Empty"]);
  expect(requests.filter((request) => request.query.includes("CollectionMemberships")).map((request) => request.variables.after)).toEqual([null, "collections-page-1"]);
});

test("a collection whose Shopify handle has a heart emoji is served at its heart URL", async () => {
  const requests = mockCatalog();
  const collection = await getCollection("i-heart-ry");
  expect(collection?.collection).toMatchObject({ handle: "i-heart-ry", title: "I ❤️ RY" });
  expect(collection?.products.map((product) => product.handle)).toEqual([tee.handle]);
  expect(requests.filter((request) => request.query.includes("query Collection(")).map((request) => request.variables.handle)).toEqual(["i-heart-ry", "i-❤️-ry"]);
  expect(await getCollection("i-heart-nothing")).toBeNull();
});

test("RY-Ds has a standalone collection with a working external order link in live and preview catalogs", async () => {
  for (const configured of [true, false]) {
    if (!configured) delete process.env.SHOPIFY_STORE_DOMAIN;
    const requests = mockCatalog();
    const page = await getCollection("ryd");
    expect(page?.collection.title).toBe("RY-Ds");
    expect(page?.products).toHaveLength(1);
    expect(page?.products[0]).toMatchObject({ handle: "ryd", externalUrl: "https://ryanmeetup.com/ryd" });
    expect(requests).toHaveLength(0);
  }
});

test("collections are ordered by their best-selling product rather than alphabetically", () => {
  const collection = (handle: string, products: string[]) => ({ handle, products: { edges: products.map((product) => ({ node: { handle: product } })) } });
  const sorted = sortCollectionsBySales([collection("flags", ["flag"]), collection("empty", []), collection("hats", ["cap", "beanie"]), collection("tees", ["tee"])], ["tee", "beanie", "flag"]);
  expect(sorted.map(({ handle }) => handle)).toEqual(["tees", "hats", "flags", "empty"]);
});
