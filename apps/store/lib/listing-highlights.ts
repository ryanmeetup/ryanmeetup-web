import type { CatalogSections, ProductListing } from "./types";

/**
 * Earned labels for listings people are buying, adding to carts, or rating highly, and
 * rounded milestones for the product page. Every one comes from real activity or reviews
 * and clears a floor first, so a quiet listing shows nothing rather than a small number.
 * Client-safe: cards import the labels, and the server attaches the highlight.
 */

export type ListingHighlight = "best-seller" | "trending" | "hot" | "top-rated" | "new";

/** Read-only labels, so they may be uppercase on screen; the source stays sentence case. */
export const highlightLabels: Record<ListingHighlight, string> = {
  "best-seller": "Best seller",
  trending: "Trending",
  hot: "Hot right now",
  "top-rated": "Top rated",
  new: "New",
};

/** Per-product totals from `store_product_activity_summary`. */
export type ProductActivity = {
  sold30: number;
  sold7: number;
  soldPrior7: number;
  soldInSale: number;
  /** Distinct carts that added the product. */
  carts24h: number;
  carts7: number;
};

export const highlightRules = {
  /** The top sellers by units over 30 days, each with at least `minUnits`. */
  bestSeller: { top: 5, minUnits: 5 },
  /** Units this week at least `minUnits` and at least `ratio` times the week before. */
  trending: { minUnits: 4, ratio: 2 },
  /** Distinct carts in the last 24 hours. */
  hot: { minCarts: 5 },
  /** The listing's pooled rating, which cards only show from five reviews. */
  topRated: { minAverage: 4.8 },
  /**
   * The launch catalog was created through November 13, 2026, all at once, so only
   * products added after it are new drops. Each stays new for `days`.
   */
  new: { after: "2026-11-14T00:00:00-05:00", days: 30 },
};

/** Milestones round down to these, so a figure is always true and never small. */
const milestoneSteps = [10, 25, 50, 100, 250, 500, 1000];

/** The largest step at or below `count`, or null below the first. */
export function roundMilestone(count: number) {
  return milestoneSteps.filter((step) => count >= step).at(-1) ?? null;
}

/** A Shopify GID's numeric ID, as activity is stored. Kept here so cards stay free of server code. */
const numericProductId = (gid: string) => {
  const id = gid.split("/").at(-1) ?? "";
  return /^[1-9][0-9]{0,19}$/.test(id) ? id : null;
};

const designProducts = (listing: ProductListing) => listing.designs?.map((design) => design.product) ?? [listing];

/** A design group's figures pool every design in it. */
export function poolListingActivity(listing: ProductListing, activity: Record<string, ProductActivity>): ProductActivity | null {
  const entries = designProducts(listing).map((product) => activity[numericProductId(product.id) ?? ""]).filter((entry): entry is ProductActivity => Boolean(entry));
  if (!entries.length) return null;
  return entries.reduce((sum, entry) => ({
    sold30: sum.sold30 + entry.sold30, sold7: sum.sold7 + entry.sold7, soldPrior7: sum.soldPrior7 + entry.soldPrior7,
    soldInSale: sum.soldInSale + entry.soldInSale, carts24h: sum.carts24h + entry.carts24h, carts7: sum.carts7 + entry.carts7,
  }));
}

/** Shop-wide best sellers by numeric product ID, ranked across every product with activity. */
export function rankBestSellers(activity: Record<string, ProductActivity>) {
  const { top, minUnits } = highlightRules.bestSeller;
  return new Set(Object.entries(activity).filter(([, entry]) => entry.sold30 >= minUnits)
    .sort(([, a], [, b]) => b.sold30 - a.sold30).slice(0, top).map(([id]) => id));
}

/**
 * The one label a listing earns, strongest first: what sells, then what's moving, then
 * what's loved, then what's new. Sold-out and off-Shopify listings earn none.
 */
export function pickListingHighlight(listing: ProductListing, activity: Record<string, ProductActivity> | null, bestSellers: Set<string>, now: number): ListingHighlight | null {
  if (!listing.availableForSale || listing.externalUrl) return null;
  const pooled = activity ? poolListingActivity(listing, activity) : null;
  if (designProducts(listing).some((product) => bestSellers.has(numericProductId(product.id) ?? ""))) return "best-seller";
  if (pooled && pooled.sold7 >= highlightRules.trending.minUnits && pooled.sold7 >= highlightRules.trending.ratio * pooled.soldPrior7) return "trending";
  if (pooled && pooled.carts24h >= highlightRules.hot.minCarts) return "hot";
  if (listing.rating && listing.rating.average >= highlightRules.topRated.minAverage) return "top-rated";
  const after = Date.parse(highlightRules.new.after);
  const newest = Math.max(...designProducts(listing).map((product) => product.createdAt ? Date.parse(product.createdAt) : Number.NaN).filter((time) => !Number.isNaN(time)));
  if (newest >= after && now - newest <= highlightRules.new.days * 86_400_000) return "new";
  return null;
}

type Catalog = { products: ProductListing[] } & Partial<CatalogSections>;

/** Adds `highlight` to every listing that earns one, across products, sections and leftovers. */
export function applyListingHighlights<T extends Catalog>(catalog: T, activity: Record<string, ProductActivity> | null, now: number): T {
  const bestSellers = activity ? rankBestSellers(activity) : new Set<string>();
  const decided = new Map<ProductListing, ProductListing>();
  const mark = (listing: ProductListing) => {
    let result = decided.get(listing);
    if (!result) {
      const highlight = pickListingHighlight(listing, activity, bestSellers, now);
      decided.set(listing, (result = highlight ? { ...listing, highlight } : listing));
    }
    return result;
  };
  return {
    ...catalog,
    products: catalog.products.map(mark),
    ...(catalog.sections && { sections: catalog.sections.map((section) => ({ ...section, products: section.products.map(mark) })) }),
    ...(catalog.more && { more: catalog.more.map(mark) }),
  };
}

/**
 * The product page's one rounded figure, or null below every floor: units sold during the
 * running sale, then this month, then carts this week.
 */
export function describeListingMilestone(activity: ProductActivity | null, saleName: string | null) {
  if (!activity) return null;
  const inSale = saleName ? roundMilestone(activity.soldInSale) : null;
  if (inSale) return `${inSale}+ sold during ${saleName}`;
  const month = roundMilestone(activity.sold30);
  if (month) return `${month}+ sold this month`;
  const carts = roundMilestone(activity.carts7);
  return carts ? `In ${carts}+ carts this week` : null;
}
