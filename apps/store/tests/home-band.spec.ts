import { expect, test } from "@playwright/test";
import { buildHomeBand, describeShopRating, getHomeBandFacts, SUPPORT_PHRASE } from "../lib/home-band";
import type { Promotion } from "../lib/promotion";

const policy = { handle: "shipping-policy", title: "Shipping Policy", body: "<h2>Production time</h2><p>Please allow 2 - 7 business days for it to be produced.</p>" };

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

test("band facts say why to buy, the rating, then the policy's timing and checkout's countries", () => {
  expect(getHomeBandFacts({ average: 4.8, count: 52 }, [policy], ["US", "CA", "CA"])).toEqual([
    SUPPORT_PHRASE, "4.8 stars from 52 reviews", "Made to order in 2–7 business days", "Ships to 2 countries and regions",
  ]);
  // An unreadable rating, policy, or country list leaves out what it would have said.
  expect(getHomeBandFacts(null, [], [])).toEqual([SUPPORT_PHRASE, "Made to order"]);
});

test("the band is only facts, with a regular sale up front and a takeover sale left out", () => {
  const facts = ["4.8 stars from 52 reviews", "Made to order"];
  expect(buildHomeBand(null, facts)).toEqual(facts);
  expect(buildHomeBand(sale, facts)).toEqual(["Black RYDay", "Up to 20% off", "Ends Nov 30", ...facts]);
  expect(buildHomeBand({ ...sale, takeover: true }, facts)).toEqual(facts);
});
