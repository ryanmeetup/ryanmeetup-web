import { expect, test } from "@playwright/test";
import { parseSort, sortListings } from "../lib/sort";
import type { ProductListing } from "../lib/types";

const listing = (id: string, amount: string, createdAt?: string) => ({ id, createdAt, priceRange: { minVariantPrice: { amount, currencyCode: "USD" } } }) as ProductListing;
const listings = [listing("a", "20.00", "2026-01-01T00:00:00Z"), listing("b", "12.00"), listing("c", "30.00", "2026-03-01T00:00:00Z"), listing("d", "12.00", "2026-02-01T00:00:00Z")];
const ids = (items: ProductListing[]) => items.map((item) => item.id);

test("sorting keeps the featured order for ties and puts undated listings last under Newest", () => {
  expect(ids(sortListings(listings, "featured"))).toEqual(["a", "b", "c", "d"]);
  expect(ids(sortListings(listings, "newest"))).toEqual(["c", "d", "a", "b"]);
  expect(ids(sortListings(listings, "price-low"))).toEqual(["b", "d", "a", "c"]);
  expect(ids(sortListings(listings, "price-high"))).toEqual(["c", "a", "b", "d"]);
  expect(ids(listings)).toEqual(["a", "b", "c", "d"]);
});

test("an unknown sort falls back to featured", () => {
  expect(parseSort("price-low")).toBe("price-low");
  expect(parseSort("cheapest")).toBe("featured");
  expect(parseSort(null)).toBe("featured");
});
