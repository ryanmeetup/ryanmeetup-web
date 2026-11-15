import type { ProductListing } from "./types";

// Readable `?sort=` values; `featured` keeps the server's recommended order.
export const sortOptions = [
  { value: "featured", label: "Recommended" },
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

/** Hand-picked best sellers lead, with sales order breaking ties. */
export function recommendListings(listings: ProductListing[], popularHandles: string[] = []) {
  const positions = new Map(popularHandles.map((handle, index) => [handle, index]));
  const rank = (listing: ProductListing) => Math.min(
    ...[listing.handle, ...(listing.designs?.map(({ product }) => product.handle) ?? [])]
      .map((handle) => positions.get(handle) ?? popularHandles.length),
  );
  return [...listings].sort((a, b) => rank(a) - rank(b));
}

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
