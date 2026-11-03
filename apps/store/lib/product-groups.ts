import type { Product, ProductDesign, ProductListing } from "./types";

export type ProductGroup = {
  handle: string;
  title: string;
  defaultDesign?: string;
  legacyDesignValues: Record<string, string>;
  legacyProductHandles: Record<string, string>;
};

type GroupableProduct = Pick<Product, "handle"> & { id?: string; tags?: string[] };

const listingTagPattern = /^\s*listing\s*:\s*(.+?)\s*$/i;

// Storefront listings come from Shopify tags: every product tagged `listing:Name` shares
// one listing titled "Name" at /products/<slug of Name>. Shopify/Printful products and
// variant IDs stay separate. Code keeps only a listing's default design and the
// links that predate its tag.
const listingRedirects: Record<string, Omit<ProductGroup, "handle" | "title">> = {
  "name-tag-shirt": {
    defaultDesign: "ryan",
    legacyDesignValues: {
      "ryan-name-tag-shirt": "ryan",
      "ryans-mom-name-tag-shirt": "ryans-mom",
    },
    legacyProductHandles: {
      "ryans-mom-name-tag-shirt": "ryans-dad-name-tag-shirt",
    },
  },
};

// Listing URLs that changed when the listing was renamed.
const legacyListingHandles: Record<string, string> = {
  "nametag-shirt": "name-tag-shirt",
};

export function resolveListingHandle(handle: string) {
  return legacyListingHandles[handle] ?? handle;
}

export function slugifyListingName(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function getListingTagName(tags: string[]) {
  for (const tag of tags) {
    const name = listingTagPattern.exec(tag)?.[1];
    if (name && slugifyListingName(name)) return name;
  }
  return undefined;
}

function createGroup(handle: string, title: string): ProductGroup {
  return { handle, title, ...(listingRedirects[handle] ?? { legacyDesignValues: {}, legacyProductHandles: {} }) };
}

function getLegacyGroup(handle: string) {
  return Object.hasOwn(listingRedirects, handle) ? createGroup(handle, handle) : undefined;
}

export function resolveProductHandle(handle: string) {
  for (const redirects of Object.values(listingRedirects)) {
    if (Object.hasOwn(redirects.legacyProductHandles, handle)) return redirects.legacyProductHandles[handle];
  }
  return handle;
}

export function getProductGroupForMember(product: GroupableProduct) {
  if (product.tags) {
    const name = getListingTagName(product.tags);
    if (!name) return undefined;
    const handle = slugifyListingName(name);
    return product.id === `group:${handle}` ? undefined : createGroup(handle, name);
  }
  // Cart lines saved before tags were stored carry only a handle.
  const legacy = Object.entries(listingRedirects).find(([, redirects]) =>
    Object.hasOwn(redirects.legacyDesignValues, product.handle)
      || Object.hasOwn(redirects.legacyProductHandles, product.handle)
      || Object.values(redirects.legacyProductHandles).includes(product.handle));
  return legacy ? createGroup(legacy[0], legacy[0]) : undefined;
}

export function getProductHref(product: GroupableProduct) {
  const group = getProductGroupForMember(product);
  return group
    ? `/products/${group.handle}?design=${encodeURIComponent(getDesignValue(group, product.handle))}`
    : `/products/${resolveProductHandle(product.handle)}`;
}

function getDesignValue(group: ProductGroup, handle: string) {
  const canonicalHandle = group.legacyProductHandles[handle] ?? handle;
  return Object.hasOwn(group.legacyDesignValues, canonicalHandle) ? group.legacyDesignValues[canonicalHandle] : canonicalHandle;
}

export function resolveProductDesignValue(handle: string, value: string) {
  const group = getLegacyGroup(handle);
  if (!group) return value;
  const legacyHandle = Object.entries(group.legacyDesignValues).find(([, legacyValue]) => legacyValue === value)?.[0];
  return getDesignValue(group, legacyHandle ?? value);
}

export function getListingHandles(products: GroupableProduct[]) {
  return [...new Set(products.map((product) => getProductGroupForMember(product)?.handle ?? product.handle))];
}

// The member's label is its title minus the listing name, so "I Heart RY Hoodie - White"
// in `listing:I Heart RY Hoodie` reads "White". Spacing, hyphens, and apostrophes may
// differ: "Ryan's Dad Name Tag shirt" in `listing:Name Tag Shirt` reads "Ryan’s Dad".
function getDesignLabel(group: ProductGroup, title: string) {
  // Only letters and digits survive, so the characters need no RegExp escaping.
  const characters = [...group.title.replace(/[^\p{L}\p{N}]/gu, "")];
  const name = new RegExp(characters.join("[\\s'’-]*"), "iu");
  return title
    .replace(name, "")
    .replace(/^[\s:|–—-]+|[\s:|–—-]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/'/g, "’")
    .trim()
    .replace(/^\p{Ll}/u, (letter) => letter.toUpperCase());
}

function getProductDesign(group: ProductGroup, product: Product): ProductDesign {
  return {
    label: getDesignLabel(group, product.title) || product.title,
    value: getDesignValue(group, product.handle),
    product,
  };
}

export function createProductGroup(group: ProductGroup, products: Product[]): ProductListing | null {
  const members = new Map<string, Product>();
  for (const product of products) {
    if (getProductGroupForMember(product)?.handle === group.handle && !members.has(product.handle)) members.set(product.handle, product);
  }
  const designs = [...members.values()].map((product) => getProductDesign(group, product)).sort((a, b) =>
    Number(b.value === group.defaultDesign) - Number(a.value === group.defaultDesign)
      || a.label.localeCompare(b.label) || a.value.localeCompare(b.value),
  );
  const first = designs[0]?.product;
  if (!first) return null;

  const variants = designs.flatMap(({ product }) => product.variants);
  const minimumPrice = variants.reduce(
    (minimum, variant) => Number(variant.price.amount) < Number(minimum.amount) ? variant.price : minimum,
    first.priceRange.minVariantPrice,
  );

  return {
    ...first,
    id: `group:${group.handle}`,
    handle: group.handle,
    // Members may spell the tag differently; the first design's spelling names the listing.
    title: getListingTagName(first.tags) ?? group.title,
    availableForSale: designs.some(({ product }) => product.availableForSale),
    images: designs.flatMap(({ product }) => product.images),
    options: [...new Set(designs.flatMap(({ product }) => product.options.map((option) => option.name)))].map((name) => ({
      id: `${group.handle}-${name}`,
      name,
      values: [...new Set(designs.flatMap(({ product }) => product.options.find((option) => option.name === name)?.values ?? []))],
    })),
    priceRange: { minVariantPrice: minimumPrice },
    priceVaries: variants.some((variant) => Number(variant.price.amount) !== Number(minimumPrice.amount)),
    tags: [...new Set(designs.flatMap(({ product }) => product.tags))],
    variants,
    designs,
  };
}

export function groupProductListings(products: Product[], relatedProducts: Product[] = []): ProductListing[] {
  const emitted = new Set<string>();
  return products.flatMap((product) => {
    const group = getProductGroupForMember(product);
    if (!group) return [product];
    if (emitted.has(group.handle)) return [];
    emitted.add(group.handle);
    const listing = createProductGroup(group, [...relatedProducts, ...products]);
    return listing ? [listing] : [];
  });
}
