import { expect, test } from "@playwright/test";
import { getColorPreview, getColorPreviews, getColorSlug, getListingColorPreviews } from "../lib/product-colors";
import { groupProductListings } from "../lib/product-groups";
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

const blackStyle: Product = {
  ...tee,
  handle: "i-heart-ry-shirt",
  title: "I Heart RY Shirt - Black",
  tags: ["listing:I Heart RY Shirt"],
  options: [tee.options[0]],
  variants: tee.variants.map((variant) => ({ ...variant, selectedOptions: [variant.selectedOptions[0]] })),
};
const whiteImage: StoreImage = { ...tee.featuredImage!, url: "https://cdn.shopify.com/test/tee-white.jpg" };
const whiteStyle: Product = {
  ...blackStyle,
  id: "white-shirt",
  handle: "i-heart-ry-shirt-white",
  title: "I Heart RY Shirt - White",
  featuredImage: whiteImage,
  images: [whiteImage],
  variants: blackStyle.variants.map((variant) => ({ ...variant, id: `${variant.id}-white`, image: whiteImage })),
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

test("colors stored as separate styles preview both photos and link to their matching style", () => {
  const [listing] = groupProductListings([whiteStyle, blackStyle]);
  expect(listing.options.map((option) => option.name)).toEqual(["Size"]);
  expect(getListingColorPreviews(listing)).toEqual([
    { value: "Black", slug: "black", image: blackStyle.featuredImage, swatch: "#111111", href: "/products/i-heart-ry-shirt?design=i-heart-ry-shirt" },
    { value: "White", slug: "white", image: whiteImage, swatch: "#ffffff", href: "/products/i-heart-ry-shirt?design=i-heart-ry-shirt-white" },
  ]);
});

test("style colors honor Shopify swatches and can use a variant-only photo", () => {
  const white = {
    ...whiteStyle,
    featuredImage: null,
    images: [],
    options: [...whiteStyle.options, { id: "white-color", name: "Color", values: ["White"], optionValues: [{ name: "White", swatch: { color: "#fefefe" } }] }],
  };
  const [listing] = groupProductListings([blackStyle, white]);
  expect(getListingColorPreviews(listing)[1]).toMatchObject({ image: whiteImage, swatch: "#fefefe" });
});

test("style colors need multiple distinct photos to show previews", () => {
  const [singleStyle] = groupProductListings([blackStyle]);
  expect(getListingColorPreviews(singleStyle)).toEqual([]);
  const [sharedPhoto] = groupProductListings([blackStyle, { ...whiteStyle, featuredImage: blackStyle.featuredImage }]);
  expect(getListingColorPreviews(sharedPhoto)).toEqual([]);
  const [missingPhoto] = groupProductListings([blackStyle, { ...whiteStyle, featuredImage: null, images: [], variants: whiteStyle.variants.map((variant) => ({ ...variant, image: null })) }]);
  expect(getListingColorPreviews(missingPhoto)).toEqual([]);
});

test("other style groups keep the first design's colors and include its design in preview links", () => {
  const [listing] = groupProductListings([
    { ...multicolor, handle: "ryan-print", title: "Name Tag Shirt - Ryan", tags: ["listing:Name Tag Shirt"] },
    { ...whiteStyle, title: "Name Tag Shirt - Ryan's Dad", tags: ["listing:Name Tag Shirt"] },
  ]);
  expect(getListingColorPreviews(listing)).toEqual(getColorPreviews(multicolor).map((preview) => ({
    ...preview,
    href: `/products/name-tag-shirt?design=ryan-print&color=${preview.slug}`,
  })));
  expect(getListingColorPreviews(multicolor)).toEqual(getColorPreviews(multicolor).map((preview) => ({
    ...preview,
    href: `/products/${multicolor.handle}?color=${preview.slug}`,
  })));
});

test("a color-named style with multiple variant colors keeps its variant previews", () => {
  const black = { ...multicolor, handle: blackStyle.handle, title: blackStyle.title, tags: blackStyle.tags };
  for (const products of [[black], [black, whiteStyle]]) {
    const [listing] = groupProductListings(products);
    expect(getListingColorPreviews(listing)).toEqual(getColorPreviews(multicolor).map((preview) => ({
      ...preview,
      href: `/products/i-heart-ry-shirt?design=i-heart-ry-shirt&color=${preview.slug}`,
    })));
  }
});
