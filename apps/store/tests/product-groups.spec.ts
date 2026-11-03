import { expect, test } from "@playwright/test";
import { createProductGroup, getListingHandles, getProductGroupForMember, getProductHref, groupProductListings, resolveListingHandle, resolveProductDesignValue, resolveProductHandle } from "../lib/product-groups";
import { dad, mom, ryan, tee } from "./fixtures/products";

const nameTagGroup = getProductGroupForMember(ryan)!;

test("name tag listing keeps both designs' original Shopify merchandise and options", () => {
  const listings = groupProductListings([mom, tee, ryan]);
  expect(listings.map((product) => product.handle)).toEqual(["name-tag-shirt", tee.handle]);
  const listing = listings[0];
  expect(listing.title).toBe("Name Tag Shirt");
  expect(listing.priceVaries).toBe(true);
  expect(listing.priceRange.minVariantPrice.amount).toBe("12.00");
  expect(listing.options.find((option) => option.name === "Color")?.values).toEqual(["White", "Natural"]);
  expect(listing.designs?.map((design) => design.product)).toEqual([ryan, mom]);
  expect(listing.variants.map((variant) => variant.id)).toEqual([...ryan.variants, ...mom.variants].map((variant) => variant.id));
});

test("a design outside the current catalog slice still belongs to the shared listing", () => {
  const [listing] = groupProductListings([mom], [ryan]);
  expect(listing.designs?.map((design) => design.value)).toEqual(["ryan", mom.handle]);
  expect(listing.priceRange.minVariantPrice.amount).toBe("12.00");
});

test("group availability and size filtering include a design when the other is sold out", () => {
  const soldOutRyan = { ...ryan, availableForSale: false, variants: ryan.variants.map((variant) => ({ ...variant, availableForSale: false })) };
  const listing = createProductGroup(nameTagGroup, [soldOutRyan, mom])!;
  expect(listing.availableForSale).toBe(true);
  expect(listing.variants.some((variant) => variant.availableForSale && variant.selectedOptions.some((option) => option.name === "Size" && option.value === "XL"))).toBe(true);
  expect(createProductGroup(nameTagGroup, [soldOutRyan])?.availableForSale).toBe(false);
});

test("missing designs disappear and an empty group is unavailable", () => {
  const listing = createProductGroup(nameTagGroup, [mom])!;
  expect(listing.designs?.map((design) => design.value)).toEqual([mom.handle]);
  expect(listing.priceVaries).toBe(false);
  expect(createProductGroup(nameTagGroup, [])).toBeNull();
});

test("sitemap and legacy cart links use the shared page with readable designs", () => {
  expect(getListingHandles([mom, tee, ryan, dad])).toEqual(["name-tag-shirt", tee.handle]);
  expect(getProductHref(ryan)).toBe("/products/name-tag-shirt?design=ryan");
  expect(getProductHref(mom)).toBe(`/products/name-tag-shirt?design=${mom.handle}`);
  expect(getProductHref(dad)).toBe("/products/name-tag-shirt?design=ryans-dad-name-tag-shirt");
  expect(getProductHref(tee)).toBe(`/products/${tee.handle}`);
  expect(getProductHref({ handle: "ryans-mom-name-tag-shirt" })).toBe(`/products/name-tag-shirt?design=${dad.handle}`);
});

test("new tagged designs join the group with labels derived from their titles", () => {
  const listing = createProductGroup(nameTagGroup, [mom, dad, ryan])!;
  expect(listing.designs?.map((design) => design.label)).toEqual(["Ryan", "Ryan’s Dad", "Ryan’s Mom"]);
  expect(listing.designs?.map((design) => design.value)).toEqual(["ryan", dad.handle, mom.handle]);
  expect(listing.designs?.find((design) => design.product.id === dad.id)?.product.variants).toEqual(dad.variants);
  expect(listing.images).toContainEqual(dad.featuredImage);
});

