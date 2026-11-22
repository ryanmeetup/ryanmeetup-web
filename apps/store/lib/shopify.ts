import { catalogCollections, departments, getCatalogCollection, getCatalogCollectionSummary, getCatalogProductQuery, isInCatalogCollection } from "./catalog-collections";
import { demoCollections, demoProducts } from "./demo-data";
import { withExternalListings } from "./external-listings";
import { findGarment, getGarment, getGarmentSummary, sectionByGarment } from "./garments";
import { normalizeHandle } from "./handles";
import { getColorListingHref } from "./product-colors";
import type { GroupableProduct } from "./product-groups";
import { createProductGroup, getListingHandles, getProductGroupForMember, getProductHref, groupProductListings, resolveListingHandle, resolveProductHandle } from "./product-groups";
import { sortOptionValues } from "./product-options";
import { shopifyCatalogTag } from "./shopify-cache";
import { getListingMemberHandles, pickRelatedListings } from "./related-listings";
import { recommendListings } from "./sort";
import type {
  Cart,
  CatalogSections,
  CollectionSection,
  CollectionSummary,
  Product,
  ProductListing,
  ProductPage,
  ProductVariant,
  ShopPolicy,
  StoreImage,
} from "./types";

const apiVersion = "2026-04";

type Edge<T> = { node: T };
type Connection<T> = { edges: Edge<T>[] };
type PaginatedConnection<T> = Connection<T> & {
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
};
type ProductSummary = Pick<Product, "handle" | "title" | "tags"> & { updatedAt?: string };
type ProductSummariesPayload = { products: PaginatedConnection<ProductSummary> };
type ProductNode = Omit<Product, "images" | "variants"> & {
  images: PaginatedConnection<StoreImage>;
  variants: PaginatedConnection<ProductVariant>;
};
type CollectionMembership = CollectionSummary & { products: Connection<{ handle: string }> };

/** One listing given the home page's spotlight. `description` is the spotlight collection's own copy, when it has some. */
export type HomeSpotlight = { listing: ProductListing; label: string; description: string; curated: boolean };
/** A doorway into a collection: its lead image and how many listings wait inside. */
export type HomeCollectionTile = { collection: CollectionSummary; image: StoreImage | null; total: number };
export type HomeCatalog = {
  spotlight: HomeSpotlight | null;
  favorites: CollectionSection;
  collections: HomeCollectionTile[];
};

// Shopify's built-in home page collection (named Best Sellers in Shopify) holds
// hand-picked favorites rather than a browsing department.
const featuredCollectionHandle = "frontpage";
// A Shopify collection whose first listing leads the home page as the featured drop.
// Without one, the newest listing takes the spot.
const spotlightCollectionHandle = "spotlight";
const favoritesLimit = 4;
// Shopify seeds new collections with this copy; treat it as no description.
const shopifyPlaceholderDescription = "This is a test description.";

const imageFields = "url altText width height";
const variantFields = `
  id title availableForSale
  price { amount currencyCode }
  compareAtPrice { amount currencyCode }
  image { ${imageFields} }
  selectedOptions { name value }
`;

const productFragment = `
  fragment ProductFields on Product {
    id
    handle
    title
    description
    descriptionHtml
    availableForSale
    createdAt
    productType
    category { name ancestors { name } }
    tags
    featuredImage { url altText width height }
    images(first: 12) { edges { node { ${imageFields} } } pageInfo { endCursor hasNextPage } }
    priceRange { minVariantPrice { amount currencyCode } }
    options { id name values optionValues { name swatch { color } } }
    variants(first: 100) {
      edges { node { ${variantFields} } }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

const cartFragment = `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount { amount currencyCode }
      totalAmount { amount currencyCode }
    }
    discountAllocations { discountedAmount { amount currencyCode } }
    lines(first: 100) {
      edges {
        node {
          id
          quantity
          merchandise {
            ... on ProductVariant {
              id
              title
              availableForSale
              price { amount currencyCode }
              compareAtPrice { amount currencyCode }
              image { url altText width height }
              selectedOptions { name value }
              product { handle title tags }
            }
          }
        }
      }
    }
  }
