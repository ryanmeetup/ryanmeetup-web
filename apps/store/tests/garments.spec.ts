import { expect, test } from "@playwright/test";
import { demoGarments as garments, findGarment, getGarment, getGarmentParams, getGarmentPath, sectionByGarment, toGarmentTable } from "../lib/garments";
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
  expect([tee, hoodie, activeHoodie, cap, beanie, youthHoodie, bodysuit, polo].map((item) => getGarment(garments, "apparel", item)?.handle)).toEqual(["t-shirts", "hoodies", "hoodies", "hats", "hats", "kids", "kids", undefined]);
  expect([flag, pin, card].map((item) => getGarment(garments, "accessories", item)?.handle)).toEqual(["flags", "pins", "ryd"]);
  expect(getGarment(garments, "all", tee)).toBeUndefined();
});

test("department sections follow t-shirts, hoodies, hats, then kids, keeping the given order inside each", () => {
  const grouped = sectionByGarment(garments, "apparel", [polo, cap, youthHoodie, hoodie, tee, beanie]);
  expect(grouped?.sections.map(({ collection, products }) => [collection.title, products.map(({ handle }) => handle)])).toEqual([
    ["T-Shirts", ["tee"]],
    ["Hoodies & Sweatshirts", ["hoodie"]],
    ["Hats", ["cap", "beanie"]],
    ["Kids", ["youth-hoodie"]],
  ]);
  expect(grouped?.more.map(({ handle }) => handle)).toEqual(["polo"]);
  expect(sectionByGarment(garments, "accessories", [flag, pin, card])?.sections.map(({ collection }) => collection.handle)).toEqual(["ryd", "pins", "flags"]);
  expect(sectionByGarment(garments, "i-heart-ry", [tee])).toBeNull();
});

test("every garment has its own page under its department", () => {
  expect(getGarmentParams(garments)).toContainEqual({ department: "apparel", garment: "hats" });
  expect(getGarmentParams(garments)).toContainEqual({ department: "accessories", garment: "flags" });
  expect(getGarmentPath({ handle: "kids" }, "apparel")).toBe("/apparel/kids");
  expect(findGarment(garments, "apparel", "flags")).toBeUndefined();
  // RY-Ds links directly to the membership site instead of a store page.
  expect(getGarmentPath(findGarment(garments, "accessories", "ryd")!, "accessories")).toBe("https://ryanmeetup.com/cards");
  expect(getGarmentParams(garments)).not.toContainEqual({ department: "accessories", garment: "ryd" });
});

test("Shopify store grouping entries become each department's groupings in position order", () => {
  const entry = (handle: string, values: Record<string, string>) => ({ handle, fields: Object.entries(values).map(([key, value]) => ({ key, value })) });
  const table = toGarmentTable([
    entry("hats", { title: "Hats", department: "apparel", position: "3", categories: JSON.stringify(["Hats"]) }),
    entry("kids", { title: "Kids", department: "Apparel", position: "1", categories: JSON.stringify(["Baby & Children's Clothing"]), match_first: "true" }),
    entry("ryd", { title: "RY-Ds", department: "accessories", description: " For Ryans. ", listings: JSON.stringify(["ryd"]), collection: "ryd" }),
    entry("no-title", { department: "apparel" }),
    entry("socks", { title: "Socks", department: "footwear" }),
    entry("bad-list", { title: "Bad list", department: "accessories", position: "2", categories: "not json" }),
  ]);
  expect(table).toEqual({
    apparel: [
      { handle: "kids", title: "Kids", description: "", categories: ["Baby & Children's Clothing"], matchFirst: true },
      { handle: "hats", title: "Hats", description: "", categories: ["Hats"] },
    ],
    accessories: [
      { handle: "bad-list", title: "Bad list", description: "", categories: [] },
      { handle: "ryd", title: "RY-Ds", description: "For Ryans.", categories: [], listings: ["ryd"], collection: "ryd" },
    ],
  });
  // A youth hoodie still lands in Kids when Kids comes from Shopify.
  expect(getGarment({ ...table, apparel: [...table.apparel, { handle: "hoodies", title: "Hoodies", description: "", categories: ["Hoodies"] }] }, "apparel", youthHoodie)?.handle).toBe("kids");
});
