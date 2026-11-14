import { expect, test } from "@playwright/test";
import { parseSort, recommendListings, sortListings } from "../lib/sort";
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

test("apparel puts shirts, hoodies, and hats before other goods, and flags last", () => {
  const apparel = ["Ryan Flag", "Ryan Socks", "Ryan Cap", "Ryan Hoodie", "Ryan T-shirt", "Ryan Tee", "Ryan Sweatshirt"]
    .map((title, index) => ({ ...listing(String(index), "20"), title, handle: String(index), tags: [] }));
  expect(recommendListings(apparel, [], true).map(({ title }) => title)).toEqual([
    "Ryan T-shirt", "Ryan Tee", "Ryan Hoodie", "Ryan Sweatshirt", "Ryan Cap", "Ryan Socks", "Ryan Flag",
  ]);
  expect(apparel[0].title).toBe("Ryan Flag");
});

test("popular grouped listings lead apparel while other sorts still override recommendations", () => {
  const tee = { ...listing("tee", "20"), title: "Ryan Tee", handle: "tee", tags: [] };
  const hoodie = { ...listing("hoodie", "30"), title: "Ryan Hoodie", handle: "hoodie", tags: [], designs: [{ label: "Ryan", value: "ryan", product: { ...tee, handle: "popular-hoodie" } }] };
  const recommended = recommendListings([tee, hoodie], ["popular-hoodie"], true);
  expect(ids(recommended)).toEqual(["hoodie", "tee"]);
  expect(ids(sortListings(recommended, "price-low"))).toEqual(["tee", "hoodie"]);
});
