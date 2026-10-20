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
  return sources.flatMap(({ product: source, label, value }) => {
    const images = new Map<string, StoreImage>();
    for (const image of [source.featuredImage, ...source.images, ...source.variants.map((variant) => variant.image)]) {
      if (image && !images.has(image.url)) images.set(image.url, image);
    }
    return [...images.values()].map((image, index) => ({
      key: `${source.id}:${image.url}`,
      image,
      label: `${label} image ${index + 1}`,
      productId: source.id,
      groupLabel: label,
      design: value,
    }));
  });
}

export function groupProductGallery(images: ProductGalleryImage[]) {
  const groups = new Map<string, { productId: string; label: string; images: ProductGalleryImage[] }>();
  for (const image of images) {
    const group = groups.get(image.productId);
    if (group) group.images.push(image);
    else groups.set(image.productId, { productId: image.productId, label: image.groupLabel, images: [image] });
  }
  return [...groups.values()];
}

export function getVariantForImage(product: Product, image: StoreImage | null | undefined, selections: Record<string, string> = {}) {
  if (!image) return undefined;
  const variants = product.variants.filter((variant) => variant.image?.url === image.url);
  const matchesSelection = (variant: Product["variants"][number]) => variant.selectedOptions.every(
    (option) => option.name.toLowerCase() === "color" || !selections[option.name] || selections[option.name] === option.value,
  );
  return variants.find((variant) => variant.availableForSale && matchesSelection(variant))
    ?? variants.find(matchesSelection)
    ?? variants.find((variant) => variant.availableForSale)
    ?? variants[0];
}