test("membership follows tags even when handles and titles do not resemble the original designs", () => {
  const renamed = { ...dad, handle: "family-reunion-special", title: "Limited edition", tags: [" LISTING:  name tag   shirt "] };
  expect(getProductGroupForMember(renamed)?.handle).toBe("name-tag-shirt");
  expect(createProductGroup(nameTagGroup, [renamed])?.designs?.[0]).toMatchObject({ label: "Limited edition", value: renamed.handle });
  expect(getProductHref(renamed)).toBe("/products/name-tag-shirt?design=family-reunion-special");
});

test("removing the tag restores a standalone product and canonical groups never redirect to themselves", () => {
  const untagged = { ...ryan, tags: [] };
  expect(getProductGroupForMember(untagged)).toBeUndefined();
  expect(createProductGroup(nameTagGroup, [untagged])).toBeNull();
  expect(getProductHref(untagged)).toBe(`/products/${ryan.handle}`);
  expect(getProductGroupForMember(createProductGroup(nameTagGroup, [ryan])!)).toBeUndefined();
});

test("a tagged Shopify product can share the group's handle without being mistaken for the virtual listing", () => {
  const product = { ...dad, handle: nameTagGroup.handle };
  expect(getProductGroupForMember(product)?.handle).toBe(nameTagGroup.handle);
  const listing = createProductGroup(nameTagGroup, [product])!;
  expect(listing.designs?.[0].product.id).toBe(dad.id);
  expect(getProductGroupForMember(listing)).toBeUndefined();
});

test("the corrected Dad design resolves old Mom product, cart, and design links", () => {
  expect(resolveProductHandle("ryans-mom-name-tag-shirt")).toBe(dad.handle);
  expect(resolveProductHandle(dad.handle)).toBe(dad.handle);
  expect(resolveProductDesignValue(nameTagGroup.handle, "ryans-mom")).toBe(dad.handle);
  expect(resolveProductDesignValue(nameTagGroup.handle, "ryans-mom-name-tag-shirt")).toBe(dad.handle);
  expect(resolveProductDesignValue(nameTagGroup.handle, dad.handle)).toBe(dad.handle);
  expect(resolveProductDesignValue(nameTagGroup.handle, "ryan")).toBe("ryan");
  expect(getProductHref({ handle: "ryans-mom-name-tag-shirt", tags: ["listing:Name Tag Shirt"] })).toBe(`/products/name-tag-shirt?design=${dad.handle}`);

  const corrected = { ...dad, handle: "ryans-mom-name-tag-shirt" };
  const listing = createProductGroup(nameTagGroup, [ryan, corrected])!;
  expect(listing.designs?.[1]).toMatchObject({ label: "Ryan’s Dad", value: dad.handle });
  expect(listing.designs?.[1].product.variants).toBe(dad.variants);
});

test("any listing tag joins products into one listing labelled by the rest of each title", () => {
  const black = { ...tee, id: "hoodie-black", handle: "i-heart-ry-hoodie", title: "I Heart RY Hoodie - Black", tags: ["Heart", "listing:I Heart RY Hoodie"] };
  const white = { ...tee, id: "hoodie-white", handle: "i-heart-ry-hoodie-white", title: "I heart RY hoodie – white", tags: ["LISTING: i heart ry hoodie"] };
  const listings = groupProductListings([white, ryan, black]);
  expect(listings.map((listing) => listing.handle)).toEqual(["i-heart-ry-hoodie", "name-tag-shirt"]);
  expect(listings[0].title).toBe("I Heart RY Hoodie");
  expect(listings[0].description).toBe(black.description);
  expect(listings[0].designs?.map((design) => [design.label, design.value])).toEqual([["Black", black.handle], ["White", white.handle]]);
  expect(getProductHref(white)).toBe(`/products/i-heart-ry-hoodie?design=${white.handle}`);
});

test("a listing tag without a name is ignored", () => {
  expect(getProductGroupForMember({ ...tee, tags: ["listing:", "listing: ---"] })).toBeUndefined();
});

test("the former nametag-shirt URL resolves to the Name Tag Shirt listing", () => {
  expect(resolveListingHandle("nametag-shirt")).toBe("name-tag-shirt");
  expect(resolveListingHandle("name-tag-shirt")).toBe("name-tag-shirt");
});
