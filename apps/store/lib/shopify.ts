import { catalogCollections, getCatalogCollection, getCatalogCollectionSummary, getCatalogProductQuery, isInCatalogCollection } from "./catalog-collections";
import { demoCollections, demoProducts } from "./demo-data";
import { withExternalListings } from "./external-listings";
import { normalizeHandle } from "./handles";
import { createProductGroup, getListingHandles, getProductGroupForMember, groupProductListings, resolveListingHandle, resolveProductHandle } from "./product-groups";
import { sortOptionValues } from "./product-options";
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
type ProductSummary = Pick<Product, "handle" | "title" | "tags">;
type ProductSummariesPayload = { products: PaginatedConnection<ProductSummary> };
type ProductNode = Omit<Product, "images" | "variants"> & {
  images: PaginatedConnection<StoreImage>;
  variants: PaginatedConnection<ProductVariant>;
};
type CollectionMembership = CollectionSummary & { products: Connection<{ handle: string }> };

export type HomeCatalog = CatalogSections & { featured: CollectionSection };

// Shopify's built-in home page collection (named Best Sellers in Shopify) holds
// hand-picked favorites rather than a browsing department.
const featuredCollectionHandle = "frontpage";
const featuredLimit = 8;
const sectionLimit = 4;

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

export function isShopifyConfigured() {
  return Boolean(
    process.env.SHOPIFY_STORE_DOMAIN &&
      process.env.SHOPIFY_STOREFRONT_API_TOKEN,
  );
}

function normalizeDomain(domain: string) {
  return domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
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
        ? { revalidate: options.revalidate, tags: ["shopify-catalog"] }
        : undefined,
      cache: options.revalidate ? undefined : "no-store",
    },
  );

  const payload = (await response.json()) as {
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

  const data = await storefrontRequest<{
    collections: Connection<CollectionSummary>;
  }>(
    `query Collections { collections(first: 20, sortKey: TITLE) { edges { node { id handle title description image { url altText width height } } } } }`,
    {},
    { revalidate: 300 },
  );
  return [
    ...catalogCollections.map(getCatalogCollectionSummary),
    ...data.collections.edges.map(({ node }) => ({ ...node, handle: normalizeHandle(node.handle) })).filter(isBrowsingCollection),
  ];
}

function isBrowsingCollection(collection: Pick<CollectionSummary, "handle">) {
  return collection.handle !== featuredCollectionHandle && !getCatalogCollection(collection.handle);
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
        edges { node { handle title tags } }
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
  const isMember = (product: Pick<Product, "handle" | "tags">) => handles.includes(getProductGroupForMember(product)?.handle ?? "");
  if (!isShopifyConfigured()) return demoProducts.filter(isMember);
  const members = (await getProductSummaries()).filter(isMember);
  const products = await Promise.all(members.map((product) => getShopifyProduct(product.handle)));
  return products.filter((product) => product !== null);
}

async function getGroupedListings(products: Product[]): Promise<ProductListing[]> {
  const handles = [...new Set(products.flatMap((product) => getProductGroupForMember(product)?.handle ?? []))];
  return groupProductListings(products, await getListingProducts(handles));
}

function getMemberHandles(listing: ProductListing) {
  return listing.designs?.map((design) => design.product.handle) ?? [listing.handle];
}

// Orders listings by their earliest member in a collection, so Shopify's manual
// collection order carries through to grouped listings.
function getListingsInCollection(listings: ProductListing[], handles: string[]) {
  const positions = new Map(handles.map((handle, index) => [handle, index]));
  return listings
    .map((listing) => ({ listing, position: Math.min(...getMemberHandles(listing).map((handle) => positions.get(handle) ?? Infinity)) }))
    .filter(({ position }) => position !== Infinity)
    .sort((a, b) => a.position - b.position)
    .map(({ listing }) => listing);
}

// Membership handles only; a collection's first 250 products count toward its section.
async function getCollectionMemberships(): Promise<CollectionMembership[]> {
  const data = await storefrontRequest<{ collections: Connection<CollectionMembership> }>(
    `query CollectionMemberships {
      collections(first: 50, sortKey: TITLE) {
        edges { node { id handle title description image { url altText width height } products(first: 250) { edges { node { handle } } } } }
      }
    }`,
    {},
    { revalidate: 300 },
  );
  return data.collections.edges.map(({ node }) => ({
    ...node,
    handle: normalizeHandle(node.handle),
    products: { edges: node.products.edges.map(({ node: product }) => ({ node: { handle: normalizeHandle(product.handle) } })) },
  }));
}

