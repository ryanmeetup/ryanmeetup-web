import { expect, test } from "@playwright/test";
import { getColorListingHref, getColorOption, getColorPreview, getColorPreviews, getColorSlug, getListingColors, getImageColor, getListingColorPreviews, getListingStyleCount, getVariantForColor } from "../lib/product-colors";
import { groupProductListings } from "../lib/product-groups";
import type { Product, StoreImage } from "../lib/types";
import { dad, ryan, superBlack, superBlue, superRed, tee } from "./fixtures/products";

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
    { value: "Black", slug: "black", image: blackStyle.featuredImage, swatch: "#111111", href: "/products/i-heart-ry-shirt?color=black" },
    { value: "White", slug: "white", image: whiteImage, swatch: "#ffffff", href: "/products/i-heart-ry-shirt?color=white" },
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
      href: `/products/i-heart-ry-shirt?color=${preview.slug}`,
    }));
    if (products.length > 1) expected.push({ value: "White", slug: "white", image: whiteImage, swatch: "#ffffff", href: "/products/i-heart-ry-shirt?color=white" });
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

// Super Ryan Shirt opens on Royal, so the member offering Royal leads its listing.
test("a mixed listing previews size-only styles and every native color, default color's style first", () => {
  const [listing] = groupProductListings([superBlack, superBlue, superRed]);
  const previews = getListingColorPreviews(listing);
  expect(previews.map(({ value }) => value)).toEqual(["Royal", "Sapphire", "White", "Black", "Red"]);
  expect(previews.map(({ href }) => href)).toEqual([
    "/products/super-ryan-shirt?design=super-ryan-blue&color=royal",
    "/products/super-ryan-shirt?design=super-ryan-blue&color=sapphire",
    "/products/super-ryan-shirt?design=super-ryan-blue&color=white",
    "/products/super-ryan-shirt?design=super-ryan-shirt",
    "/products/super-ryan-shirt?design=super-ryan-red",
  ]);
  for (const preview of previews.slice(0, 3)) {
    expect(preview.image).toEqual(getColorPreview(superBlue, preview.slug)?.image);
    expect(preview.swatch).toBeTruthy();
  }
});

test("a listing of color one-offs and multicolor members is chosen by color alone, default color's member first", () => {
  const [listing] = groupProductListings([superBlack, { ...superBlue, title: "Super Ryan Shirt" }, superRed]);
  expect(getListingColors(listing.designs!)?.map(({ color, design }) => [color, design])).toEqual([
    ["Royal", "super-ryan-blue"],
    ["Sapphire", "super-ryan-blue"],
    ["White", "super-ryan-blue"],
    ["Black", "super-ryan-shirt"],
    ["Red", "super-ryan-red"],
  ]);
});

test("a member titled with a color family offers its Color option's shades, not the title color", () => {
  // Like "Ryan Christmas Sweater 2025 - Red" selling Cardinal and Team Red.
  const [listing] = groupProductListings([superBlack, { ...superBlue, title: "Super Ryan Shirt - Red" }]);
  expect(getListingColors(listing.designs!)?.map(({ color }) => color).sort()).toEqual(["Black", "Royal", "Sapphire", "White"]);
});

test("links naming a color-split listing's printing product resolve to its color alone", () => {
  const [listing] = groupProductListings([superBlack, { ...superBlue, title: "Super Ryan Shirt" }, superRed]);
  const href = (design: string, color?: string | string[]) => getColorListingHref({ ...listing, defaultColor: "royal" }, design, color);
  // The linked color wins when that product prints it, then the listing default, then the product's first color.
  expect(href("super-ryan-blue", "White")).toBe("/products/super-ryan-shirt?color=white");
  expect(href("super-ryan-blue")).toBe("/products/super-ryan-shirt?color=royal");
  expect(href("super-ryan-blue", "red")).toBe("/products/super-ryan-shirt?color=royal");
  expect(href("super-ryan-red")).toBe("/products/super-ryan-shirt?color=red");
  expect(href("retired-member")).toBe("/products/super-ryan-shirt");
  // A cart line passes its option values; the first color the product prints wins.
  expect(href("super-ryan-blue", ["L", "White"])).toBe("/products/super-ryan-shirt?color=white");
  expect(href("super-ryan-blue", ["L"])).toBe("/products/super-ryan-shirt?color=royal");
  // A listing of real designs keeps the design in its URL.
  const [designs] = groupProductListings([ryan, dad]);
  expect(getColorListingHref(designs, "ryans-dad-name-tag-shirt")).toBeUndefined();
});

test("a listing keeps its styles when a member is a design or a color repeats", () => {
  const [designs] = groupProductListings([ryan, dad]);
  expect(getListingColors(designs.designs!)).toBeUndefined();
  const secondPrint = { ...superBlue, id: "second-print", handle: "second-print", title: "Super Ryan Shirt - Other print" };
  const [repeated] = groupProductListings([superBlue, secondPrint]);
  expect(getListingColors(repeated.designs!)).toBeUndefined();
  // "Blue" names no color the member offers, so it reads as a design.
  const [named] = groupProductListings([superBlack, superBlue, superRed]);
  expect(getListingColors(named.designs!)).toBeUndefined();
});

test("a fabric color shared by different styles is one preview, counted apart from the styles", () => {
  const secondPrint = { ...superBlue, id: "second-print", handle: "second-print", title: "Super Ryan Shirt - Other print" };
  const [listing] = groupProductListings([superBlue, secondPrint]);
  const previews = getListingColorPreviews(listing);
  // Each color appears once and opens on the first style that offers it.
  expect(previews.map(({ value, href }) => [value, href])).toEqual([
    ["Royal", "/products/super-ryan-shirt?design=super-ryan-blue&color=royal"],
    ["Sapphire", "/products/super-ryan-shirt?design=super-ryan-blue&color=sapphire"],
    ["White", "/products/super-ryan-shirt?design=super-ryan-blue&color=white"],
  ]);
  expect(getListingStyleCount(listing)).toBe(2);
  // Two styles in one shared color still differ by style, but offer no color choice.
  const [oneColor] = groupProductListings([ryan, { ...dad, options: ryan.options, variants: ryan.variants }]);
  expect(getListingColorPreviews(oneColor)).toEqual([]);
  expect(getListingStyleCount(oneColor)).toBe(2);
});

test("only listings chosen by style count styles", () => {
  const [single] = groupProductListings([ryan]);
  expect(getListingStyleCount(single)).toBe(0);
  const [byColor] = groupProductListings([superBlack, { ...superBlue, title: "Super Ryan Shirt" }, superRed]);
  expect(getListingStyleCount(byColor)).toBe(0);
  const [mixed] = groupProductListings([superBlack, superBlue, superRed]);
  expect(getListingStyleCount(mixed)).toBe(3);
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
