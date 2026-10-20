import { expect, test } from "@playwright/test";
import { getColorPreview, getColorPreviews, getColorSlug } from "../lib/product-colors";
import type { Product, StoreImage } from "../lib/types";
import { tee } from "./fixtures/products";

const greenImage: StoreImage = { ...tee.featuredImage!, url: "https://cdn.shopify.com/test/tee-military-green.jpg" };
const plumImage: StoreImage = { ...tee.featuredImage!, url: "https://cdn.shopify.com/test/tee-plum.jpg" };

const multicolor: Product = {
  ...tee,
  options: [
    tee.options[0],
    {
      id: "tee-color",
      name: "Color",
      values: ["Black", "Military Green", "Plum", "Orange"],
      optionValues: [{ name: "Black", swatch: { color: "#000000" } }, { name: "Plum", swatch: null }],
    },
  ],
  variants: [
    ...tee.variants,
    ...tee.variants.map((variant) => ({ ...variant, id: `${variant.id}-green`, image: greenImage, selectedOptions: [variant.selectedOptions[0], { name: "Color", value: "Military Green" }] })),
    ...tee.variants.map((variant) => ({ ...variant, id: `${variant.id}-plum`, image: plumImage, selectedOptions: [variant.selectedOptions[0], { name: "Color", value: "Plum" }] })),
    // A color without its own photo has nothing to preview.
    ...tee.variants.map((variant) => ({ ...variant, id: `${variant.id}-orange`, image: null, selectedOptions: [variant.selectedOptions[0], { name: "Color", value: "Orange" }] })),
  ],
};

test("each photographed color previews its own image with Shopify swatches first", () => {
  expect(getColorPreviews(multicolor)).toEqual([
    { value: "Black", slug: "black", image: tee.featuredImage, swatch: "#000000" },
    { value: "Military Green", slug: "military-green", image: greenImage, swatch: "#4b5132" },
    { value: "Plum", slug: "plum", image: plumImage, swatch: null },
  ]);
});

test("a single color or a single shared photo shows no swatches", () => {
  expect(getColorPreviews(tee)).toEqual([]);
  const sharedPhoto = { ...multicolor, variants: multicolor.variants.map((variant) => ({ ...variant, image: tee.featuredImage })) };
  expect(getColorPreviews(sharedPhoto)).toEqual([]);
});

test("readable color parameters resolve to their preview image", () => {
  expect(getColorSlug(" Steel Grey ")).toBe("steel-grey");
  expect(getColorPreview(multicolor, "military-green")?.image).toEqual(greenImage);
  expect(getColorPreview(multicolor, "Military Green")?.image).toEqual(greenImage);
  expect(getColorPreview(multicolor, "orange")).toBeUndefined();
  expect(getColorPreview(multicolor, null)).toBeUndefined();
});