`;

/** A cart change Shopify refused for a reason the shopper can act on, such as limited stock. */
export class ShopifyUserError extends Error {}

export function isShopifyConfigured() {
  return Boolean(
    process.env.SHOPIFY_STORE_DOMAIN &&
      process.env.SHOPIFY_STOREFRONT_API_TOKEN,
  );
}

function normalizeDomain(domain: string) {
  return domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

// Printful labels every mockup it syncs "Product mockup", which describes nothing to a
// screen reader or a link preview. Dropping it here lets every image fall back to
// the product title, the same as an image with no alt text written.
const placeholderAltTexts = new Set(["product mockup"]);

export function dropPlaceholderAltText(key: string, value: unknown) {
  return key === "altText" && typeof value === "string" && placeholderAltTexts.has(value.trim().toLowerCase()) ? null : value;
}

// Copy pasted into Shopify's editor from Google Docs brings `<meta charset>` tags along,
// which are invalid in the page body and leave an empty paragraph that hides a policy's
// opening "Last updated" line. Only descriptions and policy bodies hold editor HTML.
const editorHtmlFields = new Set(["descriptionHtml", "body"]);

export function cleanEditorHtml(html: string) {
  return html.replace(/<meta\b[^>]*>/gi, "").replace(/<p\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "").trim();
}

function cleanStorefrontValue(key: string, value: unknown) {
  if (typeof value === "string" && editorHtmlFields.has(key)) return cleanEditorHtml(value);
  return dropPlaceholderAltText(key, value);
}

async function storefrontRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options: { revalidate?: number } = {},
): Promise<T> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_API_TOKEN;

  if (!domain || !token) {
    throw new Error("Shopify is not configured.");
  }

  const response = await fetch(
    `https://${normalizeDomain(domain)}/api/${apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
      next: options.revalidate
        ? { revalidate: options.revalidate, tags: [shopifyCatalogTag] }
        : undefined,
      cache: options.revalidate ? undefined : "no-store",
      // A stalled Shopify call must not hold a page render or cart change open.
      signal: AbortSignal.timeout(10_000),
    },
  );

  // Gateways can answer with HTML; report the status rather than a JSON parse error.
  const payload = (await response.text().then((text) => JSON.parse(text, cleanStorefrontValue)).catch(() => ({}))) as {
    data?: T;
    errors?: { message: string }[];
  };

  if (!response.ok || payload.errors?.length || !payload.data) {
    const message = payload.errors?.map((error) => error.message).join("; ");
    throw new Error(message || `Shopify request failed (${response.status}).`);
  }

  return payload.data;
}

function reshapeProduct(product: ProductNode): Product {
  return {
    ...product,
    handle: normalizeHandle(product.handle),
    images: product.images.edges.map(({ node }) => node),
    options: product.options.map(sortOptionValues),
    variants: product.variants.edges.map(({ node }) => node),
  };
}

async function completeProductConnection<T>(handle: string, field: "images" | "variants", connection: PaginatedConnection<T>, fields: string): Promise<PaginatedConnection<T>> {
  const edges = [...connection.edges];
  const cursors = new Set<string>();
  let pageInfo = connection.pageInfo;
  while (pageInfo.hasNextPage) {
    if (!pageInfo.endCursor || cursors.has(pageInfo.endCursor)) throw new Error(`Could not load all product ${field}.`);
    cursors.add(pageInfo.endCursor);
    const data = await storefrontRequest<{ product: { items: PaginatedConnection<T> } | null }>(
      `query ProductConnection($handle: String!, $after: String!) {
        product(handle: $handle) {
          items: ${field}(first: 250, after: $after) {
            edges { node { ${fields} } }
            pageInfo { endCursor hasNextPage }
          }
        }
      }`,
      { handle, after: pageInfo.endCursor },
      { revalidate: 300 },
    );
    if (!data.product) throw new Error(`Could not load all product ${field}.`);
    edges.push(...data.product.items.edges);
    pageInfo = data.product.items.pageInfo;
  }
  return { edges, pageInfo };
}

export async function getCollections(): Promise<CollectionSummary[]> {
  if (!isShopifyConfigured()) return demoCollections;

  const memberships = await getCollectionMemberships();
  return [
    ...catalogCollections.map(getCatalogCollectionSummary),
    ...memberships.filter(isBrowsingCollection).map(({ id, handle, title, description, image }) => ({ id, handle, title, description, image })),
  ];
}

function isBrowsingCollection(collection: Pick<CollectionSummary, "handle">) {
  return collection.handle !== "ryd" && collection.handle !== featuredCollectionHandle && collection.handle !== spotlightCollectionHandle && !getCatalogCollection(collection.handle);
}

