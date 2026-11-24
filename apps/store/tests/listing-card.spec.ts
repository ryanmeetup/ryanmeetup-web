import { expect, test } from "@playwright/test";
import { toCardCatalog } from "../lib/listing-card";
import type { CollectionSummary, ProductListing } from "../lib/types";
import { dad, ryan, superBlack } from "./fixtures/products";

const collection: CollectionSummary = { id: "c", handle: "apparel", title: "Apparel", description: "", image: null };

test("cards keep what swatches and quick add read, and drop the product page's description and gallery", () => {
  const grouped: ProductListing = { ...ryan, designs: [{ label: "Ryan", value: "ryan", product: ryan }, { label: "Dad", value: "dad", product: dad }] };
  const [card] = toCardCatalog({ products: [grouped] }).products;
  for (const product of [card, ...card.designs!.map((design) => design.product)]) {
    expect(product.description).toBe("");
    expect(product.descriptionHtml).toBe("");
    expect(product.images).toEqual([]);
  }
  expect(card.featuredImage).toBe(ryan.featuredImage);
  expect(card.variants).toBe(ryan.variants);
  expect(card.options).toBe(ryan.options);
  expect(card.designs![1].product.variants).toBe(dad.variants);
});

test("a listing without a featured image keeps its first photo as the card's fallback", () => {
  const [card] = toCardCatalog({ products: [{ ...superBlack, featuredImage: null }] }).products;
  expect(card.images).toEqual([superBlack.images[0]]);
});

test("a listing in both the full list and a section stays one object, so the page writes it once", () => {
  const catalog = toCardCatalog({ products: [ryan, dad], sections: [{ collection, products: [ryan], total: 1 }], more: [dad] });
  expect(catalog.sections![0].products[0]).toBe(catalog.products[0]);
  expect(catalog.more![0]).toBe(catalog.products[1]);
});
