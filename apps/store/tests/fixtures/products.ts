import { demoProducts } from "../../lib/demo-data";
import type { Product, StoreImage } from "../../lib/types";

export const ryan = demoProducts.find((product) => product.handle === "ryan-name-tag-shirt")!;
export const dad = demoProducts.find((product) => product.handle === "ryans-dad-name-tag-shirt")!;
export const tee = demoProducts.find((product) => product.handle === "ryan-meetup-tee")!;

const superImage = (color: string, view: string): StoreImage => ({
  ...tee.featuredImage!,
  url: `https://cdn.shopify.com/test/unisex-classic-tee-${color.toLowerCase()}-${view}-mockup.jpg`,
});

export const superBlack: Product = {
  ...tee,
  id: "super-black",
  handle: "super-ryan-shirt",
  title: "Super Ryan Shirt - Black",
  tags: ["listing:Super Ryan Shirt"],
  options: [tee.options[0]],
  featuredImage: superImage("Black", "front"),
  images: [superImage("Black", "front"), superImage("Black", "back")],
  variants: tee.variants.map((variant) => ({
    ...variant, id: `${variant.id}-super-black`, image: superImage("Black", "front"), selectedOptions: [variant.selectedOptions[0]],
  })),
};

const superColors = ["Royal", "Sapphire", "White"];
export const superBlue: Product = {
  ...superBlack,
  id: "super-blue",
  handle: "super-ryan-blue",
  title: "Super Ryan Shirt - Blue",
  featuredImage: superImage("Royal", "front"),
  images: superColors.flatMap((color) => [superImage(color, "front"), superImage(color, "back")]),
  options: [{ id: "super-color", name: "Color", values: superColors }, tee.options[0]],
  variants: superColors.flatMap((color) => tee.variants.map((variant) => ({
    ...variant,
    id: `${variant.id}-super-${color.toLowerCase()}`,
    image: superImage(color, "front"),
    availableForSale: !(color === "Sapphire" && variant.selectedOptions[0].value === "M"),
    selectedOptions: [variant.selectedOptions[0], { name: "Color", value: color }],
  }))),
};

export const superRed: Product = {
  ...superBlack,
  id: "super-red",
  handle: "super-ryan-red",
  title: "Super Ryan Shirt - Red",
  featuredImage: superImage("Red", "front"),
  images: [superImage("Red", "front"), superImage("Red", "back")],
  variants: superBlack.variants.map((variant) => ({ ...variant, id: `${variant.id}-red`, image: superImage("Red", "front") })),
};

const momImage = { ...dad.featuredImage!, url: "https://cdn.shopify.com/test/ryans-mom.jpg", altText: "Ryan's Mom Nametag Shirt" };

// A new Shopify product that has no entry in the storefront's group configuration.
export const mom: Product = {
  ...dad,
  id: "gid://shopify/Product/demo-ryans-mom",
  handle: "ryans-mom-nametag-shirt",
  title: "Ryan's Mom Nametag Shirt",
  description: "A name tag shirt for Ryan’s mom.",
  descriptionHtml: "<p>A name tag shirt for Ryan’s mom.</p>",
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
