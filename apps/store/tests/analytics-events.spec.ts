import { expect, test } from "@playwright/test";
import { analyticsPath, analyticsUrl, getAnalyticsPlacement, storeLinkEvent } from "../lib/analytics-events";

const store = "https://store.example";

test("analytics paths keep known store routes and group everything else", () => {
  for (const path of ["/", "/about", "/contact", "/cart", "/reviews", "/reviews/mine", "/products/ryan-tee", "/collections/hats", "/apparel", "/accessories/mugs", "/policies/shipping-policy"]) {
    expect(analyticsPath(path)).toBe(path);
  }
  // Unknown routes, nested paths, and handles outside Shopify's lowercase form never reach a report.
  for (const path of ["/admin", "/reviews/123", "/products/ryan-tee/extra", "/products/Ryan-Tee", "/orders/1001", "/api/cart"]) {
    expect(analyticsPath(path)).toBe("/other");
  }
});

test("analytics URLs drop query strings, fragments, and private routes", () => {
  expect(analyticsUrl(`${store}/products/ryan-tee?variant=42&ref=email#reviews`)).toBe(`${store}/products/ryan-tee`);
  // Contact prefills carry support details that must never be recorded.
  expect(analyticsUrl(`${store}/contact?topic=order&message=my%20address`)).toBe(`${store}/contact`);
  expect(analyticsUrl(`${store}/orders/1001?key=secret`)).toBe(`${store}/other`);
  expect(analyticsUrl(`${store}/auth/callback?code=abc&state=xyz`)).toBeNull();
  expect(analyticsUrl(`${store}/api/cart`)).toBeNull();
  expect(analyticsUrl(`${store}/apiary`)).toBe(`${store}/other`);
  expect(analyticsUrl("not a url")).toBeNull();
});

test("unknown placements fall back to content", () => {
  expect(getAnalyticsPlacement("home_hero")).toBe("home_hero");
  expect(getAnalyticsPlacement("sidebar")).toBe("content");
  expect(getAnalyticsPlacement(undefined)).toBe("content");
});

test("internal links resolve to product, collection, or navigation events", () => {
  expect(storeLinkEvent("/products/ryan-tee?variant=42", `${store}/`, "home_favorites"))
    .toEqual({ name: "product_clicked", properties: { product: "ryan-tee", placement: "home_favorites" } });
  expect(storeLinkEvent("/collections/hats", `${store}/`, "home_collections"))
    .toEqual({ name: "collection_clicked", properties: { collection: "/collections/hats", placement: "home_collections" } });
  expect(storeLinkEvent("/apparel", `${store}/`, "header"))
    .toEqual({ name: "collection_clicked", properties: { collection: "/apparel", placement: "header" } });
  expect(storeLinkEvent(`${store}/reviews`, `${store}/products/ryan-tee`, "footer"))
    .toEqual({ name: "navigation_clicked", properties: { destination: "/reviews", placement: "footer" } });
});

test("only the collections and reviews anchors count as navigation", () => {
  expect(storeLinkEvent("/#collections", `${store}/`, "home_hero"))
    .toEqual({ name: "navigation_clicked", properties: { destination: "/#collections", placement: "home_hero" } });
  expect(storeLinkEvent("/#reviews", `${store}/about`, "header"))
    .toEqual({ name: "navigation_clicked", properties: { destination: "/#reviews", placement: "header" } });
  // Skip links and other same-page anchors are not navigation.
  expect(storeLinkEvent("#main", `${store}/cart`, "content")).toBeNull();
  // Other anchors are dropped from the destination when the page changes.
  expect(storeLinkEvent("/about#team", `${store}/`, "footer"))
    .toEqual({ name: "navigation_clicked", properties: { destination: "/about", placement: "footer" } });
});

test("external links report a product handle when one is attached, otherwise only the host", () => {
  const etsy = "https://www.etsy.com/listing/123?ref=shop";
  expect(storeLinkEvent(etsy, `${store}/`, "catalog", "ryan-mug"))
    .toEqual({ name: "external_product_clicked", properties: { product: "ryan-mug", placement: "catalog" } });
  expect(storeLinkEvent(etsy, `${store}/`, "catalog", "Not A Handle"))
    .toEqual({ name: "external_link_clicked", properties: { host: "www.etsy.com", placement: "catalog" } });
  expect(storeLinkEvent("https://instagram.com/ryanmeetup", `${store}/`, "footer"))
    .toEqual({ name: "external_link_clicked", properties: { host: "instagram.com", placement: "footer" } });
});

test("non-web, private, and unknown destinations are not tracked", () => {
  expect(storeLinkEvent("mailto:hello@example.com", `${store}/`, "footer")).toBeNull();
  expect(storeLinkEvent("javascript:void(0)", `${store}/`, "content")).toBeNull();
  expect(storeLinkEvent("/api/cart", `${store}/`, "content")).toBeNull();
  expect(storeLinkEvent("/auth/login", `${store}/`, "header")).toBeNull();
  expect(storeLinkEvent("/orders/1001", `${store}/`, "content")).toBeNull();
  expect(storeLinkEvent("/products/ryan-tee", "not a url", "content")).toBeNull();
});