// Follows Shopify's cursors to the last page and fails rather than returning a partial
// list. Returns null when the first page reports that its parent does not exist.
async function loadAllPages<T>(loadPage: (after: string | null) => Promise<PaginatedConnection<T> | null>): Promise<T[] | null> {
  const nodes: T[] = [];
  const cursors = new Set<string>();
  let after: string | null = null;
  while (true) {
    const connection = await loadPage(after);
    if (!connection) {
      if (after === null) return null;
      throw new Error("Shopify stopped returning catalog pages.");
    }
    nodes.push(...connection.edges.map(({ node }) => node));
    const { endCursor, hasNextPage } = connection.pageInfo;
    if (!hasNextPage) return nodes;
    if (!endCursor || cursors.has(endCursor)) throw new Error("Could not load the complete Shopify product catalog.");
    cursors.add(endCursor);
    after = endCursor;
  }
}

async function getProductSummaries(): Promise<ProductSummary[]> {
  const products = await loadAllPages(async (after) => (await storefrontRequest<ProductSummariesPayload>(
    `query CatalogProductSummaries($after: String) {
      products(first: 250, after: $after, sortKey: TITLE) {
        edges { node { handle title tags updatedAt } }
        pageInfo { endCursor hasNextPage }
      }
    }`,
    { after },
    { revalidate: 300 },
  )).products);
  return products ?? [];
}

async function getCatalogProducts(query: string | null): Promise<Product[]> {
  const products = await loadAllPages(async (after) => (await storefrontRequest<{ products: PaginatedConnection<ProductNode> }>(
    `${productFragment}
      query CatalogCollectionProducts($after: String, $query: String) {
        products(first: 50, after: $after, query: $query, sortKey: BEST_SELLING) {
          edges { node { ...ProductFields } }
          pageInfo { endCursor hasNextPage }
        }
      }`,
    { after, query },
    { revalidate: 300 },
  )).products);
  return (products ?? []).map(reshapeProduct);
}

// Members are found by slug across the whole catalog rather than by Shopify's exact tag
// search, so `listing:Name Tag Shirt` and `listing: name tag shirt` share one listing.
async function getListingProducts(handles: string[]): Promise<Product[]> {
  if (!handles.length) return [];
  const isMember = (product: GroupableProduct) => handles.includes(getProductGroupForMember(product)?.handle ?? "");
  if (!isShopifyConfigured()) return demoProducts.filter(isMember);
  const members = (await getProductSummaries()).filter(isMember);
  const products = await Promise.all(members.map((product) => getShopifyProduct(product.handle)));
  return products.filter((product) => product !== null);
}

async function getGroupedListings(products: Product[]): Promise<ProductListing[]> {
  const handles = [...new Set(products.flatMap((product) => getProductGroupForMember(product)?.handle ?? []))];
  return groupProductListings(products, await getListingProducts(handles));
}

// Orders curated picks by their earliest member in the collection.
function getListingsInCollection(listings: ProductListing[], handles: string[], preserveSalesOrder = false) {
  const positions = new Map(handles.map((handle, index) => [handle, index]));
  return listings
    .map((listing) => ({ listing, position: Math.min(...getListingMemberHandles(listing).map((handle) => positions.get(handle) ?? Infinity)) }))
    .filter(({ position }) => position !== Infinity)
    .sort((a, b) => preserveSalesOrder ? 0 : a.position - b.position)
    .map(({ listing }) => listing);
}

// Every product handle, best seller first.
async function getBestSellingHandles(): Promise<string[]> {
  const products = await loadAllPages(async (after) => (await storefrontRequest<{ products: PaginatedConnection<{ handle: string }> }>(
    `query BestSellingHandles($after: String) {
      products(first: 250, after: $after, sortKey: BEST_SELLING) {
        edges { node { handle } }
        pageInfo { endCursor hasNextPage }
      }
    }`,
    { after },
    { revalidate: 300 },
  )).products);
  return (products ?? []).map(({ handle }) => normalizeHandle(handle));
}

// Membership handles only. Every collection is loaded, but only a collection's first 250
// products count toward its section, which is far beyond any section's size.
// Collections are ordered by their best-selling product, so the menu, the home tiles,
// and Shop All lead with what sells rather than what sorts first alphabetically.
async function getCollectionMemberships(): Promise<CollectionMembership[]> {
  const [collections, bestSelling] = await Promise.all([
    loadAllPages(async (after) => (await storefrontRequest<{ collections: PaginatedConnection<CollectionMembership> }>(
      `query CollectionMemberships($after: String) {
        collections(first: 50, after: $after, sortKey: TITLE) {
          edges { node { id handle title description image { url altText width height } products(first: 250) { edges { node { handle } } } } }
          pageInfo { endCursor hasNextPage }
        }
      }`,
      { after },
      { revalidate: 300 },
    )).collections),
    getBestSellingHandles(),
  ]);
  const memberships = (collections ?? []).map((node) => ({
    ...node,
    handle: normalizeHandle(node.handle),
    products: { edges: node.products.edges.map(({ node: product }) => ({ node: { handle: normalizeHandle(product.handle) } })) },
  }));
  return sortCollectionsBySales(memberships, bestSelling);
}

