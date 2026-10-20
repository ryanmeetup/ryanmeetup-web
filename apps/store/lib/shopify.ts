import { demoCollections, demoProducts } from "./demo-data";
import { createProductGroup, getListingHandles, getProductGroup, getProductGroupForMember, groupProductListings, productGroups, resolveProductHandle } from "./product-groups";
import type { ProductGroup } from "./product-groups";
import type {
  Cart,
  CollectionSummary,
  Product,
  ProductListing,
  ProductPage,
  ProductVariant,
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
type CollectionNode = CollectionSummary & {
  products?: Connection<ProductNode> & {
    pageInfo: ProductPage["pageInfo"];
  };
};

const imageFields = "url altText width height";
const variantFields = `
  id title availableForSale
  price { amount currencyCode }
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
    images: product.images.edges.map(({ node }) => node),
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
  return data.collections.edges.map(({ node }) => node);
}

async function getProductSummaries(query?: string): Promise<ProductSummary[]> {
  const products: ProductSummary[] = [];
  const cursors = new Set<string>();
  let after: string | null = null;
  while (true) {
    const data: ProductSummariesPayload = await storefrontRequest<ProductSummariesPayload>(
      `query CatalogProductSummaries($after: String, $query: String) {
        products(first: 250, after: $after, query: $query, sortKey: TITLE) {
          edges { node { handle title tags } }
          pageInfo { endCursor hasNextPage }
        }
      }`,
      { after, query: query ?? null },
      { revalidate: 300 },
    );
    products.push(...data.products.edges.map(({ node }) => node));
    const { endCursor, hasNextPage } = data.products.pageInfo;
    if (!hasNextPage) return products;
    if (!endCursor || cursors.has(endCursor)) throw new Error("Could not load the complete Shopify product catalog.");
    cursors.add(endCursor);
    after = endCursor;
  }
}

async function getProductGroupProducts(group: ProductGroup): Promise<Product[]> {
  if (!isShopifyConfigured()) return demoProducts.filter((product) => getProductGroupForMember(product)?.handle === group.handle);
  const summaries = await getProductSummaries(`tag:${JSON.stringify(group.tag)}`);
  const members = summaries.filter((product) => getProductGroupForMember(product)?.handle === group.handle);
  const products = await Promise.all(members.map((product) => getShopifyProduct(product.handle)));
  return products.filter((product) => product !== null);
}

async function getGroupedListings(products: Product[]): Promise<ProductListing[]> {
  const groups = productGroups.filter((group) => products.some((product) => getProductGroupForMember(product)?.handle === group.handle));
  const relatedProducts = (await Promise.all(groups.map(getProductGroupProducts))).flat();
  return groupProductListings(products, relatedProducts);
}

export async function getFeaturedProducts(): Promise<ProductListing[]> {
  if (!isShopifyConfigured()) return groupProductListings(demoProducts);

  const data = await storefrontRequest<{ products: Connection<ProductNode> }>(
    `${productFragment}
      query FeaturedProducts {
        products(first: 8, sortKey: BEST_SELLING) {
          edges { node { ...ProductFields } }
        }
      }`,
    {},
    { revalidate: 300 },
  );
  return getGroupedListings(data.products.edges.map(({ node }) => reshapeProduct(node)));
}

export async function getProductHandles(): Promise<string[]> {
  return getListingHandles(isShopifyConfigured() ? await getProductSummaries() : demoProducts);
}

export async function getCollection(
  handle: string,
  after?: string,
): Promise<ProductPage | null> {
  if (!isShopifyConfigured()) {
    const collection = demoCollections.find((item) => item.handle === handle);
    if (!collection) return null;
    const products =
      handle === "all"
        ? demoProducts
        : demoProducts.filter((product) =>
            handle === "apparel"
              ? product.productType !== "Accessories"
              : product.productType === "Accessories",
          );
    return {
      collection,
      products: groupProductListings(products),
      pageInfo: {
        endCursor: null,
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
      },
    };
  }

  const data = await storefrontRequest<{
    collection: CollectionNode | null;
  }>(
    `${productFragment}
      query Collection($handle: String!, $after: String) {
        collection(handle: $handle) {
          id handle title description image { url altText width height }
          products(first: 12, after: $after, sortKey: COLLECTION_DEFAULT) {
            pageInfo { endCursor hasNextPage hasPreviousPage startCursor }
            edges { node { ...ProductFields } }
          }
        }
      }`,
    { handle, after: after || null },
    { revalidate: 300 },
  );

  if (!data.collection?.products) return null;
  const { products, ...collection } = data.collection;
  return {
    collection,
    products: await getGroupedListings(products.edges.map(({ node }) => reshapeProduct(node))),
    pageInfo: products.pageInfo,
  };
}

export async function getProduct(handle: string): Promise<ProductListing | null> {
  const group = getProductGroup(handle);
  if (group) return createProductGroup(group, await getProductGroupProducts(group));
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
  if (!data.product) return null;
  const [images, variants] = await Promise.all([
    completeProductConnection(handle, "images", data.product.images, imageFields),
    completeProductConnection(handle, "variants", data.product.variants, variantFields),
  ]);
  return reshapeProduct({ ...data.product, images, variants });
}

function reshapeCart(raw: Omit<Cart, "lines"> & { lines: Connection<Cart["lines"][number]> }): Cart {
  return { ...raw, lines: raw.lines.edges.map(({ node }) => node) };
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
