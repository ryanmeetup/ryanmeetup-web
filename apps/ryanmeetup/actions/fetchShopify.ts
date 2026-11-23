// A single read of one Shopify collection for merch callouts on campaign
// pages. The full storefront client (carts, product groups, policies) lives in
// apps/store/lib/shopify.ts; this deliberately stays one query against the
// same env vars rather than a copy of that client.

import { STORE_URL } from "@/lib/store";

const API_VERSION = "2026-04";
const REVALIDATE_SECONDS = 600;

type MerchProduct = {
  id: string;
  title: string;
  href: string;
  image: {
    url: string;
    altText: string | null;
    width: number;
    height: number;
  } | null;
  price: { amount: string; currencyCode: string };
};

type MerchCollection = {
  title: string;
  href: string;
  products: MerchProduct[];
};

type CollectionPayload = {
  collection: {
    title: string;
    handle: string;
    products: {
      edges: {
        node: {
          id: string;
          handle: string;
          title: string;
          availableForSale: boolean;
          featuredImage: MerchProduct["image"];
          priceRange: { minVariantPrice: MerchProduct["price"] };
        };
      }[];
    };
  } | null;
};

const query = `
  query MerchCollection($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      title
      handle
      products(first: $first) {
        edges {
          node {
            id
            handle
            title
            availableForSale
            featuredImage { url altText width height }
            priceRange { minVariantPrice { amount currencyCode } }
          }
        }
      }
    }
  }
`;

const normalizeDomain = (domain: string) =>
  domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

/**
 * Returns the collection's in-stock products, or null when Shopify isn't
 * configured for this app or the collection doesn't exist yet. Request
 * failures are logged and also yield null: the merch strip is an add-on and
 * should never take the page down with it.
 */
const fetchMerchCollection = async (
  handle: string,
  first = 8,
): Promise<MerchCollection | null> => {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_API_TOKEN;
  if (!domain || !token) return null;

  try {
    const response = await fetch(
      `https://${normalizeDomain(domain)}/api/${API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": token,
        },
        body: JSON.stringify({ query, variables: { handle, first } }),
        next: { revalidate: REVALIDATE_SECONDS },
      },
    );

    if (!response.ok) {
      console.error(`Shopify merch request failed with ${response.status}`);
      return null;
    }

    const payload = (await response.json()) as {
      data?: CollectionPayload;
      errors?: unknown;
    };
    if (payload.errors) {
      console.error("Shopify merch request returned errors", payload.errors);
    }

    const collection = payload.data?.collection;
    if (!collection) return null;

    return {
      title: collection.title,
      href: `${STORE_URL}/collections/${collection.handle}`,
      products: collection.products.edges
        .map(({ node }) => node)
        .filter((node) => node.availableForSale)
        .map((node) => ({
          id: node.id,
          title: node.title,
          href: `${STORE_URL}/products/${node.handle}`,
          image: node.featuredImage,
          price: node.priceRange.minVariantPrice,
        })),
    };
  } catch (error) {
    console.error("Shopify merch request failed", error);
    return null;
  }
};

export { fetchMerchCollection };
export type { MerchCollection, MerchProduct };
