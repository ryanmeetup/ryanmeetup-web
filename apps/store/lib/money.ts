import type { Money, ProductVariant } from "./types";

export function formatMoney(money: Money) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: money.currencyCode,
  }).format(Number(money.amount));
}

/** The variant's original price when Shopify marks it down, otherwise null. */
export function getCompareAtPrice(variant: Pick<ProductVariant, "price" | "compareAtPrice">) {
  const compareAt = variant.compareAtPrice;
  return compareAt && Number(compareAt.amount) > Number(variant.price.amount) ? compareAt : null;
}

/**
 * Whether any variant of a listing is marked down, and the original price to strike
 * through beside the listing's lowest price when a variant at that price is on sale.
 */
export function getListingSale(listing: { priceRange: { minVariantPrice: Money }; variants: Pick<ProductVariant, "price" | "compareAtPrice">[] }) {
  const lowest = Number(listing.priceRange.minVariantPrice.amount);
  const compareAt = listing.variants
    .filter((variant) => Number(variant.price.amount) === lowest)
    .map(getCompareAtPrice)
    .reduce<Money | null>((highest, price) => price && (!highest || Number(price.amount) > Number(highest.amount)) ? price : highest, null);
  return { onSale: listing.variants.some((variant) => getCompareAtPrice(variant)), compareAt };
}
