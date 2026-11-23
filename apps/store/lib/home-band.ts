import type { ReviewSummary } from "@ryanmeetup/reviews";
import { MIN_LISTING_RATING_REVIEWS } from "./listing-ratings";
import { describeShippingRegions, getProductionTime } from "./product-guidance";
import type { ShopPolicy } from "./types";
import type { Promotion } from "./promotion";

/**
 * The shop-wide rating in a few words, or null while there are too few reviews to trust it
 * (the same floor product cards use) or the read failed.
 */
export function describeShopRating(summary: Pick<ReviewSummary, "average" | "count"> | null) {
  if (!summary || summary.count < MIN_LISTING_RATING_REVIEWS) return null;
  return `${summary.average.toFixed(1)} stars from ${summary.count.toLocaleString("en-US")} reviews`;
}

/** The support card's point in one phrase, for phones, where the band stands in for it. */
export const SUPPORT_PHRASE = "Every order helps fund Ryan Meetup";

/**
 * What the band under the home hero says on phones, in place of the support and shipping cards:
 * why to buy, the rating, then how long it takes and where it ships. The timing and countries
 * come from the shipping policy and checkout; a fact that is missing is left out, except that
 * every item is made to order.
 */
export function getHomeBandFacts(summary: Pick<ReviewSummary, "average" | "count"> | null, policies: ShopPolicy[], countries: string[]) {
  const days = getProductionTime(policies);
  return [
    SUPPORT_PHRASE,
    describeShopRating(summary),
    days ? `Made to order in ${days}` : "Made to order",
    describeShippingRegions(countries),
  ].filter((fact): fact is string => fact !== null);
}

/**
 * The band's run: a regular sale's name, best discount, and last day up front, then the facts.
 * A takeover sale is left out because its hero already says it. Every phrase is real
 * information, and the support phrase is always among the facts, so the run is never empty.
 */
export function buildHomeBand(promotion: Promotion | null, facts: string[]) {
  const sale = promotion && !promotion.takeover
    ? [promotion.name, `Up to ${Math.max(...promotion.tiers.map(({ percentOff }) => percentOff))}% off`, `Ends ${promotion.endsLabel}`]
    : [];
  return [...sale, ...facts];
}
