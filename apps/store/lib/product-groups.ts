import type { Product, ProductDesign, ProductListing } from "./types";

export type ProductGroup = {
  handle: string;
  title: string;
  description: string;
  tag: string;
  defaultDesign?: string;
  legacyDesignValues: Record<string, string>;
  legacyProductHandles: Record<string, string>;
};

type GroupableProduct = Pick<Product, "handle"> & { id?: string; tags?: string[] };

// These are storefront groupings. Shopify/Printful products and variant IDs stay separate.
export const productGroups: ProductGroup[] = [
  {
    handle: "nametag-shirt",
    title: "Nametag Shirt",
    description: "A familiar introduction, now in shirt form. Choose your nametag design, color, and size.",
    tag: "name tag",
    defaultDesign: "ryan",
    // Keep existing bookmarks and pre-tag cart data working. Membership comes from tags.
    legacyDesignValues: {
      "ryan-name-tag-shirt": "ryan",
      "ryans-mom-name-tag-shirt": "ryans-mom",
    },
    legacyProductHandles: {
      "ryans-mom-name-tag-shirt": "ryans-dad-name-tag-shirt",
    },
  },
];

export function getProductGroup(handle: string) {
  return productGroups.find((group) => group.handle === handle);
}

export function resolveProductHandle(handle: string) {
  const group = productGroups.find((group) => Object.hasOwn(group.legacyProductHandles, handle));
  return group?.legacyProductHandles[handle] ?? handle;
}

export function getProductGroupForMember(product: GroupableProduct) {
  return productGroups.find((group) => product.id !== `group:${group.handle}` && (
    product.tags
      ? product.tags.some((tag) => tag.trim().toLowerCase() === group.tag.toLowerCase())
      : Object.hasOwn(group.legacyDesignValues, product.handle)
        || Object.hasOwn(group.legacyProductHandles, product.handle)
        || Object.values(group.legacyProductHandles).includes(product.handle)
  ));
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
  const group = getProductGroup(handle);
  if (!group) return value;
  const legacyHandle = Object.entries(group.legacyDesignValues).find(([, legacyValue]) => legacyValue === value)?.[0];
  return getDesignValue(group, legacyHandle ?? value);
}

export function getListingHandles(products: GroupableProduct[]) {
  return [...new Set(products.map((product) => getProductGroupForMember(product)?.handle ?? product.handle))];
}

function getProductDesign(group: ProductGroup, product: Product): ProductDesign {
  const label = product.title
    .replace(/\bname[\s-]*tag\b/gi, "")
    .replace(/\b(?:t[\s-]?shirts?|shirts?|tees?)\b/gi, "")
    .replace(/^[\s:|–—-]+|[\s:|–—-]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/'/g, "’")
    .trim();
  return {
    label: label || product.title,
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
    title: group.title,
    description: group.description,
    descriptionHtml: `<p>${group.description}</p>`,
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
