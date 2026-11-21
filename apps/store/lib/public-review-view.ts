import { PUBLIC_REVIEW_OFFSET_MAX, PUBLIC_REVIEW_QUERY_MAX, PUBLIC_REVIEW_SORTS, PUBLIC_REVIEW_SOURCES } from "@ryanmeetup/reviews";
import type { PublicReview, PublicReviewPage, PublicReviewSearch, PublicReviewSort, PublicReviewSource, ReviewStar } from "@ryanmeetup/reviews";
import { parsePagination } from "@ryanmeetup/utils";
import { publishedReviewPhotoUrl } from "./review-photo-hosts";
import type { Review, ReviewsData } from "./types";

/** Page sizes a reader may choose for review cards; storage serves at most 50 a page. */
export const REVIEW_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export const PUBLIC_REVIEW_PAGE_SIZE = 25;

export const REVIEW_RATING_OPTIONS = [
  { value: "all", label: "All ratings" },
  // Each option is a star and the half star below it, matching the summary buckets.
  ...[5, 4, 3, 2, 1].map((star) => ({ value: String(star), label: `${star - 0.5}–${star} stars` })),
];
export const REVIEW_SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];

/** Where a review came from, named as its badge names it. Values stay readable because they reach the URL. */
export const REVIEW_ORIGIN_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "verified", label: "Verified purchase" },
  { value: "etsy", label: "Verified Etsy purchase" },
  { value: "unmatched", label: "No matching order" },
];

/**
 * What a reader chose for a review list, as it appears in a shareable URL.
 * Storage does the filtering, sorting and searching, so every page agrees.
 */
export type ReviewView = { page: number; pageSize: number; rating: string; origin: string; sort: string; query: string };
export const DEFAULT_REVIEW_VIEW: ReviewView = { page: 1, pageSize: PUBLIC_REVIEW_PAGE_SIZE, rating: "all", origin: "all", sort: "newest", query: "" };

/** URL parameter names for one review list. Product pages prefix theirs so they never meet the product's own. */
export type ReviewViewParams = Record<keyof ReviewView, string>;
export const FEED_REVIEW_PARAMS: ReviewViewParams = { page: "page", pageSize: "pageSize", rating: "rating", origin: "source", sort: "sort", query: "q" };
export const PRODUCT_REVIEW_PARAMS: ReviewViewParams = {
  page: "reviewPage", pageSize: "reviewPageSize", rating: "reviewRating", origin: "reviewSource", sort: "reviewSort", query: "reviewQuery",
};

type ParamReader = { get(name: string): string | null };

/** Unknown or malformed values fall back to the default, so an old or mistyped link still shows reviews. */
export function parseReviewView(params: ParamReader, names: ReviewViewParams): ReviewView {
  const { requestedPage, pageSize: requestedSize } = parsePagination(params, {
    pageParam: names.page, pageSizeParam: names.pageSize, defaultPageSize: PUBLIC_REVIEW_PAGE_SIZE, maxPageSize: Math.max(...REVIEW_PAGE_SIZE_OPTIONS),
  });
  const pageSize = (REVIEW_PAGE_SIZE_OPTIONS as readonly number[]).includes(requestedSize) ? requestedSize : PUBLIC_REVIEW_PAGE_SIZE;
  const rating = params.get(names.rating) ?? "";
  const origin = params.get(names.origin) ?? "";
  const sort = params.get(names.sort) ?? "";
  const query = (params.get(names.query) ?? "").trim();
  return {
    // Storage clamps a page past the end to the real last page; this only bounds a hostile number.
    page: Math.min(requestedPage, Math.floor(PUBLIC_REVIEW_OFFSET_MAX / pageSize) + 1),
    pageSize,
    rating: /^[1-5]$/.test(rating) ? rating : "all",
    origin: PUBLIC_REVIEW_SOURCES.includes(origin as PublicReviewSource) ? origin : "all",
    sort: PUBLIC_REVIEW_SORTS.includes(sort as PublicReviewSort) ? sort : "newest",
    query: [...query].length <= PUBLIC_REVIEW_QUERY_MAX && !/[\u0000-\u001f\u007f]/u.test(query) ? query : "",
  };
}

/** Writes only what differs from the default, onto existing parameters. */
export function writeReviewView(params: URLSearchParams, view: ReviewView, names: ReviewViewParams) {
  for (const key of Object.keys(names) as (keyof ReviewView)[]) {
    const value = String(view[key]);
    if (value === String(DEFAULT_REVIEW_VIEW[key])) params.delete(names[key]);
    else params.set(names[key], value);
  }
  return params;
}

export const reviewViewKey = (view: ReviewView) => writeReviewView(new URLSearchParams(), view, FEED_REVIEW_PARAMS).toString();
export const isRefinedReviewView = (view: ReviewView) =>
  view.rating !== "all" || view.origin !== "all" || view.sort !== "newest" || view.query !== "";

export function reviewViewSearch(view: ReviewView): PublicReviewSearch {
  return {
    rating: view.rating === "all" ? null : Number(view.rating) as ReviewStar,
    source: view.origin === "all" ? null : view.origin as PublicReviewSource,
    sort: view.sort as PublicReviewSort,
    query: view.query,
  };
}

export const reviewViewOffset = (view: ReviewView) => (view.page - 1) * view.pageSize;
export const reviewPageNumber = (offset: number, pageSize: number) => Math.floor(offset / pageSize) + 1;

/** A numbered page of review cards: the served page, how many match, and where the page starts. */
export type ReviewListPage<T> = { reviews: T[]; total: number; offset: number };

/** The same public fields and approved photo paths in every Store review card. */
export function toReview(review: PublicReview): Review {
  const photoUrls = review.photos.flatMap((photo) => publishedReviewPhotoUrl(photo.url) ?? []);
  return {
    id: review.id, rating: review.rating, title: review.title, body: review.body,
    reviewerName: review.displayName, createdAt: review.publishedAt,
    verification: review.source === "etsy" ? "etsy" as const : review.verifiedPurchase ? "purchase" as const : null,
    ...(photoUrls.length ? { photoUrls } : {}),
    ...(review.reply ? { reply: { body: review.reply.body, publishedAt: review.reply.publishedAt } } : {}),
  };
}

/** Shared server/browser projection; no database client or buyer data belongs here. */
export function toReviewsData(page: PublicReviewPage): Extract<ReviewsData, { status: "available" }> {
  return {
    status: "available",
    averageRating: page.summary.average,
    count: page.summary.count,
    reviews: page.reviews.map(toReview),
    ...(page.scope.productIds.length === 1 ? { productId: page.scope.productIds[0] } : {}),
  };
}
