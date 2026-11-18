import { describe, expect, it } from "vitest";
import {
  ANONYMOUS_REVIEWER_NAME,
  REVIEW_BODY_MAX,
  REVIEW_PAGE_MAX,
  publicReviewPageSchema,
  publicReviewSchema,
  reviewDisplayName,
  reviewSubmissionSchema,
  summarizeReviewRatings,
  type PublicReview,
} from "@ryanmeetup/reviews";

const review: PublicReview = {
  id: "3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
  rating: 5,
  title: "Fits like a Ryan",
  body: "Great shirt.\n\nWashed it twice and the name tag still pops.",
  displayName: "Ryan L.",
  publishedAt: "2026-11-17T20:00:00.000Z",
  editedAt: null,
  item: { productId: "8123456789", productTitle: "Name Tag Shirt", variantTitle: "Black / M" },
  verifiedPurchase: true,
  photos: [{ url: "https://cdn.example.test/reviews/a.webp", width: 1200, height: 900 }],
  reply: { body: "Thanks, Ryan!", publishedAt: "2026-11-18T09:00:00.000Z" },
};
const summary = summarizeReviewRatings([5, 4, 5]);
const page = { scope: { productIds: ["8123456789"] }, summary, reviews: [review], nextCursor: null };

describe("review submissions", () => {
  it("cleans text, keeps paragraphs, and turns a blank title into none", () => {
    expect(
      reviewSubmissionSchema({ rating: 4, title: "   ", body: "  Line one  \r\n\r\n\r\n\r\nLine\u0007 two ", nameStyle: "first-initial" }),
    ).toEqual({ rating: 4, title: null, body: "Line one\n\nLine two", nameStyle: "first-initial" });
    expect(reviewSubmissionSchema({ rating: 5, title: "  Big\tfan ", body: "Yes", nameStyle: "full" })?.title).toBe("Big fan");
  });

  it("accepts only whole stars, a real body, a known name style, and no extra fields", () => {
    const valid = { rating: 3, title: null, body: "Fine", nameStyle: "anonymous" };
    expect(reviewSubmissionSchema(valid)).not.toBeNull();
    for (const change of [
      { rating: 0 }, { rating: 4.5 }, { rating: "5" }, { body: " \n " }, { body: "x".repeat(REVIEW_BODY_MAX + 1) },
      { title: "t".repeat(101) }, { nameStyle: "email" }, { productId: "8123456789" }, { verifiedPurchase: true },
    ]) {
      expect(reviewSubmissionSchema({ ...valid, ...change })).toBeNull();
    }
    expect(reviewSubmissionSchema({ rating: 3, body: "Fine", nameStyle: "anonymous" })).toBeNull();
  });

  it("counts characters as people do, so emoji don't eat the limit twice", () => {
    expect(reviewSubmissionSchema({ rating: 5, title: null, body: "🎉".repeat(REVIEW_BODY_MAX), nameStyle: "full" })).not.toBeNull();
  });
});

describe("public reviewer names", () => {
  it("formats each style and falls back to anonymous without a first name", () => {
    const name = { firstName: " ryan ", lastName: "le" };
    expect(reviewDisplayName("full", name)).toBe("ryan le");
    expect(reviewDisplayName("first-initial", name)).toBe("ryan L.");
    expect(reviewDisplayName("first-initial", { firstName: "Ryan", lastName: "" })).toBe("Ryan");
    expect(reviewDisplayName("anonymous", name)).toBe(ANONYMOUS_REVIEWER_NAME);
    expect(reviewDisplayName("full", { firstName: null, lastName: "Le" })).toBe(ANONYMOUS_REVIEWER_NAME);
    expect(reviewDisplayName("full", { firstName: "R".repeat(80), lastName: "Le" })).toHaveLength(60);
  });
});

describe("review totals", () => {
  it("counts every rating, not just a page of them", () => {
    const ratings = Array.from({ length: 120 }, (_, i) => ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5);
    expect(summarizeReviewRatings(ratings)).toEqual({ count: 120, average: 3, distribution: { 1: 24, 2: 24, 3: 24, 4: 24, 5: 24 } });
    expect(summarizeReviewRatings([])).toEqual({ count: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
  });
});

describe("public review payloads", () => {
  it("accepts exactly the public fields", () => {
    expect(publicReviewSchema(review)).toEqual(review);
    expect(publicReviewPageSchema(page)).toEqual(page);
  });

  it("refuses private, unsafe, or malformed review data", () => {
    for (const change of [
      { orderId: "gid://shopify/Order/1" }, { customerEmail: "ryan@example.com" }, { status: "pending" },
      { rating: 6 }, { body: "  padded  " }, { displayName: "" }, { publishedAt: "yesterday" },
      { photos: [{ url: "http://cdn.example.test/a.webp", width: 1, height: 1 }] },
      { photos: [{ url: "javascript:alert(1)", width: 1, height: 1 }] },
      { photos: Array.from({ length: 6 }, () => review.photos[0]) },
      { item: { ...review.item, orderLineId: "1" } }, { reply: { body: "Hi", publishedAt: "2026-11-18", staffNote: "x" } },
    ]) {
      expect(publicReviewSchema({ ...review, ...change })).toBeNull();
    }
    expect(publicReviewSchema(Object.fromEntries(Object.entries(review).filter(([key]) => key !== "reply")))).toBeNull();
  });

  it("refuses pages whose totals don't add up or whose reviews fall outside the scope", () => {
    for (const change of [
      { summary: { ...summary, count: 4 } },
      { summary: { ...summary, average: 5 } },
      { scope: { productIds: ["999"] } },
      { scope: { productIds: [] } },
      { reviews: [review, review] },
      { reviews: Array.from({ length: REVIEW_PAGE_MAX + 1 }, () => review) },
      { nextCursor: "has spaces" },
    ]) {
      expect(publicReviewPageSchema({ ...page, ...change })).toBeNull();
    }
  });
});
