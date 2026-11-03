import type { Product, ProductListing, StoreImage } from "./types";

export type ColorPreview = {
  value: string;
  slug: string;
  image: StoreImage;
  swatch: string | null;
};

type ProductColorOption = Omit<ColorPreview, "image"> & { image: StoreImage | null };

export type ListingColorPreview = ProductColorOption & { href: string; label?: string };

// Shopify swatches win when they are set in Admin. These cover the Printful
// colors the catalog uses today when Shopify has no swatch configured.
const fallbackSwatches: Record<string, string> = {
  black: "#111111",
  cream: "#f3ead8",
  "dark-chocolate": "#382d29",
  "forest-green": "#273b33",
  gold: "#ffcc00",
  maroon: "#5b1a2a",
  "military-green": "#4b5132",
  natural: "#eee6d3",
  navy: "#1f2a44",
  red: "#c8102e",
  royal: "#2b48a4",
  sand: "#d6cdbb",
  sapphire: "#007ead",
  "steel-grey": "#6e7378",
  white: "#ffffff",
};

export function getColorSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function getColorOption(product: Pick<Product, "options">) {
  return product.options.find((option) => /^colou?r$/i.test(option.name.trim()))
    ?? product.options.find((option) => option.optionValues?.some((value) => value.swatch?.color));
}

function getProductColorOptions(product: Pick<Product, "options" | "variants">): ProductColorOption[] {
  const option = getColorOption(product);
  if (!option) return [];
  return option.values.flatMap((value) => {
    const variants = product.variants.filter((variant) => variant.image && variant.selectedOptions.some((selected) => selected.name === option.name && selected.value === value));
    const image = (variants.find((variant) => variant.availableForSale) ?? variants[0])?.image ?? null;
    const slug = getColorSlug(value);
    const swatch = option.optionValues?.find((entry) => entry.name === value)?.swatch?.color
      ?? (Object.hasOwn(fallbackSwatches, slug) ? fallbackSwatches[slug] : null);
    return [{ value, slug, image, swatch }];
  });
}

// One preview per color that has its own photo, in the option's order.
export function getColorPreviews(product: Pick<Product, "options" | "variants">): ColorPreview[] {
  const previews = getProductColorOptions(product).filter((option): option is ColorPreview => option.image !== null);
  return hasDistinctPhotos(previews) ? previews : [];
}

export function getColorPreview(product: Pick<Product, "options" | "variants">, slug: string | null | undefined) {
  if (!slug) return undefined;
  const preview = getProductColorOptions(product).find((preview) => preview.slug === getColorSlug(slug));
  return preview?.image ? { ...preview, image: preview.image } : undefined;
}

export function getColorValue(product: Pick<Product, "options">, slug: string | null | undefined) {
  if (!slug) return undefined;
  return getColorOption(product)?.values.find((value) => getColorSlug(value) === getColorSlug(slug));
}

export function getVariantForColor(product: Pick<Product, "options" | "variants">, slug: string | null | undefined) {
  const option = getColorOption(product);
  const value = getColorValue(product, slug);
  if (!option || !value) return undefined;
  const variants = product.variants.filter((variant) => variant.selectedOptions.some((selected) => selected.name === option.name && selected.value === value));
  return variants.find((variant) => variant.availableForSale) ?? variants[0];
}

export function getListingColorPreviews(product: ProductListing): ListingColorPreview[] {
  const sources = product.designs?.length ? product.designs : [{ product, label: product.title, value: undefined }];
  const previews = sources.flatMap((source) => {
    const href = `/products/${product.handle}`;
    const query = source.value ? `design=${encodeURIComponent(source.value)}` : "";
    if (getColorOption(source.product)) {
      // Shopify's actual Color values take precedence over a style's title.
      return getProductColorOptions(source.product).map((preview) => ({
        ...preview,
        swatch: preview.swatch,
        href: `${href}?${query ? `${query}&` : ""}color=${encodeURIComponent(preview.slug)}`,
        designLabel: source.label,
      }));
    }
    // Compatibility for older size-only products whose style names a color.
    const slug = getColorSlug(source.label);
    const swatch = Object.hasOwn(fallbackSwatches, slug) ? fallbackSwatches[slug] : undefined;
    const image = source.product.featuredImage ?? source.product.images[0] ?? source.product.variants.find((variant) => variant.image)?.image ?? null;
    return source.value && swatch ? [{
      value: source.label, slug, image, swatch, href: `${href}?${query}`, designLabel: source.label,
    }] : [];
  });
  // Choices come from catalog options, even when photos or swatches are missing.
  if (previews.length < 2) return [];
  return previews.map(({ designLabel, ...preview }) => {
    // The same fabric color can carry different prints; retain both choices.
    const repeatedColor = previews.some((other) => other.href !== preview.href && other.slug === preview.slug);
    return repeatedColor ? { ...preview, label: `${designLabel} · ${preview.value}` } : preview;
  });
}

function hasDistinctPhotos(previews: ColorPreview[]) {
  return new Set(previews.map((preview) => preview.image.url)).size > 1;
}

export function getImageColor(product: Pick<Product, "options" | "variants">, image: StoreImage): string | undefined {
  const option = getColorOption(product);
  if (!option) return undefined;
  const imageColors = new Map<string, Set<string>>();
  for (const variant of product.variants) {
    const color = variant.selectedOptions.find((selected) => selected.name === option.name)?.value;
    if (!variant.image || !color) continue;
    const colors = imageColors.get(variant.image.url) ?? new Set<string>();
    colors.add(color);
    imageColors.set(variant.image.url, colors);
  }
  const assignedColors = imageColors.get(image.url);
  if (assignedColors) return assignedColors.size === 1 ? [...assignedColors][0] : undefined;

  // Infer a companion photo only from naming patterns actually present in this
  // product's assigned images. No garment names, colors, or view names are fixed.
  const filename = getImageFilename(image);
  if (!filename) return undefined;
  const colors = new Set<string>();
  for (const variant of product.variants) {
    const color = variant.selectedOptions.find((selected) => selected.name === option.name)?.value;
    if (!variant.image || !color || !option.values.includes(color)) continue;
    if (imageColors.get(variant.image.url)?.size !== 1) continue;
    const anchor = getImageFilename(variant.image);
    const slug = getColorSlug(color);
    if (!anchor || !slug) continue;
    const token = new RegExp(`(?:^|-)${slug}(?=-|$)`, "g");
    for (const match of anchor.matchAll(token)) {
      const colorStart = match.index + (match[0].startsWith("-") ? 1 : 0);
      const prefix = anchor.slice(0, colorStart);
      if (filename === `${prefix}${slug}` || filename.startsWith(`${prefix}${slug}-`)) colors.add(color);
    }
  }
  return colors.size === 1 ? [...colors][0] : undefined;
}

function getImageFilename(image: StoreImage) {
  try {
    const filename = decodeURIComponent(new URL(image.url).pathname.split("/").at(-1) ?? "");
    return getColorSlug(filename.replace(/\.[^.]+$/, ""));
  } catch {
    return undefined;
  }
}
