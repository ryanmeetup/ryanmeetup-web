import { expect, test } from "@playwright/test";
import { getAdminOrderSearchUrl, getAdminOrdersUrl, parseSupportPrefill } from "../lib/support";
import { validateEmail } from "@ryanmeetup/utils";

test("order links from Shopify prefill a readable order number and drop anything malformed", () => {
  expect(parseSupportPrefill({ order: "1042", email: " ryan@example.com " })).toEqual({ order: "#1042", email: "ryan@example.com" });
  expect(parseSupportPrefill({ order: "#RM-1042" })).toEqual({ order: "#RM-1042", email: "" });
  expect(parseSupportPrefill({ order: ["1001", "1002"], email: ["a@b.co"] })).toEqual({ order: "#1001", email: "a@b.co" });
  expect(parseSupportPrefill({ order: "<script>", email: "not-an-email" })).toEqual({ order: "", email: "" });
  expect(parseSupportPrefill({})).toEqual({ order: "", email: "" });
});

test("the Shopify Admin link searches by order number, falling back to the customer's email", () => {
  const orders = getAdminOrdersUrl("https://ryan-meetup-store.myshopify.com/");
  expect(orders).toBe("https://admin.shopify.com/store/ryan-meetup-store/orders");
  expect(getAdminOrderSearchUrl(orders!, "#1042", "ryan@example.com")).toBe(`${orders}?query=1042`);
  expect(getAdminOrderSearchUrl(orders!, " ", "ryan+merch@example.com")).toBe(`${orders}?query=ryan%2Bmerch%40example.com`);
  expect(getAdminOrdersUrl("store.ryanmeetup.com")).toBeNull();
  expect(getAdminOrdersUrl(undefined)).toBeNull();
});

test("an email must be the whole value, not just contain an address", () => {
  for (const email of ["ryan@example.com", " ryan@example.com ", "ryan+merch@sub.example.co"]) expect(validateEmail(email)).toBe(true);
  for (const email of ["not an email: ryan@example.com", "ryan bryan@example.com", "ryan@example.com <script>", "ryan@example", "@example.com", "", `${"r".repeat(250)}@example.com`]) {
    expect(validateEmail(email)).toBe(false);
  }
});