/** Orders collections by the sales rank of their best-selling product; ties keep the given order. */
export function sortCollectionsBySales<T extends Pick<CollectionMembership, "products">>(collections: T[], bestSelling: string[]) {
  const positions = new Map(bestSelling.map((handle, index) => [handle, index]));
  const rank = (collection: T) => Math.min(Infinity, ...collection.products.edges.map(({ node }) => positions.get(node.handle) ?? Infinity));
  return collections.map((collection) => ({ collection, rank: rank(collection) })).sort((a, b) => a.rank - b.rank).map(({ collection }) => collection);
}

// Every browsing collection with its listings, plus the listings in none of them. A
// listing in several collections appears in each one's section.
function sectionListings(listings: ProductListing[], memberships: CollectionMembership[]): CatalogSections {
  const sectioned = new Set<string>();
  const sections = memberships.filter(isBrowsingCollection).flatMap(({ products: members, ...collection }) => {
    const sectionListings = withExternalListings(collection.handle, getListingsInCollection(listings, members.edges.map(({ node }) => node.handle), true));
    for (const listing of sectionListings) sectioned.add(listing.id);
    return sectionListings.length ? [{ collection, products: sectionListings, total: sectionListings.length }] : [];
  });
  return { sections, more: sections.length ? listings.filter((listing) => !sectioned.has(listing.id)) : [] };
}

// A tile shows the collection's own Shopify image, else its first Shopify listing's photo;
// off-Shopify listings are cutouts that read poorly as a cover.
function getCollectionTile({ collection, products, total }: CollectionSection): HomeCollectionTile {
  const lead = products.find((listing) => !listing.externalUrl && listing.featuredImage) ?? products.find((listing) => listing.featuredImage);
  return { collection, image: collection.image ?? lead?.featuredImage ?? null, total };
}

// With no Shopify collections (preview mode), the type pages are the ways in.
function getTypeCollectionSections(listings: ProductListing[]): CollectionSection[] {
  return catalogCollections.flatMap((collection) => {
    if (collection.productType === null) return [];
    const products = withExternalListings(collection.handle, listings.filter((listing) => isInCatalogCollection(collection, listing)));
    return products.length ? [{ collection: getCatalogCollectionSummary(collection), products, total: products.length }] : [];
  });
}

function getSpotlight(listings: ProductListing[], memberships: CollectionMembership[]): HomeSpotlight | null {
  const curated = memberships.find((collection) => collection.handle === spotlightCollectionHandle);
  const [pick] = curated ? getListingsInCollection(listings, curated.products.edges.map(({ node }) => node.handle)) : [];
  if (curated && pick) return { listing: pick, label: curated.title || "Featured drop", description: curated.description, curated: true };
  const newest = listings.filter((listing) => listing.availableForSale).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
  return newest ? { listing: newest, label: "New arrival", description: "", curated: false } : null;
}

export async function getHomeCatalog(): Promise<HomeCatalog> {
  const configured = isShopifyConfigured();
  const [products, memberships] = configured
    ? await Promise.all([getCatalogProducts(null), getCollectionMemberships()])
    : [demoProducts, []];
  const listings = groupProductListings(products);
  const spotlight = getSpotlight(listings, memberships);

  const favorites = memberships.find((collection) => collection.handle === featuredCollectionHandle);
  const picks = favorites ? getListingsInCollection(listings, favorites.products.edges.map(({ node }) => node.handle)) : [];
  const curated = picks.length ? favorites : undefined;
  // Shopify's original setup copy can remain until the collection is edited there.
  const description = curated?.description.trim();
  // A popular listing stays in this row even when it also has the spotlight.
  const featured = curated ? picks : listings;
  const { sections } = sectionListings(listings, memberships);

  return {
    spotlight,
    favorites: {
      collection: {
        id: curated?.id ?? "featured",
        handle: featuredCollectionHandle,
        title: curated?.title || "Best Sellers",
        description: description && description !== shopifyPlaceholderDescription ? description : "Popular picks, pulled straight from the official catalog.",
        image: null,
      },
      products: featured.slice(0, favoritesLimit),
      total: featured.length,
    },
    collections: (sections.length ? sections : getTypeCollectionSections(listings)).map(getCollectionTile),
  };
}

