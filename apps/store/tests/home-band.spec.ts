import { expect, test } from "@playwright/test";
import { buildHomeBand, describeShopRating, getHomeBandFacts } from "../lib/home-band";
import type { ShippingExpectation } from "../lib/product-guidance";
import type { Promotion } from "../lib/promotion";

const shipping: ShippingExpectation[] = [
  { id: "production", title: "Made to order", detail: "2–7 business days to make, then it ships" },
  { id: "countries", title: "Ships to 28 countries and regions", detail: "Shipping costs shown at checkout" },
  { id: "tracking", title: "Tracking by email", detail: "Sent as soon as it ships" },
];

const sale: Promotion = {
  name: "Black RYDay",
  startsAt: "2026-11-21T00:00:00-05:00",
  endsAt: "2026-12-01T00:00:00-05:00",
  endsLabel: "Nov 30",
  tiers: [{ minQuantity: 1, percentOff: 10 }, { minQuantity: 3, percentOff: 15 }, { minQuantity: 5, percentOff: 20 }],
};

test("the shop rating is claimed only once there are enough reviews to trust it", () => {
  expect(describeShopRating({ average: 4.873, count: 1240 })).toBe("4.9 stars from 1,240 reviews");
  expect(describeShopRating({ average: 5, count: 4 })).toBeNull();
  expect(describeShopRating(null)).toBeNull();
});

test("band facts lead with the rating, then the production and shipping headlines", () => {
  expect(getHomeBandFacts({ average: 4.8, count: 52 }, shipping)).toEqual(["4.8 stars from 52 reviews", "Made to order", "Ships to 28 countries and regions"]);
  // An unreadable rating or policy leaves out what it would have said.
  expect(getHomeBandFacts(null, [shipping[0]])).toEqual(["Made to order"]);
});

test("the band puts the name between facts, a regular sale up front, and skips a takeover sale", () => {
  const facts = ["4.8 stars from 52 reviews", "Made to order"];
  expect(buildHomeBand(null, facts)).toEqual({ items: ["Ryan", facts[0], "Ryan", facts[1]], spoken: facts });
  expect(buildHomeBand(sale, facts)).toEqual({
    items: ["Black RYDay", "Up to 20% off", "Ends Nov 30", "Ryan", facts[0], "Ryan", facts[1]],
    spoken: ["Black RYDay", "Up to 20% off", "Ends Nov 30", ...facts],
  });
  expect(buildHomeBand({ ...sale, takeover: true }, facts).items).toEqual(["Ryan", facts[0], "Ryan", facts[1]]);
  expect(buildHomeBand(null, [])).toEqual({ items: ["Ryan"], spoken: [] });
});
