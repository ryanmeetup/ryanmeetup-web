import { expect, test } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicReviewPage } from "@ryanmeetup/reviews";
import { Reviews } from "../components/reviews";
import { toReviewsData } from "../lib/public-review-view";
import type { ReviewsData } from "../lib/types";
import { tee } from "./fixtures/products";

const page: PublicReviewPage = {
  scope: { productIds: ["100"] },
  summary: { count: 2, average: 4, distribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 0 } },
  reviews: [true, false].map((verifiedPurchase, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index + 1}`, rating: 4, title: "Ryan approved", body: "Public feedback.",
    displayName: `Ryan ${index}`, publishedAt: "2026-11-20T12:00:00.000Z", editedAt: null,
    item: { productId: "100", productTitle: "Shirt", variantTitle: null }, verifiedPurchase, photos: [], reply: null,
  })),
  nextCursor: null,
};

function render(data: ReviewsData) {
  return renderToStaticMarkup(createElement(Reviews, { product: tee, data, access: { status: "unavailable" } }));
}

test("only the canonical custom purchase flag gives a purchase badge, while totals stay unchanged", () => {
  const data = toReviewsData({ ...page, reviews: page.reviews.map((review) => ({ ...review, verified: "confirmed-buyer" })) });
  expect(data.reviews.map((review) => review.verification)).toEqual(["purchase", null]);
  expect(data).toMatchObject({ count: 2, averageRating: 4 });
  const html = render(data);
  expect(html.match(/Verified purchase/g)).toHaveLength(1);
  expect(html).not.toContain("Verified review");
  expect(html).toContain("Review by Ryan 1");
});

test("legacy review verification keeps its meaning even alongside custom purchase verification", () => {
  const data = toReviewsData(page);
  const html = render({ ...data, reviews: [data.reviews[0], { ...data.reviews[1], verification: "review" }] });
  expect(html.match(/Verified purchase/g)).toHaveLength(1);
  expect(html.match(/Verified review/g)).toHaveLength(1);
});

test("an unverified public review remains visible without either verification badge", () => {
  const data = toReviewsData({ ...page, reviews: [page.reviews[1]] });
  const html = render(data);
  expect(html).toContain("Public feedback.");
  expect(html).toContain("Review by Ryan 1");
  expect(html).not.toContain("Verified purchase");
  expect(html).not.toContain("Verified review");
});