// Every browsing collection with its listings, plus the listings in none of them. A
// listing in several collections appears in each one's section.
function sectionListings(listings: ProductListing[], memberships: CollectionMembership[]): CatalogSections {
  const sectioned = new Set<string>();
  const sections = memberships.filter(isBrowsingCollection).flatMap(({ products: members, ...collection }) => {
    const sectionListings = withExternalListings(collection.handle, getListingsInCollection(listings, members.edges.map(({ node }) => node.handle)));
    for (const listing of sectionListings) sectioned.add(listing.id);
    return sectionListings.length ? [{ collection, products: sectionListings, total: sectionListings.length }] : [];
  });
  return { sections, more: sections.length ? listings.filter((listing) => !sectioned.has(listing.id)) : [] };
}

export async function getHomeCatalog(): Promise<HomeCatalog> {
  const configured = isShopifyConfigured();
  const [products, memberships] = configured
    ? await Promise.all([getCatalogProducts(null), getCollectionMemberships()])
    : [demoProducts, []];
  const listings = groupProductListings(products);

  const favorites = memberships.find((collection) => collection.handle === featuredCollectionHandle);
  const picks = favorites ? getListingsInCollection(listings, favorites.products.edges.map(({ node }) => node.handle)) : [];
  const curated = picks.length ? favorites : undefined;
  // Without hand-picked favorites, fall back to the actual best sellers.
  const featured = curated ? picks : listings;
  const { sections, more } = sectionListings(listings, memberships);

  return {
    featured: {
      collection: {
        id: curated?.id ?? "featured",
        handle: featuredCollectionHandle,
        title: curated?.title || "Best Sellers",
        description: curated?.description || "Popular picks, pulled straight from the official catalog.",
        image: null,
      },
      products: featured.slice(0, featuredLimit),
      total: featured.length,
    },
    sections: sections.map((section) => ({ ...section, products: section.products.slice(0, sectionLimit) })),
    more,
  };
}

export async function getProductHandles(): Promise<string[]> {
  const products = isShopifyConfigured() ? await getProductSummaries() : demoProducts;
  return getListingHandles(products.map((product) => ({ ...product, handle: normalizeHandle(product.handle) })));
}

export async function getCollection(handle: string): Promise<ProductPage | null> {
  const catalogCollection = getCatalogCollection(handle);

  if (!isShopifyConfigured()) {
    if (!catalogCollection) return null;
    return {
      collection: getCatalogCollectionSummary(catalogCollection),
      products: groupProductListings(demoProducts.filter((product) => isInCatalogCollection(catalogCollection, product))),
    };
  }

  // Load every product before grouping so a listing gets exactly one card instead of
  // reappearing on every result page that contains a member.
  if (catalogCollection) {
    const collection = getCatalogCollectionSummary(catalogCollection);
    // Shop all is broken up into the same collection sections as the home page.
    if (catalogCollection.productType === null) {
      const [products, memberships] = await Promise.all([getCatalogProducts(null), getCollectionMemberships()]);
      const listings = await getGroupedListings(products);
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
  const data = await storefrontRequest<{ collections: Connection<{ handle: string }> }>(
    `query CollectionHandles { collections(first: 250) { edges { node { handle } } } }`,
    {},
    { revalidate: 300 },
  );
  return data.collections.edges.map(({ node }) => node.handle);
}

async function getShopifyCollection(handle: string): Promise<ProductPage | null> {
  const found: { collection?: CollectionSummary } = {};
  const products = await loadAllPages(async (after) => {
    const data = await storefrontRequest<{ collection: (CollectionSummary & { products: PaginatedConnection<ProductNode> }) | null }>(
      `${productFragment}
        query Collection($handle: String!, $after: String) {
          collection(handle: $handle) {
            id handle title description image { url altText width height }
            products(first: 50, after: $after, sortKey: COLLECTION_DEFAULT) {
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

function reshapeCart(raw: Omit<Cart, "lines"> & { lines: Connection<Cart["lines"][number]> }): Cart {
  return {
    ...raw,
    lines: raw.lines.edges.map(({ node }) => ({
      ...node,
      merchandise: { ...node.merchandise, product: { ...node.merchandise.product, handle: normalizeHandle(node.merchandise.product.handle) } },
    })),
  };
}

type CartPayload = {
  cart: (Omit<Cart, "lines"> & { lines: Connection<Cart["lines"][number]> }) | null;
  userErrors: { message: string }[];
};

function readCartPayload(payload: CartPayload): Cart {
  if (payload.userErrors.length) {
    throw new Error(payload.userErrors.map((error) => error.message).join("; "));
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
