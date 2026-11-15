import type { CollectionSection, CollectionSummary, ProductCategory, ProductListing } from "./types";

export type Garment = {
  /** Its own page under the department, such as `/collections/apparel/hats`, and its anchor on the department page. */
  handle: string;
  title: string;
  description: string;
  /** Shopify standard-taxonomy names, matched against the category or any of its ancestors. */
  categories: string[];
};

// Groupings inside the Apparel and Accessories pages, built from each product's Shopify
// Category rather than Shopify collections, which are reserved for themes. Listed in
// display order; a product with no matching category falls under "More Ryan goods".
export const garmentsByDepartment: Record<string, Garment[]> = {
  apparel: [
    { handle: "t-shirts", title: "T-shirts", description: "The everyday uniform.", categories: ["T-Shirts", "Shirts"] },
    { handle: "hoodies", title: "Hoodies & sweatshirts", description: "Ryan pride for colder days.", categories: ["Hoodies", "Sweatshirts", "Activewear Sweatshirts & Hoodies"] },
    { handle: "hats", title: "Hats", description: "Caps and beanies for the top of your Ryan.", categories: ["Hats"] },
    { handle: "kids", title: "Kids", description: "Youth, toddler, and baby sizes for Ryans in training.", categories: ["Baby & Children's Clothing"] },
  ],
  accessories: [
    { handle: "pins", title: "Pins", description: "Small, mighty, and very Ryan.", categories: ["Brooches & Lapel Pins", "Pinback Buttons"] },
    { handle: "bags", title: "Bags", description: "Carry your stuff and your name.", categories: ["Luggage & Bags"] },
    { handle: "mugs", title: "Mugs", description: "Morning coffee with name recognition.", categories: ["Drinkware"] },
    { handle: "home", title: "Home", description: "Ryan-proof your front door.", categories: ["Door Mats"] },
    { handle: "flags", title: "Flags", description: "Fly the official colors.", categories: ["Flags & Windsocks"] },
  ],
};

export function findGarment(department: string, handle: string) {
  return garmentsByDepartment[department]?.find((garment) => garment.handle === handle);
}

export function getGarmentPath(department: string, handle: string) {
  return `/collections/${department}/${handle}`;
}

/** Every department and garment pair that has a page. */
export function getGarmentParams() {
  return Object.entries(garmentsByDepartment).flatMap(([handle, garments]) => garments.map(({ handle: garment }) => ({ handle, garment })));
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

export function getGarment(department: string, listing: Pick<ProductListing, "category">) {
  const garments = garmentsByDepartment[department] ?? [];
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
