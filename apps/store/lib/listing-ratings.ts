import type { ReviewSummary } from "@ryanmeetup/reviews";
import { numericProductId } from "./custom-reviews";
import { getReviewBackend } from "./review-backend";
import type { CatalogSections, ListingRating, ProductListing } from "./types";

/**
 * Cards show a rating only from this many published reviews. Below it, one
 * outlier moves the average too far: a single 1-star among 5-stars still
 * leaves five reviews at 4.2, where three would sink to 3.7.
 */
export const MIN_LISTING_RATING_REVIEWS = 5;

const SUMMARY_BATCH = 50;

/** A design group's card speaks for every design in it; anything else is one product. */
function reviewProductIds(listing: ProductListing) {
  const products = listing.designs?.map((design) => design.product) ?? [listing];
  return products.map((product) => numericProductId(product.id)).filter((id): id is string => id !== null);
}

/** Pools per-product totals into one rating, or null while there are too few to trust. */
export function poolListingRating(summaries: (ReviewSummary | undefined)[]): ListingRating | null {
  let count = 0;
  let total = 0;
  for (const summary of summaries) {
    if (!summary) continue;
    count += summary.count;
    total += summary.average * summary.count;
  }
  return count >= MIN_LISTING_RATING_REVIEWS ? { average: total / count, count } : null;
}

type Catalog = { products: ProductListing[] } & Partial<CatalogSections>;

/**
 * Adds a rating to every listing with enough published reviews, across the
 * catalog's products, sections, and leftovers alike. Reviews are a garnish
 * here: if they can't be read, the catalog comes back unchanged.
 */
export async function withListingRatings<T extends Catalog>(catalog: T, backend = getReviewBackend()): Promise<T> {
  if (!backend) return catalog;
  const listings = [...catalog.products, ...(catalog.sections ?? []).flatMap((section) => section.products), ...(catalog.more ?? [])];
  const ids = [...new Set(listings.flatMap(reviewProductIds))];
  if (!ids.length) return catalog;
  let summaries: Record<string, ReviewSummary>;
  try {
    const batches = Array.from({ length: Math.ceil(ids.length / SUMMARY_BATCH) }, (_, index) => ids.slice(index * SUMMARY_BATCH, (index + 1) * SUMMARY_BATCH));
    summaries = Object.assign({}, ...await Promise.all(batches.map((productIds) => backend({ operation: "reviews.summaries", productIds }))));
  } catch {
    return catalog;
  }
  const rate = (listing: ProductListing): ProductListing => {
    const rating = poolListingRating(reviewProductIds(listing).map((id) => summaries[id]));
    return rating ? { ...listing, rating } : listing;
  };
  return {
    ...catalog,
    products: catalog.products.map(rate),
    ...(catalog.sections && { sections: catalog.sections.map((section) => ({ ...section, products: section.products.map(rate) })) }),
    ...(catalog.more && { more: catalog.more.map(rate) }),
  };
}
