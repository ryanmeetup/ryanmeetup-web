import type { ProductListing } from "./types";

/** How many listings the product page's "More from this shop" row shows. */
export const RELATED_LISTINGS_LIMIT = 4;

/** The Shopify product handles behind a listing: every design of a grouped listing, or the product itself. */
export function getListingMemberHandles(listing: Pick<ProductListing, "handle" | "designs">) {
  return listing.designs?.map((design) => design.product.handle) ?? [listing.handle];
}

/**
 * Other listings worth showing beside `current`, most relevant first:
 * Shopify's own related-product picks, then listings sharing one of its
 * collections, then listings of the same product type. Each tier keeps the
 * catalog's order (best selling). Shopify recommends products, not listings,
 * so a grouped listing's sibling designs collapse into the listing they
 * belong to, and the current listing never recommends itself. Only listings
 * a shopper can add to the cart here are offered.
 */
export function pickRelatedListings(
  current: ProductListing,
  catalog: ProductListing[],
  { recommended = [], collections = [], limit = RELATED_LISTINGS_LIMIT }: {
    /** Shopify product handles in its recommended order. */
    recommended?: string[];
    /** Member handles of each collection `current` belongs to. */
    collections?: string[][];
    limit?: number;
  } = {},
) {
  const own = new Set(getListingMemberHandles(current));
  const candidates = catalog.filter((listing) => listing.id !== current.id
    && listing.availableForSale
    && !listing.externalUrl
    && !getListingMemberHandles(listing).some((handle) => own.has(handle)));
  const byHandle = new Map(candidates.flatMap((listing) => getListingMemberHandles(listing).map((handle) => [handle, listing] as const)));
  const shared = new Set(collections.filter((handles) => handles.some((handle) => own.has(handle))).flat());

  const picks = new Set<ProductListing>();
  const add = (listing: ProductListing | undefined) => {
    if (listing && picks.size < limit) picks.add(listing);
  };
  for (const handle of recommended) add(byHandle.get(handle));
  for (const listing of candidates) if (getListingMemberHandles(listing).some((handle) => shared.has(handle))) add(listing);
  if (current.productType) for (const listing of candidates) if (listing.productType === current.productType) add(listing);
  return [...picks];
}
