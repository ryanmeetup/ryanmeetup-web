import { expect, test } from "@playwright/test";
import { getProductGallery, getVariantForImage, groupProductGallery } from "../lib/product-gallery";
import { getProduct } from "../lib/shopify";
import type { Product, StoreImage } from "../lib/types";
import { mom, ryan, superBlack, superBlue, superRed } from "./fixtures/products";

const extraImage: StoreImage = { ...ryan.featuredImage!, url: "https://cdn.shopify.com/extra.jpg" };

test("gallery includes every design and variant-only image without repeating size photos", () => {
  const product = { ...ryan, variants: [...ryan.variants, { ...ryan.variants[0], image: extraImage }] };
  const gallery = getProductGallery(product, [
    { product, label: "Ryan", value: "ryan" },
    { product: mom, label: "Ryan’s Mom", value: "ryans-mom" },
  ]);
  expect(gallery.map((entry) => entry.image.url)).toEqual([ryan.featuredImage!.url, extraImage.url, mom.featuredImage!.url]);
  expect(gallery.map((entry) => entry.design)).toEqual(["ryan", "ryan", "ryans-mom"]);
  expect(groupProductGallery(gallery)).toEqual([
    { productId: product.id, label: "Ryan", images: gallery.slice(0, 2) },
    { productId: mom.id, label: "Ryan’s Mom", images: gallery.slice(2) },
  ]);
  expect(new Set(gallery.map((entry) => entry.key)).size).toBe(gallery.length);
});

test("shared photo URLs retain each design's identity", () => {
  const gallery = getProductGallery(ryan, [
    { product: ryan, label: "Ryan", value: "ryan" },
    { product: { ...mom, featuredImage: ryan.featuredImage, images: ryan.images, variants: [] }, label: "Ryan’s Mom", value: "ryans-mom" },
  ]);
  expect(gallery).toHaveLength(2);
  expect(gallery[0].key).not.toBe(gallery[1].key);
  expect(gallery[0].productId).toBe(ryan.id);
  expect(gallery[1].productId).toBe(mom.id);
  expect(groupProductGallery(gallery).map((group) => group.label)).toEqual(["Ryan", "Ryan’s Mom"]);
});

test("selecting a color photo preserves the chosen size and its actual availability", () => {
  const blueVariants = ryan.variants.map((variant) => ({
    ...variant,
    id: `${variant.id}-blue`,
    image: extraImage,
    availableForSale: variant.selectedOptions.some((option) => option.name === "Size" && option.value === "S"),
    selectedOptions: variant.selectedOptions.map((option) => option.name === "Color" ? { ...option, value: "Blue" } : option),
  }));
  const product: Product = { ...ryan, variants: [...ryan.variants, ...blueVariants] };
  const variant = getVariantForImage(product, extraImage, { Size: "M", Color: "White" });
  expect(variant?.selectedOptions).toContainEqual({ name: "Size", value: "M" });
  expect(variant?.selectedOptions).toContainEqual({ name: "Color", value: "Blue" });
  expect(variant?.availableForSale).toBe(false);
  expect(getVariantForImage(product, { ...extraImage, url: "https://cdn.shopify.com/back.jpg" })).toBeUndefined();
});

test("a style with multiple colors gets separate front and back photo groups", () => {
  const gallery = getProductGallery(superBlack, [
    { product: superBlack, label: "Black", value: superBlack.handle },
    { product: superBlue, label: "Blue", value: superBlue.handle },
    { product: superRed, label: "Red", value: superRed.handle },
  ]);
  const groups = groupProductGallery(gallery);
  expect(groups.map((group) => [group.label, group.images.length])).toEqual([
    ["Black", 2], ["Blue · Royal", 2], ["Blue · Sapphire", 2], ["Blue · White", 2], ["Red", 2],
  ]);
  expect(gallery).toHaveLength(10);
  expect(groups[3].images.map((entry) => entry.label)).toEqual(["Blue · White image 1", "Blue · White image 2"]);
  expect(groups[3].images.every((entry) => entry.design === superBlue.handle && entry.productId === superBlue.id)).toBe(true);
});

test("a companion back photo selects its own color while preserving size and availability", () => {
  const back = superBlue.images.find((image) => image.url.includes("sapphire-back"))!;
  const variant = getVariantForImage(superBlue, back, { Size: "M", Color: "Royal" });
  expect(variant?.selectedOptions).toEqual([{ name: "Size", value: "M" }, { name: "Color", value: "Sapphire" }]);
  expect(variant?.availableForSale).toBe(false);
});

test("a photo shared by several colors preserves the current color and size", () => {
  const image = superBlue.images[0];
  const product = { ...superBlue, variants: superBlue.variants.map((variant) => ({ ...variant, image })) };
  const variant = getVariantForImage(product, image, { Size: "M", Color: "Sapphire" });
  expect(variant?.selectedOptions).toEqual([{ name: "Size", value: "M" }, { name: "Color", value: "Sapphire" }]);
  expect(variant?.availableForSale).toBe(false);
});

test("product details fetch all image and variant pages", async () => {
  const originalFetch = globalThis.fetch;
  const originalDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const originalToken = process.env.SHOPIFY_STOREFRONT_API_TOKEN;
  const requests: { query: string; variables: { after?: string } }[] = [];
  process.env.SHOPIFY_STORE_DOMAIN = "catalog.test";
  process.env.SHOPIFY_STOREFRONT_API_TOKEN = "test-token";
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body));
    requests.push(request);
    const connection = (nodes: unknown[], endCursor: string, hasNextPage: boolean) => ({ edges: nodes.map((node) => ({ node })), pageInfo: { endCursor, hasNextPage } });
    if (request.query.includes("CatalogProductSummaries")) {
      return new Response(JSON.stringify({ data: { products: connection([], "", false) } }), { headers: { "Content-Type": "application/json" } });
    }
    let product;
    if (request.query.includes("items: images")) {
      product = { items: connection([extraImage], "last-image", false) };
      expect(request.variables.after).toBe("first-image");
    } else if (request.query.includes("items: variants")) {
      product = { items: connection([ryan.variants[1]], "last-variant", false) };
      expect(request.variables.after).toBe("first-variant");
    } else {
      product = { ...ryan, images: connection(ryan.images, "first-image", true), variants: connection([ryan.variants[0]], "first-variant", true) };
    }
    return new Response(JSON.stringify({ data: { product } }), { headers: { "Content-Type": "application/json" } });
  };
  try {
    const product = await getProduct(ryan.handle);
    expect(product?.images.map((image) => image.url)).toEqual([ryan.featuredImage!.url, extraImage.url]);
    expect(product?.variants.map((variant) => variant.id)).toEqual([ryan.variants[0].id, ryan.variants[1].id]);
    expect(requests.filter((request) => !request.query.includes("CatalogProductSummaries"))).toHaveLength(3);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDomain === undefined) delete process.env.SHOPIFY_STORE_DOMAIN;
    else process.env.SHOPIFY_STORE_DOMAIN = originalDomain;
    if (originalToken === undefined) delete process.env.SHOPIFY_STOREFRONT_API_TOKEN;
    else process.env.SHOPIFY_STOREFRONT_API_TOKEN = originalToken;
  }
});
