import { expect, test } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductSchema } from "../components/product-schema";
import { buildProductSchema } from "../lib/product-schema";
import type { ReviewsData } from "../lib/types";
import { dad, ryan } from "./fixtures/products";

const url = "https://store.ryanmeetup.com/products/name-tag-shirt?design=ryan";
const reviews: ReviewsData = {
  status: "available", averageRating: 4.4, count: 25,
  reviews: [{ id: "one-visible-review", rating: 4, title: "Fits well", body: "Still looking good.", reviewerName: "Ryan F.", createdAt: "2026-11-18T12:00:00Z", verified: true }],
};

test("product structured data uses the complete rating summary, independently of the visible page", () => {
  const schema = buildProductSchema({ product: ryan, reviews, url });
  expect(schema.aggregateRating).toEqual({ "@type": "AggregateRating", ratingValue: "4.4", reviewCount: 25 });
});

test("the selected design supplies its own offers and imagery alongside its own ratings", () => {
  const product = { ...dad, availableForSale: false, priceRange: { minVariantPrice: { amount: "19.00", currencyCode: "USD" } } };
  const schema = buildProductSchema({ product, reviews: { status: "available", averageRating: 2, count: 3, reviews: [] }, url: url.replace("design=ryan", `design=${dad.handle}`), title: "Name Tag Shirt" });
  expect(schema.name).toBe("Name Tag Shirt");
  expect(schema.description).toBe(dad.description);
  expect(schema.image).toEqual(dad.images.map(({ url }) => url));
  expect(schema.offers).toMatchObject({ lowPrice: "19.00", offerCount: dad.variants.length, availability: "https://schema.org/OutOfStock", url: expect.stringContaining(`design=${dad.handle}`) });
  expect(schema.aggregateRating).toMatchObject({ ratingValue: "2.0", reviewCount: 3 });
});

test("unavailable and empty reviews omit aggregateRating rather than claiming a zero-star product", () => {
  for (const status of ["available", "unavailable"] as const) {
    const schema = buildProductSchema({ product: ryan, reviews: { status, averageRating: 0, count: 0, reviews: [] }, url });
    expect(schema).not.toHaveProperty("aggregateRating");
    expect(schema.offers.url).toBe(url);
  }
});

test("server-rendered JSON-LD cannot break out of its script and preserves the original content", () => {
  const description = '</script><script>alert("fixture")</script>';
  const html = renderToStaticMarkup(createElement(ProductSchema, { product: { ...ryan, description }, reviews, url }));
  expect(html.match(/<script/g)).toHaveLength(1);
  expect(html).not.toContain(description);
  expect(html).toContain("\\u003c/script>");
  const json = html.slice(html.indexOf(">") + 1, html.lastIndexOf("</script>"));
  expect(JSON.parse(json)).toMatchObject({ description, aggregateRating: { reviewCount: 25 } });
});
