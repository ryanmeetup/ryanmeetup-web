import { getCollectionPath } from "./catalog-collections";
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
};

// Groupings inside the Apparel and Accessories pages, built from each product's Shopify
// Category rather than Shopify collections, which are reserved for themes. Listed in
// display order; a product with no matching category falls under "More Ryan Goods".
export const garmentsByDepartment: Record<string, Garment[]> = {
  apparel: [
    { handle: "t-shirts", title: "T-Shirts", description: "The everyday uniform.", categories: ["T-Shirts", "Shirts"] },
    { handle: "hoodies", title: "Hoodies & Sweatshirts", description: "Ryan pride for colder days.", categories: ["Hoodies", "Sweatshirts", "Activewear Sweatshirts & Hoodies"] },
    { handle: "hats", title: "Hats", description: "Caps and beanies for the top of your Ryan.", categories: ["Hats"] },
    { handle: "kids", title: "Kids", description: "Youth, toddler, and baby sizes for Ryans in training.", categories: ["Baby & Children's Clothing"] },
  ],
  accessories: [
    { handle: "ryd", title: "RY-Ds", description: "Your official Ryan identification, made just for you.", categories: [], listings: ["ryd"], collection: "ryd" },
    { handle: "pins", title: "Pins", description: "Lapel pins and buttons.", categories: ["Brooches & Lapel Pins", "Pinback Buttons"] },
    { handle: "bags", title: "Bags", description: "Carry your stuff and your name.", categories: ["Luggage & Bags"] },
    { handle: "mugs", title: "Mugs", description: "Morning coffee with name recognition.", categories: ["Drinkware"] },
    { handle: "home-goods", title: "Home Goods", description: "Ryan-proof your front door.", categories: ["Door Mats"] },
    { handle: "flags", title: "Flags", description: "Fly the official colors.", categories: ["Flags & Windsocks"] },
  ],
};

export function findGarment(department: string, handle: string) {
  return garmentsByDepartment[department]?.find((garment) => garment.handle === handle);
}

/** A garment's page under its department, or its collection destination, including external RY-Ds. */
export function getGarmentPath(department: string, handle: string) {
  const collection = findGarment(department, handle)?.collection;
  return collection ? getCollectionPath(collection) : `/${department}/${handle}`;
}

/** Every department and garment pair with a page of its own. */
export function getGarmentParams() {
  return Object.entries(garmentsByDepartment).flatMap(([department, garments]) => garments.flatMap(({ handle: garment, collection }) => (collection ? [] : [{ department, garment }])));
}

/** A garment shown as a collection, for its page heading and a department section header. */
export function getGarmentSummary({ handle, title, description }: Garment): CollectionSummary {
  return { id: `garment:${handle}`, handle, title, description, image: null };
}

// Kids wins over the garment itself, so a youth hoodie lands in Kids rather than Hoodies.
const matchPriority = ["kids"];

function categoryNames(category: ProductCategory | null | undefined) {
  return category ? [category.name, ...category.ancestors.map(({ name }) => name)] : [];
}

export function getGarment(department: string, listing: Pick<ProductListing, "category" | "handle">) {
  const garments = garmentsByDepartment[department] ?? [];
  const named = garments.find((garment) => garment.listings?.includes(listing.handle));
  if (named) return named;
  const names = categoryNames(listing.category);
  const ordered = [...garments].sort((a, b) => Number(matchPriority.includes(b.handle)) - Number(matchPriority.includes(a.handle)));
  return ordered.find((garment) => garment.categories.some((name) => names.includes(name)));
}

/** A department's listings split into garment sections in display order, with `more` holding the rest. */
export function sectionByGarment(department: string, listings: ProductListing[]) {
  const garments = garmentsByDepartment[department];
  if (!garments) return null;
  const sections: CollectionSection[] = garments.flatMap((garment) => {
    const products = listings.filter((listing) => getGarment(department, listing)?.handle === garment.handle);
    return products.length
      ? [{ collection: getGarmentSummary(garment), products, total: products.length, grouping: true }]
      : [];
  });
  return { sections, more: listings.filter((listing) => !getGarment(department, listing)) };
}
