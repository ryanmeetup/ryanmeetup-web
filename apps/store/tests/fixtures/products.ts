import { demoProducts } from "../../lib/demo-data";
import type { Product } from "../../lib/types";

export const ryan = demoProducts.find((product) => product.handle === "ryan-name-tag-shirt")!;
export const dad = demoProducts.find((product) => product.handle === "ryans-dad-name-tag-shirt")!;
export const tee = demoProducts.find((product) => product.handle === "ryan-meetup-tee")!;

const momImage = { ...dad.featuredImage!, url: "https://cdn.shopify.com/test/ryans-mom.jpg", altText: "Ryan's Mom Nametag Shirt" };

// A new Shopify product that has no entry in the storefront's group configuration.
export const mom: Product = {
  ...dad,
  id: "gid://shopify/Product/demo-ryans-mom",
  handle: "ryans-mom-nametag-shirt",
  title: "Ryan's Mom Nametag Shirt",
  description: "A nametag shirt for Ryan’s mom.",
  descriptionHtml: "<p>A nametag shirt for Ryan’s mom.</p>",
  featuredImage: momImage,
  images: [momImage],
  variants: dad.variants.map((variant, index) => ({ ...variant, id: `gid://shopify/ProductVariant/demo-ryans-mom-${index}`, image: momImage })),
};

export function productNode(product: Product) {
  return {
    ...product,
    images: { edges: product.images.map((node) => ({ node })), pageInfo: { endCursor: null, hasNextPage: false } },
    variants: { edges: product.variants.map((node) => ({ node })), pageInfo: { endCursor: null, hasNextPage: false } },
  };
}
