import { expect, test } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductSchema } from "../components/product-schema";
import { buildProductSchema } from "../lib/product-schema";
import { buildBreadcrumbSchema, buildStoreSchema } from "../lib/structured-data";
import type { ReviewsData } from "../lib/types";
import { dad, ryan } from "./fixtures/products";

const url = "https://store.ryanmeetup.com/products/name-tag-shirt?design=ryan";
const reviews: ReviewsData = {
  status: "available", averageRating: 4.4, count: 25,
  reviews: [{ id: "one-visible-review", rating: 4, title: "Fits well", body: "Still looking good.", reviewerName: "Ryan F.", createdAt: "2026-11-18T12:00:00Z", verification: "purchase" }],
};

test("product structured data uses the complete rating summary, independently of the visible page", () => {
  const schema = buildProductSchema({ product: ryan, reviews, url });
  expect(schema.aggregateRating).toEqual({ "@type": "AggregateRating", ratingValue: "4.4", reviewCount: 25, bestRating: 5, worstRating: 0.5 });
});

test("the selected design supplies its own offers and imagery alongside its own ratings", () => {
  const product = { ...dad, availableForSale: false, variants: dad.variants.map((variant) => ({ ...variant, availableForSale: false, price: { amount: "19.00", currencyCode: "USD" } })) };
  const schema = buildProductSchema({ product, reviews: { status: "available", averageRating: 2, count: 3, reviews: [] }, url: url.replace("design=ryan", `design=${dad.handle}`), title: "Name Tag Shirt" });
  expect(schema.name).toBe("Name Tag Shirt");
  expect(schema.description).toBe(dad.description);
  expect(schema.image).toEqual(dad.images.map(({ url }) => url));
  expect(schema.url).toBe("https://store.ryanmeetup.com/products/name-tag-shirt");
  expect(schema).toMatchObject({ "@type": "ProductGroup", brand: { "@type": "Brand", name: "Ryan Meetup" }, variesBy: ["https://schema.org/size", "https://schema.org/color"] });
  expect(schema.aggregateRating).toMatchObject({ ratingValue: "2.0", reviewCount: 3 });
  if (!("hasVariant" in schema)) throw new Error("expected a ProductGroup");
  expect(schema.hasVariant).toHaveLength(dad.variants.length);
  expect(schema.hasVariant[0]).toMatchObject({
    "@type": "Product", name: `Name Tag Shirt - ${dad.variants[0].title}`, size: dad.variants[0].selectedOptions[0].value, color: dad.variants[0].selectedOptions[1].value,
    offers: { "@type": "Offer", price: "19.00", priceCurrency: "USD", availability: "https://schema.org/OutOfStock", itemCondition: "https://schema.org/NewCondition", url: expect.stringContaining(`design=${dad.handle}`) },
  });
});

test("each variant reports its own stock and price, and unknown options become additional properties", () => {
  const variants = ryan.variants.slice(0, 2).map((variant, index) => ({
    ...variant, availableForSale: index === 0, price: { amount: index ? "30.00" : "25.00", currencyCode: "USD" }, selectedOptions: [...variant.selectedOptions, { name: "Print", value: index ? "Back" : "Front" }],
  }));
  const schema = buildProductSchema({ product: { ...ryan, variants }, reviews, url });
  if (!("hasVariant" in schema)) throw new Error("expected a ProductGroup");
  expect(schema.hasVariant.map((variant) => [variant.offers.price, variant.offers.availability])).toEqual([["25.00", "https://schema.org/InStock"], ["30.00", "https://schema.org/OutOfStock"]]);
  expect(schema.hasVariant[1].additionalProperty).toEqual([{ "@type": "PropertyValue", name: "Print", value: "Back" }]);
  expect(schema.variesBy).toEqual(["https://schema.org/size", "https://schema.org/color"]);
});

test("a product without options is a single Product with one offer", () => {
  const [variant] = ryan.variants;
  const schema = buildProductSchema({ product: { ...ryan, variants: [{ ...variant, title: "Default Title", selectedOptions: [{ name: "Title", value: "Default Title" }] }] }, reviews, url });
  expect(schema["@type"]).toBe("Product");
  expect(schema).not.toHaveProperty("hasVariant");
  expect(schema).toMatchObject({ offers: { "@type": "Offer", price: variant.price.amount, url } });
});

test("the description reads Shopify's HTML with list items kept apart", () => {
  const schema = buildProductSchema({ product: { ...ryan, description: "Soft.• 100% cotton• Ryan-approved", descriptionHtml: "<p>Soft.</p><ul><li>100% cotton</li><li>Ryan&apos;s pick</li></ul>" }, reviews, url });
  expect(schema.description).toBe("Soft. 100% cotton Ryan's pick");
});

