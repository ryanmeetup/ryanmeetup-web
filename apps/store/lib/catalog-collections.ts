import type { CollectionSummary, Product } from "./types";

export type CatalogCollection = CollectionSummary & {
  /** Shopify Product type that fills the page; `null` lists every product. */
  productType: string | null;
  /** A department lives at the top level, as in `/apparel`, rather than under `/collections`. */
  department?: true;
};

// Browsing pages built from Shopify's Product type rather than Shopify collections,
// so a product lands on the right page as soon as its type is set. A Shopify
// collection with one of these handles is shadowed by the definition here.
export const catalogCollections: CatalogCollection[] = [
  {
    id: "catalog:all",
    handle: "all",
    title: "Collections",
    description: "Official issue for Ryans, friends of Ryans, and the Ryan-curious.",
    image: null,
    productType: null,
  },
  {
    id: "catalog:apparel",
    handle: "apparel",
    title: "Apparel",
    description: "Wear your first name on your sleeve. Sometimes literally.",
    image: null,
    productType: "Apparel",
    department: true,
  },
  {
    id: "catalog:accessories",
    handle: "accessories",
    title: "Accessories",
    description: "Useful objects with excellent name recognition.",
    image: null,
    productType: "Accessory",
    department: true,
  },
];

export function getCatalogCollection(handle: string) {
  return catalogCollections.find((collection) => collection.handle === handle);
}

/** Apparel and Accessories, the departments with top-level pages. */
export const departments = catalogCollections.filter((collection) => collection.department);

export function isDepartment(handle: string) {
  return departments.some((collection) => collection.handle === handle);
}

/** Departments and themes live in the store; RY-Ds goes straight to the membership site. */
export function getCollectionPath(handle: string) {
  if (handle === "ryd") return "https://ryanmeetup.com/cards";
  return isDepartment(handle) ? `/${handle}` : `/collections/${handle}`;
}

export function getCatalogCollectionSummary({ id, handle, title, description, image }: CatalogCollection): CollectionSummary {
  return { id, handle, title, description, image };
}

export function getCatalogProductQuery(collection: CatalogCollection) {
  return collection.productType ? `product_type:${JSON.stringify(collection.productType)}` : null;
}

export function isInCatalogCollection(collection: CatalogCollection, product: Pick<Product, "productType">) {
  return collection.productType === null || product.productType === collection.productType;
}

/** The typed catalog page a product belongs under, such as Apparel for a shirt. */
export function getProductTypeCollection(product: Pick<Product, "productType">) {
  return catalogCollections.find((collection) => collection.productType !== null && isInCatalogCollection(collection, product));
}

/** A collection's title as a section heading, so "I ❤️ RY" reads as "I ❤️ RY Collection". */
export function collectionHeading(title: string) {
  return /\bcollection$/i.test(title.trim()) ? title : `${title} Collection`;
}
