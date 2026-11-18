import { ANONYMOUS_REVIEWER_NAME, reviewDisplayName, reviewResultSchema } from "@ryanmeetup/reviews";
import type { BuyerReview, BuyerReviewPage, ReviewNameStyle } from "@ryanmeetup/reviews";
import type { ReviewBuyerName } from "./review-purchases";

export type MyReviewView = { page: BuyerReviewPage; buyerName: ReviewBuyerName | null; viewerKey: string };

export function buyerReviewNameChoices(review: BuyerReview, name: ReviewBuyerName | null) {
  const choices = new Map<ReviewNameStyle,string>();
  if (name?.firstName) for (const style of ["full","first-initial"] as const) choices.set(style,reviewDisplayName(style,name));
  choices.set("anonymous", ANONYMOUS_REVIEWER_NAME);
  // Unchanged styles preserve the name already stored with the review.
  choices.set(review.current.nameStyle,review.current.displayName);
  return [...choices].map(([style,displayName]) => ({ style,displayName }));
}

export function myReviewViewSchema(value: unknown): MyReviewView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string,unknown>;
  if (Object.keys(row).length !== 3 || typeof row.viewerKey !== "string" || !/^[a-f0-9]{64}$/.test(row.viewerKey)) return null;
  const page = reviewResultSchema("reviews.mine",{data:row.page});
  if (!page) return null;
  const name = row.buyerName as ReviewBuyerName | null;
  if (name !== null && (!name || typeof name !== "object" || Array.isArray(name) || Object.keys(name).length !== 2 ||
    ![name.firstName,name.lastName].every((part) => part === null || (typeof part === "string" && [...part].length <= 255)))) return null;
  return { page:page.data,buyerName:name,viewerKey:row.viewerKey };
}