test("unavailable and empty reviews omit aggregateRating rather than claiming a zero-star product", () => {
  for (const status of ["available", "unavailable"] as const) {
    const schema = buildProductSchema({ product: ryan, reviews: { status, averageRating: 0, count: 0, reviews: [] }, url });
    expect(schema).not.toHaveProperty("aggregateRating");
    expect(schema.url).toBe("https://store.ryanmeetup.com/products/name-tag-shirt");
  }
});

test("server-rendered JSON-LD cannot break out of its script and preserves the original content", () => {
  const description = '</script><script>alert("fixture")</script>';
  const html = renderToStaticMarkup(createElement(ProductSchema, { product: { ...ryan, description, descriptionHtml: "" }, reviews, url }));
  expect(html.match(/<script/g)).toHaveLength(1);
  expect(html).not.toContain(description);
  expect(html).toContain("\\u003c/script>");
  const json = html.slice(html.indexOf(">") + 1, html.lastIndexOf("</script>"));
  expect(JSON.parse(json)).toMatchObject({ description, aggregateRating: { reviewCount: 25 } });
});

test("breadcrumbs list canonical absolute URLs in order", () => {
  expect(buildBreadcrumbSchema([{ name: "Store", path: "/" }, { name: "Apparel", path: "/apparel" }, { name: "Name Tag Shirt", path: "/products/name-tag-shirt" }]).itemListElement).toEqual([
    { "@type": "ListItem", position: 1, name: "Store", item: "https://store.ryanmeetup.com/" },
    { "@type": "ListItem", position: 2, name: "Apparel", item: "https://store.ryanmeetup.com/apparel" },
    { "@type": "ListItem", position: 3, name: "Name Tag Shirt", item: "https://store.ryanmeetup.com/products/name-tag-shirt" },
  ]);
});

test("the store schema names the store and its parent organization", () => {
  const [store, site] = buildStoreSchema()["@graph"];
  expect(store).toMatchObject({ "@type": "OnlineStore", name: "Ryan Meetup Store", url: "https://store.ryanmeetup.com", parentOrganization: { name: "Ryan Meetup", url: "https://ryanmeetup.com" } });
  expect(site).toMatchObject({ "@type": "WebSite", publisher: { "@id": store["@id"] } });
});

test("the store's no-returns policy covers exactly the countries it ships to", () => {
  const [store] = buildStoreSchema(["US", "CA"])["@graph"];
  expect(store).toMatchObject({ hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", applicableCountry: ["US", "CA"], returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted", merchantReturnLink: "https://store.ryanmeetup.com/policies/refund-policy" } });
  expect(buildStoreSchema()["@graph"][0]).not.toHaveProperty("hasMerchantReturnPolicy");
});

test("Google reads at most 50 countries, so a longer list leaves the policy out instead of stating part of it", () => {
  const countries = Array.from({ length: 51 }, (_, index) => `C${index}`);
  expect(buildStoreSchema(countries)["@graph"][0]).not.toHaveProperty("hasMerchantReturnPolicy");
  expect(buildStoreSchema([...countries.slice(0, 50), "C0"])["@graph"][0]).toHaveProperty("hasMerchantReturnPolicy");
});

test("every offer carries the no-returns policy, since product pages don't include the store's own node", () => {
  const policy = { "@type": "MerchantReturnPolicy", applicableCountry: ["US", "CA"], returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted" };
  const group = buildProductSchema({ product: ryan, reviews, url, shippingCountries: ["US", "CA"] });
  if (!("hasVariant" in group)) throw new Error("expected a ProductGroup");
  for (const variant of group.hasVariant) expect(variant.offers).toMatchObject({ hasMerchantReturnPolicy: policy });
  const single = buildProductSchema({ product: { ...ryan, variants: ryan.variants.slice(0, 1) }, reviews, url, shippingCountries: ["US", "CA"] });
  if (!("offers" in single) || !single.offers) throw new Error("expected a single offer");
  expect(single.offers).toMatchObject({ hasMerchantReturnPolicy: policy });
  // Without Markets' country list the policy can't say where it applies.
  const unknown = buildProductSchema({ product: ryan, reviews, url });
  if (!("hasVariant" in unknown)) throw new Error("expected a ProductGroup");
  for (const variant of unknown.hasVariant) expect(variant.offers).not.toHaveProperty("hasMerchantReturnPolicy");
});
