import { departments, getCollectionPath } from "./catalog-collections";
import type { CollectionSection, CollectionSummary, ProductCategory, ProductListing } from "./types";

export type Garment = {
  /** Its own page under the department, such as `/apparel/hats`, and its anchor on the department page. */
  handle: string;
  title: string;
  description: string;
  /** Shopify standard-taxonomy names, matched against the category or any of its ancestors. */
  categories: string[];
  /** Listing handles placed here whatever their category, such as an external listing with none. */
  listings?: string[];
  /** A collection destination that stands in for this grouping's own page. */
  collection?: string;
  /** Claims a product before the department's other groupings, so a youth hoodie lands in Kids. */
  matchFirst?: boolean;
};

/** Each department's groupings in display order, keyed by department handle. */
export type GarmentTable = Record<string, Garment[]>;

// Groupings inside the Apparel and Accessories pages, built from each product's Shopify
// Category rather than Shopify collections, which are reserved for themes. The live store
// reads them from Shopify's "Store grouping" metaobjects (see `getGarments`); this table
// is the demo catalog's copy, used only when Shopify isn't configured. A product with no
// matching category falls under "More Ryan Goods".
export const demoGarments: GarmentTable = {
  apparel: [
    { handle: "t-shirts", title: "T-Shirts", description: "The everyday uniform.", categories: ["T-Shirts", "Shirts"] },
    { handle: "hoodies", title: "Hoodies & Sweatshirts", description: "Ryan pride for colder days.", categories: ["Hoodies", "Sweatshirts", "Activewear Sweatshirts & Hoodies"] },
    { handle: "hats", title: "Hats", description: "Caps and beanies for the top of your Ryan.", categories: ["Hats"] },
    { handle: "kids", title: "Kids", description: "Youth, toddler, and baby sizes for Ryans in training.", categories: ["Baby & Children's Clothing"], matchFirst: true },
  ],
  accessories: [
    { handle: "ryd", title: "RY-Ds", description: "Your official Ryan identification, made just for you.", categories: [], listings: ["ryd"], collection: "ryd" },
    { handle: "pins", title: "Pins", description: "Small, mighty, and very Ryan.", categories: ["Brooches & Lapel Pins", "Pinback Buttons"] },
    { handle: "bags", title: "Bags", description: "Carry your stuff and your name.", categories: ["Luggage & Bags"] },
    { handle: "mugs", title: "Mugs", description: "Morning coffee with name recognition.", categories: ["Drinkware"] },
    { handle: "home-goods", title: "Home Goods", description: "Ryan-proof your front door.", categories: ["Door Mats"] },
    { handle: "flags", title: "Flags", description: "Fly the official colors.", categories: ["Flags & Windsocks"] },
  ],
};

/** Shopify's metaobject type for a grouping; entries are edited under Content → Metaobjects. */
export const garmentMetaobjectType = "store_grouping";

export type GarmentMetaobject = { handle: string; fields: { key: string; value: string | null }[] };

function textList(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Shopify "Store grouping" entries as a garment table, ordered by their Position field and
 * then title. An entry without a title or with an unknown department is skipped.
 */
export function toGarmentTable(entries: GarmentMetaobject[]): GarmentTable {
  const table: GarmentTable = Object.fromEntries(departments.map(({ handle }) => [handle, []]));
  const rows = entries.flatMap(({ handle, fields }) => {
    const field = (key: string) => fields.find((entry) => entry.key === key)?.value?.trim() || undefined;
    const department = field("department")?.toLowerCase();
    const title = field("title");
    if (!department || !table[department] || !title) return [];
    const listings = textList(field("listings"));
    const garment: Garment = {
      handle,
      title,
      description: field("description") ?? "",
      categories: textList(field("categories")),
      ...(listings.length ? { listings } : {}),
      ...(field("collection") ? { collection: field("collection") } : {}),
      ...(field("match_first") === "true" ? { matchFirst: true } : {}),
    };
    const position = Number(field("position"));
    return [{ department, position: Number.isFinite(position) ? position : Infinity, garment }];
  });
  rows.sort((a, b) => a.position - b.position || a.garment.title.localeCompare(b.garment.title));
  for (const { department, garment } of rows) table[department].push(garment);
  return table;
}

export function findGarment(garments: GarmentTable, department: string, handle: string) {
  return garments[department]?.find((garment) => garment.handle === handle);
}

/** A garment's page under its department, or its collection destination, including external RY-Ds. */
export function getGarmentPath(garment: Pick<Garment, "handle" | "collection">, department: string) {
  return garment.collection ? getCollectionPath(garment.collection) : `/${department}/${garment.handle}`;
}

/** Every department and garment pair with a page of its own. */
export function getGarmentParams(garments: GarmentTable) {
  return Object.entries(garments).flatMap(([department, garments]) => garments.flatMap(({ handle: garment, collection }) => (collection ? [] : [{ department, garment }])));
}

/** A garment shown as a collection, for its page heading and a department section header. */
export function getGarmentSummary({ handle, title, description }: Garment): CollectionSummary {
  return { id: `garment:${handle}`, handle, title, description, image: null };
}

function categoryNames(category: ProductCategory | null | undefined) {
  return category ? [category.name, ...category.ancestors.map(({ name }) => name)] : [];
}

export function getGarment(table: GarmentTable, department: string, listing: Pick<ProductListing, "category" | "handle">) {
  const garments = table[department] ?? [];
  const named = garments.find((garment) => garment.listings?.includes(listing.handle));
  if (named) return named;
  const names = categoryNames(listing.category);
  const ordered = [...garments].sort((a, b) => Number(Boolean(b.matchFirst)) - Number(Boolean(a.matchFirst)));
  return ordered.find((garment) => garment.categories.some((name) => names.includes(name)));
}

/** A department's listings split into garment sections in display order, with `more` holding the rest. */
export function sectionByGarment(table: GarmentTable, department: string, listings: ProductListing[]) {
  const garments = table[department];
  if (!garments) return null;
  const sections: CollectionSection[] = garments.flatMap((garment) => {
    const products = listings.filter((listing) => getGarment(table, department, listing)?.handle === garment.handle);
    return products.length
      ? [{ collection: getGarmentSummary(garment), products, total: products.length, grouping: true }]
      : [];
  });
  return { sections, more: listings.filter((listing) => !getGarment(table, department, listing)) };
}
