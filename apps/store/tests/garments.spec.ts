import { expect, test } from "@playwright/test";
import { findGarment, getGarment, getGarmentParams, getGarmentPath, sectionByGarment } from "../lib/garments";
import type { ProductListing } from "../lib/types";

// Category paths as Shopify's standard taxonomy reports them for the live catalog.
const listing = (handle: string, path: string[]) => ({ id: handle, handle, category: path.length ? { name: path[0], ancestors: path.slice(1).map((name) => ({ name })) } : null }) as ProductListing;
const tee = listing("tee", ["T-Shirts", "Clothing Tops", "Clothing", "Apparel & Accessories"]);
const hoodie = listing("hoodie", ["Hoodies", "Clothing Tops", "Clothing", "Apparel & Accessories"]);
const activeHoodie = listing("active-hoodie", ["Hoodies", "Activewear Sweatshirts & Hoodies", "Activewear", "Clothing", "Apparel & Accessories"]);
const cap = listing("cap", ["Baseball Caps", "Hats", "Clothing Accessories", "Apparel & Accessories"]);
const beanie = listing("beanie", ["Beanies", "Hats", "Clothing Accessories", "Apparel & Accessories"]);
const youthHoodie = listing("youth-hoodie", ["Hoodies", "Baby & Children's Tops", "Baby & Children's Clothing", "Clothing", "Apparel & Accessories"]);
const bodysuit = listing("bodysuit", ["Baby & Children's One-Pieces", "Baby & Children's Clothing", "Clothing", "Apparel & Accessories"]);
const polo = listing("polo", ["Polos", "Clothing Tops", "Clothing", "Apparel & Accessories"]);
const flag = listing("flag", ["Decorative Flags", "Flags & Windsocks", "Decor", "Home & Garden"]);
const pin = listing("pin", ["Pinback Buttons", "Clothing Accessories", "Apparel & Accessories"]);
const card = listing("ryd", []);

test("garments come from the category or any ancestor, with kids sizes ahead of the garment", () => {
  expect([tee, hoodie, activeHoodie, cap, beanie, youthHoodie, bodysuit, polo].map((item) => getGarment("apparel", item)?.handle)).toEqual(["t-shirts", "hoodies", "hoodies", "hats", "hats", "kids", "kids", undefined]);
  expect([flag, pin, card].map((item) => getGarment("accessories", item)?.handle)).toEqual(["flags", "pins", "ryd"]);
  expect(getGarment("all", tee)).toBeUndefined();
});

test("department sections follow t-shirts, hoodies, hats, then kids, keeping the given order inside each", () => {
  const grouped = sectionByGarment("apparel", [polo, cap, youthHoodie, hoodie, tee, beanie]);
  expect(grouped?.sections.map(({ collection, products }) => [collection.title, products.map(({ handle }) => handle)])).toEqual([
    ["T-Shirts", ["tee"]],
    ["Hoodies & Sweatshirts", ["hoodie"]],
    ["Hats", ["cap", "beanie"]],
    ["Kids", ["youth-hoodie"]],
  ]);
  expect(grouped?.more.map(({ handle }) => handle)).toEqual(["polo"]);
  expect(sectionByGarment("accessories", [flag, pin, card])?.sections.map(({ collection }) => collection.handle)).toEqual(["ryd", "pins", "flags"]);
  expect(sectionByGarment("i-heart-ry", [tee])).toBeNull();
});

test("every garment has its own page under its department", () => {
  expect(getGarmentParams()).toContainEqual({ department: "apparel", garment: "hats" });
  expect(getGarmentParams()).toContainEqual({ department: "accessories", garment: "flags" });
  expect(getGarmentPath("apparel", "kids")).toBe("/apparel/kids");
  expect(findGarment("apparel", "flags")).toBeUndefined();
  // RY-Ds links directly to the membership site instead of a store page.
  expect(getGarmentPath("accessories", "ryd")).toBe("https://ryanmeetup.com/cards");
  expect(getGarmentParams()).not.toContainEqual({ department: "accessories", garment: "ryd" });
});