/**
 * Each listing's URL and when it last changed in Shopify, for the sitemap. A grouped
 * listing changed when any of its member products did.
 */
export async function getProductSitemapEntries(): Promise<{ handle: string; lastModified?: string }[]> {
  const products = isShopifyConfigured() ? await getProductSummaries() : demoProducts;
  const latest = new Map<string, string | undefined>();
  for (const product of products) {
    const normalized = { ...product, handle: normalizeHandle(product.handle) };
    const [handle] = getListingHandles([normalized]);
    const updatedAt = "updatedAt" in product ? product.updatedAt : undefined;
    const previous = latest.get(handle);
    latest.set(handle, previous && (!updatedAt || previous > updatedAt) ? previous : updatedAt);
  }
  return [...latest].map(([handle, lastModified]) => (lastModified ? { handle, lastModified } : { handle }));
}

export async function getProductHandles(): Promise<string[]> {
  const products = isShopifyConfigured() ? await getProductSummaries() : demoProducts;
  return getListingHandles(products.map((product) => ({ ...product, handle: normalizeHandle(product.handle) })));
}

export async function getCollection(handle: string): Promise<ProductPage | null> {
  if (handle === "ryd") return null;
  // The same hand-picked favorites lead every page where they belong, and Shopify's
  // best-selling order fills the rest. Department pages split into garment groupings.
  const memberships = isShopifyConfigured() ? await getCollectionMemberships() : [];
  const page = await loadCollection(handle, memberships);
  if (!page) return null;
  const popularHandles = memberships.find((collection) => collection.handle === featuredCollectionHandle)?.products.edges.map(({ node }) => node.handle) ?? [];
  const products = recommendListings(page.products, popularHandles);
  return { ...page, products, ...sectionByGarment(handle, products) };
}

/** One garment grouping of a department page, such as Hats under Apparel, in the same order. */
export async function getGarmentCollection(department: string, handle: string): Promise<ProductPage | null> {
  const garment = findGarment(department, handle);
  const page = garment ? await getCollection(department) : null;
  if (!garment || !page) return null;
  return { collection: getGarmentSummary(garment), products: page.products.filter((listing) => getGarment(department, listing)?.handle === handle) };
}

/** Each department's garment groupings that hold at least one listing, keyed by department. */
export async function getStockedGarments(): Promise<Record<string, string[]>> {
  const entries = await Promise.all(departments.map(async ({ handle }) => {
    const page = await getCollection(handle);
    return [handle, page?.sections?.map(({ collection }) => collection.handle) ?? []] as const;
  }));
  return Object.fromEntries(entries);
}

async function loadCollection(handle: string, memberships: CollectionMembership[]): Promise<ProductPage | null> {
  const catalogCollection = getCatalogCollection(handle);

  if (!isShopifyConfigured()) {
    if (!catalogCollection) return null;
    return {
      collection: getCatalogCollectionSummary(catalogCollection),
      products: withExternalListings(handle, groupProductListings(demoProducts.filter((product) => isInCatalogCollection(catalogCollection, product)))),
    };
  }

  // Load every product before grouping so a listing gets exactly one card instead of
  // reappearing on every result page that contains a member.
  if (catalogCollection) {
    const collection = getCatalogCollectionSummary(catalogCollection);
    // Shop All is broken up into the same collection sections as the home page.
    if (catalogCollection.productType === null) {
      const products = await getCatalogProducts(null);
      const listings = withExternalListings(handle, await getGroupedListings(products));
      return { collection, products: listings, ...sectionListings(listings, memberships) };
    }
    return { collection, products: withExternalListings(handle, await getGroupedListings(await getCatalogProducts(getCatalogProductQuery(catalogCollection)))) };
  }
  if (handle === featuredCollectionHandle) return null;

  const page = await getShopifyCollection(handle);
  if (page) return page;
  // A storefront URL spells Shopify's emoji handle with "heart"; look up the original.
  const original = (await getShopifyCollectionHandles()).find((shopifyHandle) => shopifyHandle !== handle && normalizeHandle(shopifyHandle) === handle);
  return original ? getShopifyCollection(original) : null;
}

