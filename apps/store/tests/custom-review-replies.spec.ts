import { expect, test } from "@playwright/test";
import type { PublicReviewPage } from "@ryanmeetup/reviews";
import { toReviewsData } from "../lib/public-review-view";

const reply = { body: "Thanks for reporting back!\n\nGlad it fits.", publishedAt: "2026-11-18T00:30:00.000Z" };
const page: PublicReviewPage = {
  scope: { productIds: ["100"] },
  summary: { count: 25, average: 4, distribution: { 1: 0, 2: 0, 3: 0, 4: 25, 5: 0 } },
  reviews: [{
    id: "00000000-0000-4000-8000-000000000001", rating: 4, title: "Ryan approved", body: "Still looking good.",
    displayName: "Ryan F.", publishedAt: "2026-11-17T12:00:00.000Z", editedAt: null,
    item: { productId: "100", productTitle: "Name Tag Shirt", variantTitle: null }, verifiedPurchase: true, source: "store",
    photos: [], reply,
  }],
  nextCursor: null,
};

test("the storefront retains only a reply's public text/date and keeps complete review totals unchanged", () => {
  const withPrivateFields = { ...reply, author: "private-staff-id", updatedAt: "private-version", moderationNote: "Private reason" };
  const data = toReviewsData({ ...page, reviews: [{ ...page.reviews[0], reply: withPrivateFields }] });
  expect(data.reviews[0].reply).toEqual(reply);
  expect(data).toMatchObject({ count: 25, averageRating: 4 });
  expect(JSON.stringify(data)).not.toMatch(/private-staff-id|private-version|Private reason/);
});

test("removed or absent replies do not leave a reply placeholder in the storefront view", () => {
  const data = toReviewsData({ ...page, reviews: [{ ...page.reviews[0], reply: null }] });
  expect(data.reviews[0]).not.toHaveProperty("reply");
});
