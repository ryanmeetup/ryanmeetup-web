import type { Product, StoreImage } from "./types";

export type ColorPreview = {
  value: string;
  slug: string;
  image: StoreImage;
  swatch: string | null;
};

// Shopify swatches win when they are set in Admin. These cover the Printful
// colors the catalog uses today; an unlisted color still gets a labelled chip.
const fallbackSwatches: Record<string, string> = {
  black: "#111111",
  cream: "#f3ead8",
  maroon: "#5b1a2a",
  "military-green": "#4b5132",
  natural: "#eee6d3",
  navy: "#1f2a44",
  red: "#c8102e",
  "steel-grey": "#6e7378",
  white: "#ffffff",
};

export function getColorSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getColorOption(product: Pick<Product, "options">) {
  return product.options.find((option) => /^colou?r$/i.test(option.name.trim()));
}

// One preview per color that has its own photo, in the option's order.
export function getColorPreviews(product: Pick<Product, "options" | "variants">): ColorPreview[] {
  const option = getColorOption(product);
  if (!option) return [];
  const previews = option.values.flatMap((value) => {
    const variants = product.variants.filter((variant) => variant.image && variant.selectedOptions.some((selected) => selected.name === option.name && selected.value === value));
    const image = (variants.find((variant) => variant.availableForSale) ?? variants[0])?.image;
    if (!image) return [];
    const slug = getColorSlug(value);
    const swatch = option.optionValues?.find((entry) => entry.name === value)?.swatch?.color ?? fallbackSwatches[slug] ?? null;
    return [{ value, slug, image, swatch }];
  });
  // A single photo shared by every color previews nothing.
  return new Set(previews.map((preview) => preview.image.url)).size > 1 ? previews : [];
}

export function getColorPreview(product: Pick<Product, "options" | "variants">, slug: string | null | undefined) {
  if (!slug) return undefined;
  return getColorPreviews(product).find((preview) => preview.slug === getColorSlug(slug));
}