async function getShopifyCollectionHandles() {
  const collections = await loadAllPages(async (after) => (await storefrontRequest<{ collections: PaginatedConnection<{ handle: string }> }>(
    `query CollectionHandles($after: String) {
      collections(first: 250, after: $after) { edges { node { handle } } pageInfo { endCursor hasNextPage } }
    }`,
    { after },
    { revalidate: 300 },
  )).collections);
  return (collections ?? []).map(({ handle }) => handle);
}

async function getShopifyCollection(handle: string): Promise<ProductPage | null> {
  const found: { collection?: CollectionSummary } = {};
  const products = await loadAllPages(async (after) => {
    const data = await storefrontRequest<{ collection: (CollectionSummary & { products: PaginatedConnection<ProductNode> }) | null }>(
      `${productFragment}
        query Collection($handle: String!, $after: String) {
          collection(handle: $handle) {
            id handle title description image { url altText width height }
            products(first: 50, after: $after, sortKey: BEST_SELLING) {
              edges { node { ...ProductFields } }
              pageInfo { endCursor hasNextPage }
            }
          }
        }`,
      { handle, after },
      { revalidate: 300 },
    );
    if (!data.collection) return null;
    const { products: page, ...collection } = data.collection;
    found.collection = { ...collection, handle: normalizeHandle(collection.handle) };
    return page;
  });
  if (!products || !found.collection) return null;
  return { collection: found.collection, products: withExternalListings(found.collection.handle, await getGroupedListings(products.map(reshapeProduct))) };
}

export async function getProduct(handle: string): Promise<ProductListing | null> {
  const members = await getListingProducts([resolveListingHandle(handle)]);
  const group = members[0] && getProductGroupForMember(members[0]);
  if (group) return createProductGroup(group, members);
  return getShopifyProduct(resolveProductHandle(handle));
}

// A listing's Shopify recommendations come from its first few designs; the rest
// mostly recommend each other.
const recommendationSources = 3;

/** Shopify's related products for one product handle, best match first. */
async function getRecommendedHandles(handle: string): Promise<string[]> {
  const data = await storefrontRequest<{ productRecommendations: { handle: string }[] | null }>(
    `query RelatedProducts($handle: String!) {
      productRecommendations(productHandle: $handle, intent: RELATED) { handle }
    }`,
    { handle },
    { revalidate: 300 },
  );
  return (data.productRecommendations ?? []).map((product) => normalizeHandle(product.handle));
}

/**
 * The product page's "More from this shop" row: purchasable listings related
 * to `listing` by Shopify's recommendations, shared collections, or product
 * type. Recommendations are a garnish; if Shopify can't give them, the
 * collection and type tiers still fill the row.
 */
export async function getRelatedListings(listing: ProductListing): Promise<ProductListing[]> {
  if (!isShopifyConfigured()) return pickRelatedListings(listing, groupProductListings(demoProducts));
  const sources = getListingMemberHandles(listing).slice(0, recommendationSources);
  const [products, memberships, recommended] = await Promise.all([
    getCatalogProducts(null),
    getCollectionMemberships(),
    Promise.all(sources.map((handle) => getRecommendedHandles(handle).catch(() => []))),
  ]);
  return pickRelatedListings(listing, groupProductListings(products), {
    recommended: recommended.flat(),
    collections: memberships.filter(isBrowsingCollection).map(({ products: members }) => members.edges.map(({ node }) => node.handle)),
  });
}

/** What a review suggestion card needs about a product: where it lives and what it looks like. */
export type ProductCard = {
  handle: string; title: string; image: { url: string; altText: string | null } | null;
  /** Canonical product/style URL, avoiding redirects that discard review anchors. */
  href?: string;
  /** Option names in Shopify's order, e.g. ["Size", "Color"]; a variant title lists values in the same order. */
  options: string[];
};

/**
 * Published products by numeric Shopify ID, keyed by that ID. Unpublished or
 * deleted products are simply absent, since there's no page to review them on.
 */
