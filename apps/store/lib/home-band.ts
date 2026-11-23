import type { ReviewSummary } from "@ryanmeetup/reviews";
import { MIN_LISTING_RATING_REVIEWS } from "./listing-ratings";
import type { ShippingExpectation } from "./product-guidance";
import type { Promotion } from "./promotion";

const NAME = "Ryan";

/**
 * The shop-wide rating in a few words, or null while there are too few reviews to trust it
 * (the same floor product cards use) or the read failed.
 */
export function describeShopRating(summary: Pick<ReviewSummary, "average" | "count"> | null) {
  if (!summary || summary.count < MIN_LISTING_RATING_REVIEWS) return null;
  return `${summary.average.toFixed(1)} stars from ${summary.count.toLocaleString("en-US")} reviews`;
}

/**
 * What the band under the home hero can say about every order: the rating first, then the
 * headline shipping facts. Tracking is left to the shipping strip; the band keeps to the two
 * facts a shopper weighs before opening a product.
 */
export function getHomeBandFacts(summary: Pick<ReviewSummary, "average" | "count"> | null, shipping: ShippingExpectation[]) {
  const rating = describeShopRating(summary);
  const facts = shipping.filter(({ id }) => id === "production" || id === "countries").map(({ title }) => title);
  return rating ? [rating, ...facts] : facts;
}

/**
 * The band's run: a regular sale's name, best discount, and last day up front, then the name
 * between each fact, so it still reads as the name band at a glance. A takeover sale is left
 * out because its hero already says it. Screen readers get the phrases without the name.
 */
export function buildHomeBand(promotion: Promotion | null, facts: string[]) {
  const sale = promotion && !promotion.takeover
    ? [promotion.name, `Up to ${Math.max(...promotion.tiers.map(({ percentOff }) => percentOff))}% off`, `Ends ${promotion.endsLabel}`]
    : [];
  const spoken = [...sale, ...facts];
  if (!spoken.length) return { items: [NAME], spoken };
  return { items: [...sale, ...facts.flatMap((fact) => [NAME, fact])], spoken };
}
