import { expect, test } from "@playwright/test";
import { getColorOption, getColorPreview, getColorPreviews, getColorSlug, getImageColor, getListingColorPreviews, getVariantForColor } from "../lib/product-colors";
import { groupProductListings } from "../lib/product-groups";
import type { Product, StoreImage } from "../lib/types";
import { superBlack, superBlue, superRed, tee } from "./fixtures/products";

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

const multicolorChoices = [
  { value: "Black", slug: "black", image: tee.featuredImage, swatch: "#000000" },
  { value: "Military Green", slug: "military-green", image: greenImage, swatch: "#4b5132" },
  { value: "Plum", slug: "plum", image: plumImage, swatch: null },
  { value: "Orange", slug: "orange", image: null, swatch: null },
];

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
  expect(getColorPreview(tee, "black")?.image).toEqual(tee.featuredImage);
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
    variants: whiteStyle.variants.map((variant) => ({ ...variant, selectedOptions: [...variant.selectedOptions, { name: "Color", value: "White" }] })),
  };
  const [listing] = groupProductListings([blackStyle, white]);
  expect(getListingColorPreviews(listing)[1]).toMatchObject({ image: whiteImage, swatch: "#fefefe" });
});

test("a single style omits redundant swatches while shared or missing photos keep color choices", () => {
  const [singleStyle] = groupProductListings([blackStyle]);
  expect(getListingColorPreviews(singleStyle)).toEqual([]);
  const [sharedPhoto] = groupProductListings([blackStyle, { ...whiteStyle, featuredImage: blackStyle.featuredImage }]);
  expect(getListingColorPreviews(sharedPhoto).map(({ value }) => value)).toEqual(["Black", "White"]);
  const [missingPhoto] = groupProductListings([blackStyle, { ...whiteStyle, featuredImage: null, images: [], variants: whiteStyle.variants.map((variant) => ({ ...variant, image: null })) }]);
  expect(getListingColorPreviews(missingPhoto).map(({ value, image }) => ({ value, image }))).toEqual([
    { value: "Black", image: blackStyle.featuredImage }, { value: "White", image: null },
  ]);
});

test("native variant colors include the owning design in preview links", () => {
  const [listing] = groupProductListings([
    { ...multicolor, handle: "ryan-print", title: "Name Tag Shirt - Ryan", tags: ["listing:Name Tag Shirt"] },
    { ...whiteStyle, title: "Name Tag Shirt - Ryan's Dad", tags: ["listing:Name Tag Shirt"] },
  ]);
  expect(getListingColorPreviews(listing)).toEqual(multicolorChoices.map((preview) => ({
    ...preview,
    href: `/products/name-tag-shirt?design=ryan-print&color=${preview.slug}`,
  })));
  expect(getListingColorPreviews(multicolor)).toEqual(multicolorChoices.map((preview) => ({
    ...preview,
    href: `/products/${multicolor.handle}?color=${preview.slug}`,
  })));
});

test("a color-named style with multiple variant colors keeps its variant previews", () => {
  const black = { ...multicolor, handle: blackStyle.handle, title: blackStyle.title, tags: blackStyle.tags };
  for (const products of [[black], [black, whiteStyle]]) {
    const [listing] = groupProductListings(products);
    const expected = multicolorChoices.map((preview) => ({
      ...preview,
      href: `/products/i-heart-ry-shirt?design=i-heart-ry-shirt&color=${preview.slug}`,
    }));
    if (products.length > 1) expected.push({ value: "White", slug: "white", image: whiteImage, swatch: "#ffffff", href: "/products/i-heart-ry-shirt?design=i-heart-ry-shirt-white" });
    expect(getListingColorPreviews(listing)).toEqual(expected);
  }
});

test("catalog shades have filled swatches without Shopify swatch metadata", () => {
  const shades = [
    ["Dark Chocolate", "#382d29"],
    ["Forest Green", "#273b33"],
    ["Gold", "#ffcc00"],
    ["Royal", "#2b48a4"],
    ["Sand", "#d6cdbb"],
    ["Sapphire", "#007ead"],
  ];
  const product: Product = {
    ...tee,
    options: [{ id: "shade", name: "Color", values: shades.map(([value]) => value) }],
    variants: shades.map(([value]) => ({
      ...tee.variants[0],
      id: `shade-${getColorSlug(value)}`,
      selectedOptions: [{ name: "Color", value }],
      image: { ...tee.featuredImage!, url: `https://cdn.shopify.com/test/${getColorSlug(value)}.jpg` },
    })),
  };
  expect(getListingColorPreviews(product).map(({ value, swatch }) => [value, swatch])).toEqual(shades);
});

test("unresolved colors and missing photos remain available through the more-colors link", () => {
  expect(getListingColorPreviews(multicolor).map((preview) => preview.value)).toEqual(["Black", "Military Green", "Plum", "Orange"]);
  expect(getColorPreview(multicolor, "plum")?.image).toEqual(plumImage);
  const onlyOneKnownColor = { ...multicolor, options: [{ ...multicolor.options[1], values: ["Black", "Plum"] }] };
  expect(getListingColorPreviews(onlyOneKnownColor).map((preview) => preview.value)).toEqual(["Black", "Plum"]);
});