export async function getProductCardsByIds(productIds: string[]): Promise<Record<string, ProductCard>> {
  const ids = [...new Set(productIds)].filter((id) => /^[1-9][0-9]{0,19}$/.test(id)).slice(0, 50);
  if (!ids.length) return {};
  type CardProduct = { handle: string; title: string; tags?: string[]; featuredImage?: { url: string; altText?: string | null } | null; options?: { name: string }[] };
  const cards = async (entries: [string, CardProduct][]) => {
    const href = await getCanonicalProductHrefs(entries.map(([, product]) => product));
    return Object.fromEntries(entries.map(([id, product]) => [id, {
      handle: product.handle, href: href(product), title: product.title, image: product.featuredImage ? { url: product.featuredImage.url, altText: product.featuredImage.altText ?? null } : null,
      options: (product.options ?? []).map((option) => option.name),
    } satisfies ProductCard]));
  };
  if (!isShopifyConfigured()) {
    return cards(demoProducts.flatMap((product) => {
      const id = product.id.split("/").pop()!;
      return ids.includes(id) ? [[id, product] as [string, CardProduct]] : [];
    }));
  }
  const data = await storefrontRequest<{ nodes: ({ id: string; handle: string; title: string; tags: string[]; featuredImage: { url: string; altText: string | null } | null; options: { name: string }[] } | null)[] }>(
    `query ProductCards($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id handle title tags featuredImage { url altText } options { name } } } }`,
    { ids: ids.map((id) => `gid://shopify/Product/${id}`) },
    { revalidate: 300 },
  );
  return cards(data.nodes.flatMap((node) => node?.id && node.handle ? [[node.id.split("/").pop()!, node] as [string, CardProduct]] : []));
}

/**
 * Canonical links for listing members. A member link names its printing
 * product (`?design=`), but a listing split by color is addressed by color
 * alone, since shoppers choose a color and never the product that prints it.
 * Resolving that needs the listing's other members, so they're fetched once.
 * `colors` names the color to open on, such as a cart line's option values.
 */
export async function getCanonicalProductHrefs(products: GroupableProduct[]) {
  const groups = new Map(products.flatMap((product) => {
    const group = getProductGroupForMember(product);
    return group ? [[group.handle, group] as const] : [];
  }));
  const members = await getListingProducts([...groups.keys()]).catch(() => []);
  const listings = new Map([...groups].flatMap(([handle, group]) => {
    const listing = createProductGroup(group, members);
    return listing ? [[handle, listing] as const] : [];
  }));
  return (product: GroupableProduct, colors?: readonly string[]) => {
    const listing = listings.get(getProductGroupForMember(product)?.handle ?? "");
    const design = listing?.designs?.find((entry) => entry.product.handle === product.handle)?.value;
    return (listing && design && getColorListingHref(listing, design, colors)) || getProductHref(product);
  };
}

/**
 * A product's current title from its numeric Shopify ID, or null when no such
 * product exists. Used as the snapshot on a review written without an order.
 */
export async function getProductTitleById(productId: string): Promise<string | null> {
  const id = `gid://shopify/Product/${productId}`;
  if (!isShopifyConfigured()) return demoProducts.find((product) => product.id === id)?.title ?? null;
  const data = await storefrontRequest<{ product: { title: string } | null }>(
    `query ProductTitle($id: ID!) { product(id: $id) { title } }`,
    { id },
    { revalidate: 300 },
  );
  return data.product?.title ?? null;
}

async function getShopifyProduct(handle: string): Promise<Product | null> {
  if (!isShopifyConfigured()) {
    return demoProducts.find((product) => product.handle === handle) ?? null;
  }

  const data = await storefrontRequest<{ product: ProductNode | null }>(
    `${productFragment}
      query Product($handle: String!) {
        product(handle: $handle) { ...ProductFields }
      }`,
    { handle },
    { revalidate: 300 },
  );
  if (!data.product) {
    // A storefront URL spells Shopify's emoji handle with "heart"; look up the original.
    const original = (await getProductSummaries()).find((product) => product.handle !== handle && normalizeHandle(product.handle) === handle);
    return original ? getShopifyProduct(original.handle) : null;
  }
  const [images, variants] = await Promise.all([
    completeProductConnection(handle, "images", data.product.images, imageFields),
    completeProductConnection(handle, "variants", data.product.variants, variantFields),
  ]);
  return reshapeProduct({ ...data.product, images, variants });
}

// Footer and sitemap order. A policy left blank in Shopify Admin comes back null and
// gets no page.
const policyFields = ["refundPolicy", "shippingPolicy", "privacyPolicy", "termsOfService", "termsOfSale", "legalNotice", "contactInformation"] as const;

export async function getPolicies(): Promise<ShopPolicy[]> {
  // The policy text is the shop's own legal copy, so demo mode has none to show.
  if (!isShopifyConfigured()) return [];
  const data = await storefrontRequest<{ shop: Record<(typeof policyFields)[number], ShopPolicy | null> }>(
    `query Policies { shop { ${policyFields.map((field) => `${field} { handle title body }`).join(" ")} } }`,
    {},
    { revalidate: 300 },
  );
  return policyFields.flatMap((field) => data.shop[field] ?? []).filter((policy) => policy.body.trim());
}

