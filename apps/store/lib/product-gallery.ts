import { getColorOption, getImageColor, getListingColors } from "./product-colors";
import type { Product, ProductDesign, StoreImage } from "./types";

export type ProductGalleryImage = {
  key: string;
  image: StoreImage;
  label: string;
  productId: string;
  groupLabel: string;
  design?: string;
};

export function getProductGallery(product: Product, designs?: ProductDesign[]): ProductGalleryImage[] {
  const sources = designs ?? [{ product, label: product.title, value: undefined }];
  // A listing chosen by color alone labels photos by color, as its Color field does.
  const colorsOnly = Boolean(designs && getListingColors(designs));
  return sources.flatMap(({ product: source, label, value }) => {
    const images = new Map<string, StoreImage>();
    for (const image of [source.featuredImage, ...source.images, ...source.variants.map((variant) => variant.image)]) {
      if (image && !images.has(image.url)) images.set(image.url, image);
    }
    const multipleColors = (getColorOption(source)?.values.length ?? 0) > 1;
    const counts = new Map<string, number>();
    return [...images.values()].map((image) => {
      const color = multipleColors ? getImageColor(source, image) : undefined;
      const groupLabel = color ? value && !colorsOnly ? `${label} · ${color}` : color : label;
      const count = (counts.get(groupLabel) ?? 0) + 1;
      counts.set(groupLabel, count);
      return {
        key: `${source.id}:${image.url}`,
        image,
        label: `${groupLabel} image ${count}`,
        productId: source.id,
        groupLabel,
        design: value,
      };
    });
  });
}

export function groupProductGallery(images: ProductGalleryImage[]) {
  const groups = new Map<string, { productId: string; label: string; images: ProductGalleryImage[] }>();
  for (const image of images) {
    const key = `${image.productId}:${image.groupLabel}`;
    const group = groups.get(key);
    if (group) group.images.push(image);
    else groups.set(key, { productId: image.productId, label: image.groupLabel, images: [image] });
  }
  return [...groups.values()];
}

export function getVariantForImage(product: Product, image: StoreImage | null | undefined, selections: Record<string, string> = {}) {
  if (!image) return undefined;
  const color = getImageColor(product, image);
  const colorOption = getColorOption(product);
  const assignedVariants = product.variants.filter((variant) => variant.image?.url === image.url);
  const variants = assignedVariants.length ? assignedVariants : color ? product.variants.filter((variant) =>
    variant.selectedOptions.some((option) => option.name === colorOption?.name && option.value === color),
  ) : [];
  const matchesSelection = (variant: Product["variants"][number]) => variant.selectedOptions.every(
    (option) => (color !== undefined && option.name === colorOption?.name) || !selections[option.name] || selections[option.name] === option.value,
  );
  return variants.find((variant) => variant.availableForSale && matchesSelection(variant))
    ?? variants.find(matchesSelection)
    ?? variants.find((variant) => variant.availableForSale)
    ?? variants[0];
}
