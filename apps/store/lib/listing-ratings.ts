import type { ReviewSummary } from "@ryanmeetup/reviews";
import { numericProductId } from "./custom-reviews";
import { MIN_LISTING_RATING_REVIEWS } from "./rating-threshold";
import { getReviewBackend } from "./review-backend";
import type { CatalogSections, ListingRating, ProductListing } from "./types";

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
 * Adds a rating to every listing with enough published reviews, and marks
 * listings confirmed to have none, across the catalog's products, sections,
 * and leftovers alike. Reviews are a garnish here: if they can't be read, the
 * catalog comes back unchanged, so a missing read never claims "no reviews".
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
    const listingSummaries = reviewProductIds(listing).map((id) => summaries[id]);
    // A count is only claimed when every design's reviews were read.
    const read = listingSummaries.length > 0 && listingSummaries.every(Boolean);
    const counted = read ? { reviewCount: listingSummaries.reduce((sum, summary) => sum + (summary?.count ?? 0), 0) } : {};
    const rating = poolListingRating(listingSummaries);
    if (rating) return { ...listing, rating, ...counted };
    return counted.reviewCount === 0 ? { ...listing, unreviewed: true, ...counted } : { ...listing, ...counted };
  };
  return {
    ...catalog,
    products: catalog.products.map(rate),
    ...(catalog.sections && { sections: catalog.sections.map((section) => ({ ...section, products: section.products.map(rate) })) }),
    ...(catalog.more && { more: catalog.more.map(rate) }),
  };
}