/** The countries the store sells and ships to: Shopify Markets, the same list checkout offers. */
export async function getShippingCountries(): Promise<string[]> {
  if (!isShopifyConfigured()) return [];
  const data = await storefrontRequest<{ localization: { availableCountries: { isoCode: string }[] } }>(
    `query ShippingCountries { localization { availableCountries { isoCode } } }`,
    {},
    { revalidate: 300 },
  );
  return data.localization.availableCountries.map((country) => country.isoCode);
}

/** Shopify's customer account, where a shopper signs in for order status and tracking. */
export async function getCustomerAccountUrl(): Promise<string | null> {
  if (!isShopifyConfigured()) return null;
  const data = await storefrontRequest<{ shop: { id: string; customerAccountUrl: string | null } }>(
    `query CustomerAccount { shop { id customerAccountUrl } }`,
    {},
    { revalidate: 300 },
  );
  if (data.shop.customerAccountUrl) return data.shop.customerAccountUrl;
  // A headless shop gets null here even with customer accounts on, so fall back to the
  // address Shopify Admin shows under Settings → Customer accounts → URL.
  const shopId = data.shop.id.split("/").pop();
  return shopId ? `https://shopify.com/${shopId}/account` : null;
}

async function reshapeCart(raw: Omit<Cart, "lines"> & { lines: Connection<Cart["lines"][number]> }): Promise<Cart> {
  const nodes = raw.lines.edges.map(({ node }) => ({ ...node.merchandise.product, handle: normalizeHandle(node.merchandise.product.handle) }));
  // A line links to its own color on a color-split listing rather than naming the printing product.
  const href = await getCanonicalProductHrefs(nodes);
  return {
    ...raw,
    lines: raw.lines.edges.map(({ node }, index) => ({
      ...node,
      merchandise: { ...node.merchandise, product: { ...nodes[index], href: href(nodes[index], node.merchandise.selectedOptions.map((option) => option.value)) } },
    })),
  };
}

type CartPayload = {
  cart: (Omit<Cart, "lines"> & { lines: Connection<Cart["lines"][number]> }) | null;
  userErrors: { message: string }[];
};

async function readCartPayload(payload: CartPayload): Promise<Cart> {
  if (payload.userErrors.length) {
    throw new ShopifyUserError(payload.userErrors.map((error) => error.message).join("; "));
  }
  if (!payload.cart) throw new Error("Shopify did not return a cart.");
  return reshapeCart(payload.cart);
}

/** The cart as Shopify has it now, or null once it has checked out or expired. */
export async function getCart(cartId: string) {
  const data = await storefrontRequest<{ cart: CartPayload["cart"] }>(
    `${cartFragment}
      query Cart($cartId: ID!) { cart(id: $cartId) { ...CartFields } }`,
    { cartId },
  );
  return data.cart ? reshapeCart(data.cart) : null;
}

export async function createCart(merchandiseId: string, quantity: number) {
  const data = await storefrontRequest<{ cartCreate: CartPayload }>(
    `${cartFragment}
      mutation CartCreate($input: CartInput!) {
        cartCreate(input: $input) { cart { ...CartFields } userErrors { message } }
      }`,
    { input: { lines: [{ merchandiseId, quantity }] } },
  );
  return readCartPayload(data.cartCreate);
}

export async function addCartLine(cartId: string, merchandiseId: string, quantity: number) {
  const data = await storefrontRequest<{ cartLinesAdd: CartPayload }>(
    `${cartFragment}
      mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...CartFields } userErrors { message } }
      }`,
    { cartId, lines: [{ merchandiseId, quantity }] },
  );
  return readCartPayload(data.cartLinesAdd);
}

export async function updateCartLine(cartId: string, lineId: string, quantity: number) {
  const data = await storefrontRequest<{ cartLinesUpdate: CartPayload }>(
    `${cartFragment}
      mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ...CartFields } userErrors { message } }
      }`,
    { cartId, lines: [{ id: lineId, quantity }] },
  );
  return readCartPayload(data.cartLinesUpdate);
}

export async function removeCartLine(cartId: string, lineId: string) {
  const data = await storefrontRequest<{ cartLinesRemove: CartPayload }>(
    `${cartFragment}
      mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...CartFields } userErrors { message } }
      }`,
    { cartId, lineIds: [lineId] },
  );
  return readCartPayload(data.cartLinesRemove);
}
