import { expect, test } from "@playwright/test";
import { getAdminOrderSearchUrl, getAdminOrdersUrl, getBugReportHref, getProductReturnHref, parseSupportPrefill } from "../lib/support";
import { validateEmail } from "@ryanmeetup/utils";

const blank = { order: "", email: "", topic: "", page: "", product: "" };

test("order links from Shopify prefill a readable order number and drop anything malformed", () => {
  expect(parseSupportPrefill({ order: "1042", email: " ryan@example.com " })).toEqual({ ...blank, order: "#1042", email: "ryan@example.com" });
  expect(parseSupportPrefill({ order: "#RM-1042" })).toEqual({ ...blank, order: "#RM-1042" });
  expect(parseSupportPrefill({ order: ["1001", "1002"], email: ["a@b.co"] })).toEqual({ ...blank, order: "#1001", email: "a@b.co" });
  expect(parseSupportPrefill({ order: "<script>", email: "not-an-email" })).toEqual(blank);
  expect(parseSupportPrefill({})).toEqual(blank);
});

test("bug-report links open the bug topic and keep only an on-site page", () => {
  expect(parseSupportPrefill({ topic: "site-bug", from: "/products/ryan-tee?color=black" })).toEqual({ ...blank, topic: "site-bug", page: "/products/ryan-tee?color=black" });
  expect(parseSupportPrefill({ topic: "refund", from: "https://evil.example" })).toEqual(blank);
  expect(parseSupportPrefill({ topic: "site-bug", from: "//evil.example/path" })).toEqual({ ...blank, topic: "site-bug" });
  expect(getBugReportHref("/cart")).toBe("/contact?topic=site-bug&from=%2Fcart");
  expect(getBugReportHref("/contact")).toBe("/contact?topic=site-bug");
  expect(getBugReportHref()).toBe("/contact?topic=site-bug");
});

test("the Shopify Admin link searches by order number, falling back to the customer's email", () => {
  const orders = getAdminOrdersUrl("https://ryan-meetup-store.myshopify.com/");
  expect(orders).toBe("https://admin.shopify.com/store/ryan-meetup-store/orders");
  expect(getAdminOrderSearchUrl(orders!, "#1042", "ryan@example.com")).toBe(`${orders}?query=1042`);
  expect(getAdminOrderSearchUrl(orders!, " ", "ryan+merch@example.com")).toBe(`${orders}?query=ryan%2Bmerch%40example.com`);
  expect(getAdminOrdersUrl("store.ryanmeetup.com")).toBeNull();
  expect(getAdminOrdersUrl(undefined)).toBeNull();
});

test("product-return links round-trip the item name and reject malformed prefills", () => {
  const product = "Ryan’s pin & sticker set / original";
  const url = new URL(getProductReturnHref(product), "https://store.test");
  expect(url.pathname).toBe("/contact");
  expect(url.searchParams.get("product")).toBe(product);
  expect(parseSupportPrefill(Object.fromEntries(url.searchParams))).toEqual({ ...blank, topic: "product-return", product });
  for (const value of ["r".repeat(301), "Ryan\npin", "Ryan\u0000pin"]) {
    expect(parseSupportPrefill({ topic: "product-return", product: value })).toEqual({ ...blank, topic: "product-return" });
  }
  expect(parseSupportPrefill({ product })).toEqual(blank);
});

test("an email must be the whole value, not just contain an address", () => {
  for (const email of ["ryan@example.com", " ryan@example.com ", "ryan+merch@sub.example.co"]) expect(validateEmail(email)).toBe(true);
  for (const email of ["not an email: ryan@example.com", "ryan bryan@example.com", "ryan@example.com <script>", "ryan@example", "@example.com", "", `${"r".repeat(250)}@example.com`]) {
    expect(validateEmail(email)).toBe(false);
  }
});
