import type { ProductListing } from "./types";

// Readable `?sort=` values; `featured` keeps Shopify's own order.
export const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-low", label: "Price: low to high" },
  { value: "price-high", label: "Price: high to low" },
] as const;

export type SortOrder = (typeof sortOptions)[number]["value"];

export const defaultSort: SortOrder = "featured";

/** An unknown or missing `?sort=` falls back to the featured order. */
export function parseSort(value: string | null | undefined): SortOrder {
  return sortOptions.find((option) => option.value === value)?.value ?? defaultSort;
}

const price = (listing: ProductListing) => Number(listing.priceRange.minVariantPrice.amount);

/** A sorted copy. Ties keep the featured order, and listings without a date sort last under Newest. */
export function sortListings(listings: ProductListing[], order: SortOrder) {
  if (order === "featured") return listings;
  const compare: Record<Exclude<SortOrder, "featured">, (a: ProductListing, b: ProductListing) => number> = {
    newest: (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
    "price-low": (a, b) => price(a) - price(b),
    "price-high": (a, b) => price(b) - price(a),
  };
  return [...listings].sort(compare[order]);
}