test("a mixed listing previews size-only styles and every native color from a later style", () => {
  const [listing] = groupProductListings([superBlack, superBlue, superRed]);
  const previews = getListingColorPreviews(listing);
  expect(previews.map(({ value }) => value)).toEqual(["Black", "Royal", "Sapphire", "White", "Red"]);
  expect(previews.map(({ href }) => href)).toEqual([
    "/products/super-ryan-shirt?design=super-ryan-shirt",
    "/products/super-ryan-shirt?design=super-ryan-blue&color=royal",
    "/products/super-ryan-shirt?design=super-ryan-blue&color=sapphire",
    "/products/super-ryan-shirt?design=super-ryan-blue&color=white",
    "/products/super-ryan-shirt?design=super-ryan-red",
  ]);
  for (const preview of previews.slice(1, 4)) {
    expect(preview.image).toEqual(getColorPreview(superBlue, preview.slug)?.image);
    expect(preview.swatch).toBeTruthy();
  }
});

test("a fabric color shared by different prints keeps separate, labelled previews", () => {
  const secondPrint = { ...superBlue, id: "second-print", handle: "second-print", title: "Super Ryan Shirt - Other print" };
  const [listing] = groupProductListings([superBlue, secondPrint]);
  const white = getListingColorPreviews(listing).filter((preview) => preview.value === "White");
  expect(white.map((preview) => preview.label)).toEqual(["Blue · White", "Other print · White"]);
  expect(new Set(white.map((preview) => preview.href)).size).toBe(2);
});

test("native assignments take precedence over filenames and shared photos stay unclassified", () => {
  const whiteBack = superBlue.images.find((image) => image.url.includes("white-back"))!;
  expect(getImageColor(superBlue, whiteBack)).toBe("White");
  const assigned = { ...superBlue, variants: [{ ...superBlue.variants[0], image: whiteBack }] };
  expect(getImageColor(assigned, whiteBack)).toBe("Royal");
  const shared = { ...superBlue, variants: superBlue.variants.map((variant) => ({ ...variant, image: whiteBack })) };
  expect(getImageColor(shared, whiteBack)).toBeUndefined();
  expect(getImageColor(shared, { ...whiteBack, url: "https://cdn.shopify.com/test/unisex-classic-tee-white-folded.jpg" })).toBeUndefined();
  expect(getImageColor(superBlue, { ...whiteBack, url: "https://cdn.shopify.com/test/lifestyle.jpg" })).toBeUndefined();
});

test("unfamiliar shades and option names use Shopify swatches without a palette entry", () => {
  const values = ["Glacier Mist", "Canyon Clay", "Orchid Heather"];
  const fills = ["#aeced1", "#b56e55", "#c098c8"];
  const product: Product = {
    ...tee,
    title: "New shirt with arbitrary colors",
    handle: "new-shirt",
    options: [tee.options[0], { id: "fabric", name: "Fabric finish", values, optionValues: values.map((name, index) => ({ name, swatch: { color: fills[index] } })) }],
    variants: values.map((value, index) => ({
      ...tee.variants[0],
      id: `arbitrary-${index}`,
      selectedOptions: [{ name: "Size", value: "S" }, { name: "Fabric finish", value }],
      image: { ...tee.featuredImage!, url: `https://cdn.shopify.com/test/asset-${index}.jpg` },
    })),
  };
  expect(getColorOption(product)?.name).toBe("Fabric finish");
  expect(getListingColorPreviews(product).map(({ value, swatch }) => [value, swatch])).toEqual(values.map((value, index) => [value, fills[index]]));
  expect(getVariantForColor(product, "orchid-heather")?.id).toBe("arbitrary-2");
});

test("a requested color selects its variant even when every color shares one image", () => {
  const product = { ...superBlue, variants: superBlue.variants.map((variant) => ({ ...variant, image: superBlue.featuredImage })) };
  expect(getListingColorPreviews(product).map((preview) => preview.value)).toEqual(["Royal", "Sapphire", "White"]);
  const variant = getVariantForColor(product, "white");
  expect(variant?.selectedOptions).toContainEqual({ name: "Color", value: "White" });
  expect(getVariantForColor(product, "nonexistent")).toBeUndefined();
  const noPhotos = { ...product, variants: product.variants.map((variant) => ({ ...variant, image: null })) };
  expect(getListingColorPreviews(noPhotos)).toHaveLength(3);
  expect(getVariantForColor(noPhotos, "sapphire")?.selectedOptions).toContainEqual({ name: "Color", value: "Sapphire" });
});

test("companion photos follow a product's own image naming pattern for any view", () => {
  const product: Product = {
    ...tee,
    options: [{ id: "colors", name: "Colour", values: ["Sea Glass", "Canyon Clay"] }],
    variants: ["Sea Glass", "Canyon Clay"].map((value) => ({
      ...tee.variants[0],
      id: value,
      selectedOptions: [{ name: "Colour", value }],
      image: { ...tee.featuredImage!, url: `https://cdn.shopify.com/test/summer-jacket-${getColorSlug(value)}-main-v1.jpg` },
    })),
  };
  for (const view of ["side", "folded", "detail", "model"]) {
    const image = { ...tee.featuredImage!, url: `https://cdn.shopify.com/test/summer-jacket-sea-glass-${view}-v2.jpg` };
    expect(getImageColor(product, image)).toBe("Sea Glass");
  }
  expect(getImageColor(product, { ...tee.featuredImage!, url: "https://cdn.shopify.com/test/other-shirt-sea-glass-main.jpg" })).toBeUndefined();
});
