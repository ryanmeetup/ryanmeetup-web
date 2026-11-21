import { isPublicReviewPhotoPath } from "./public-photo-path";

/**
 * Review content contract shared by the storefront and the review backend.
 * Buyer input is normalized here, and public payloads are checked against an
 * exact allowlist so order, customer, draft, and moderation data can never
 * reach a browser through a review read.
 */

export const REVIEW_TITLE_MAX = 100;
export const REVIEW_BODY_MAX = 5000;
export const REVIEW_DISPLAY_NAME_MAX = 60;
export const REVIEW_REPLY_MAX = 2000;
export const REVIEW_PHOTOS_MAX = 5;
export const REVIEW_PAGE_MAX = 50;
/** Shown when a buyer chooses not to be named, or has no usable name. */
export const ANONYMOUS_REVIEWER_NAME = "Anonymous";

/** Half-star steps from 0.5 to 5. */
export type ReviewRating = 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;
export const REVIEW_RATINGS: readonly ReviewRating[] = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

/** A whole star, the unit summaries and filters group ratings by. */
export type ReviewStar = 1 | 2 | 3 | 4 | 5;
export const REVIEW_STARS: readonly ReviewStar[] = [1, 2, 3, 4, 5];
/** The star a rating fills: 4.5 counts toward 5, 0.5 toward 1. */
export const reviewRatingStar = (rating: ReviewRating) => Math.ceil(rating) as ReviewStar;

/** How a buyer's name appears publicly. */
export type ReviewNameStyle = "full" | "first-initial" | "anonymous";
export const REVIEW_NAME_STYLES: readonly ReviewNameStyle[] = ["full", "first-initial", "anonymous"];

/** What a signed-in buyer sends. The purchased line is chosen separately and verified server-side. */
export type ReviewSubmission = {
  rating: ReviewRating;
  title: string;
  body: string;
  nameStyle: ReviewNameStyle;
};

/** Where a review was written: on this store, or imported from the Ryan Meetup Etsy shop. */
export type ReviewSource = "store" | "etsy";
export const REVIEW_SOURCES: readonly ReviewSource[] = ["store", "etsy"];

export type PublicReviewPhoto = { url: string; width: number; height: number };
export type PublicReviewReply = { body: string; publishedAt: string };

/** A snapshot of what was bought, kept even if the product is renamed later. */
export type PublicReviewItem = {
  productId: string;
  productTitle: string;
  variantTitle: string | null;
};

/** Everything a browser may see about one published review, and nothing else. */
export type PublicReview = {
  id: string;
  rating: ReviewRating;
  /** Null only for an imported review; Etsy reviews have no title. */
  title: string | null;
  body: string;
  displayName: string;
  publishedAt: string;
  /** Set when a buyer's edit was approved after first publication. */
  editedAt: string | null;
  item: PublicReviewItem;
  /** True only when the exact purchased order line was verified. */
  verifiedPurchase: boolean;
  /** An Etsy review was left by an Etsy buyer; Etsy only lets buyers review. */
  source: ReviewSource;
  photos: PublicReviewPhoto[];
  reply: PublicReviewReply | null;
};

/** Ratings counted by the star they fill, so a half star joins the star above it. */
export type ReviewDistribution = Record<ReviewStar, number>;

export type ReviewSummary = {
  count: number;
  /** Mean of every published rating in scope; 0 when there are none. Format for display at the edge. */
  average: number;
  distribution: ReviewDistribution;
};

/** The products a listing's reviews and totals are drawn from. One product unless deliberately grouped. */
export type ReviewScope = { productIds: string[] };

export type PublicReviewPage = {
  scope: ReviewScope;
  summary: ReviewSummary;
  reviews: PublicReview[];
  /** Opaque; pass back to read the next page. */
  nextCursor: string | null;
};

// --- helpers -----------------------------------------------------------------

function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return Object.keys(record).every((key) => keys.includes(key)) && keys.every((key) => key in record) ? record : null;
}

/** Length in characters as people count them, so an emoji is one, not two. */
const characters = (value: string) => [...value].length;

/** Drops control characters but keeps line breaks and tabs in long text. */
function cleanText(value: string, multiline: boolean) {
  const stripped = value.normalize("NFC").replace(multiline ? /[\u0000-\u0008\u000b-\u001f\u007f]/gu : /[\u0000-\u001f\u007f]/gu, multiline ? "" : " ");
  return multiline
    ? stripped.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
    : stripped.replace(/\s+/gu, " ").trim();
}

const isRating = (value: unknown): value is ReviewRating => REVIEW_RATINGS.includes(value as ReviewRating);
const isNameStyle = (value: unknown): value is ReviewNameStyle => REVIEW_NAME_STYLES.includes(value as ReviewNameStyle);
const isProductId = (value: unknown): value is string => typeof value === "string" && /^[1-9][0-9]{0,19}$/.test(value);
const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value) && !Number.isNaN(Date.parse(value));
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Already-clean text within a limit: what a trustworthy backend sends. */
function isCleanText(value: unknown, max: number, multiline: boolean, allowEmpty = false): value is string {
  return typeof value === "string" && (allowEmpty || value.length > 0) && characters(value) <= max && cleanText(value, multiline) === value;
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.href === value;
  } catch {
    return false;
  }
}

// --- buyer input -------------------------------------------------------------

/** Normalize an official public reply, or reject empty/oversized content. */
export function reviewReplyBodySchema(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const body = cleanText(value, true);
  return body && characters(body) <= REVIEW_REPLY_MAX ? body : null;
}

/**
 * Normalizes a buyer's submission, or returns null when it can't be accepted.
 * Whitespace and control characters are cleaned before limits are checked; the
 * title and body are both required.
 */
export function reviewSubmissionSchema(value: unknown): ReviewSubmission | null {
  const input = exactObject(value, ["rating", "title", "body", "nameStyle"]);
  if (!input || !isRating(input.rating) || !isNameStyle(input.nameStyle)) return null;
  if (typeof input.body !== "string" || typeof input.title !== "string") return null;
  const body = cleanText(input.body, true);
  const title = cleanText(input.title, false);
  if (!body || !title || characters(body) > REVIEW_BODY_MAX || characters(title) > REVIEW_TITLE_MAX) return null;
  return { rating: input.rating, title, body, nameStyle: input.nameStyle };
}

/**
 * The exact public name for a buyer's chosen style. The composer's preview and
 * the stored review both come from this, so they cannot disagree.
 */
export function reviewDisplayName(style: ReviewNameStyle, name: { firstName?: string | null; lastName?: string | null }) {
  const first = cleanText(name.firstName ?? "", false);
  const last = cleanText(name.lastName ?? "", false);
  if (style === "anonymous" || !first) return ANONYMOUS_REVIEWER_NAME;
  const initial = [...last][0]?.toLocaleUpperCase();
  const display = style === "full" ? [first, last].filter(Boolean).join(" ") : initial ? `${first} ${initial}.` : first;
  return [...display].slice(0, REVIEW_DISPLAY_NAME_MAX).join("").trim();
}

/**
 * Normalizes an imported review's text, which has no title. Returns null when
 * the rating, body or name can't be published. The same rules as a buyer's
 * submission, so stored text always passes the public schema.
 */
export function importedReviewContentSchema(value: { rating: unknown; body: unknown; displayName: unknown }): { rating: ReviewRating; body: string; displayName: string } | null {
  if (!isRating(value.rating) || typeof value.body !== "string" || typeof value.displayName !== "string") return null;
  const body = cleanText(value.body, true);
  const displayName = cleanText(value.displayName, false);
  return body && characters(body) <= REVIEW_BODY_MAX && displayName && characters(displayName) <= REVIEW_DISPLAY_NAME_MAX
    ? { rating: value.rating, body, displayName } : null;
}

// --- totals ------------------------------------------------------------------

/** Totals from every published rating in scope, independent of which page is shown. */
export function summarizeReviewRatings(ratings: readonly ReviewRating[]): ReviewSummary {
  const distribution: ReviewDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const rating of ratings) {
    if (!isRating(rating)) throw new Error("A review rating must be a half-star step from 0.5 to 5.");
    distribution[reviewRatingStar(rating)] += 1;
    total += rating;
  }
  return { count: ratings.length, average: ratings.length ? total / ratings.length : 0, distribution };
}

// --- public payloads ---------------------------------------------------------

function itemSchema(value: unknown): PublicReviewItem | null {
  const item = exactObject(value, ["productId", "productTitle", "variantTitle"]);
  return item && isProductId(item.productId) && isCleanText(item.productTitle, 255, false) &&
    (item.variantTitle === null || isCleanText(item.variantTitle, 255, false))
    ? (item as PublicReviewItem) : null;
}

function photoSchema(value: unknown): PublicReviewPhoto | null {
  const photo = exactObject(value, ["url", "width", "height"]);
  return photo && (isHttpsUrl(photo.url) || isPublicReviewPhotoPath(photo.url)) && isCount(photo.width) && photo.width > 0 && isCount(photo.height) && photo.height > 0
    ? (photo as PublicReviewPhoto) : null;
}

function replySchema(value: unknown): PublicReviewReply | null {
  const reply = exactObject(value, ["body", "publishedAt"]);
  return reply && isCleanText(reply.body, REVIEW_REPLY_MAX, true) && isIsoDate(reply.publishedAt) ? (reply as PublicReviewReply) : null;
}

/** Accepts one published review only if it has exactly the public fields, all well formed. */
export function publicReviewSchema(value: unknown): PublicReview | null {
  const fields = ["id", "rating", "title", "body", "displayName", "publishedAt", "editedAt", "item", "verifiedPurchase", "photos", "reply"];
  // A backend from before 20261121150000 sends no source; every review it holds was written here.
  const review = exactObject(value, [...fields, "source"]) ?? exactObject(value, fields);
  const source = review ? review.source ?? "store" : null;
  if (!review || !isUuid(review.id) || !isRating(review.rating) || typeof review.verifiedPurchase !== "boolean" ||
    !REVIEW_SOURCES.includes(source as ReviewSource)) return null;
  if (!(review.title === null ? source !== "store" : isCleanText(review.title, REVIEW_TITLE_MAX, false))) return null;
  if (!isCleanText(review.body, REVIEW_BODY_MAX, true) || !isCleanText(review.displayName, REVIEW_DISPLAY_NAME_MAX, false)) return null;
  if (!isIsoDate(review.publishedAt) || !(review.editedAt === null || isIsoDate(review.editedAt))) return null;
  if (!itemSchema(review.item) || !(review.reply === null || replySchema(review.reply))) return null;
  if (!Array.isArray(review.photos) || review.photos.length > REVIEW_PHOTOS_MAX || !review.photos.every((photo) => photoSchema(photo))) return null;
  return { ...review, source } as PublicReview;
}

/**
 * A rating summary whose count and average agree with its own distribution.
 * Each bucket holds ratings of its star or half a star less, which bounds the
 * average: all whole stars at the top, all half stars at the bottom.
 */
export function reviewSummarySchema(value: unknown): ReviewSummary | null {
  const summary = exactObject(value, ["count", "average", "distribution"]);
  const distribution = summary && exactObject(summary.distribution, REVIEW_STARS.map(String));
  if (!summary || !distribution || !isCount(summary.count) || typeof summary.average !== "number") return null;
  const counts = REVIEW_STARS.map((star) => distribution[star]);
  if (!counts.every(isCount)) return null;
  const count = (counts as number[]).reduce((sum, n) => sum + n, 0);
  if (count !== summary.count) return null;
  if (!count) return summary.average === 0 ? (summary as ReviewSummary) : null;
  const highest = (counts as number[]).reduce((sum, n, index) => sum + n * REVIEW_STARS[index], 0) / count;
  // Totals must add up, so a summary can't drift from its own distribution.
  return summary.average >= highest - 0.5 - 1e-9 && summary.average <= highest + 1e-9 ? (summary as ReviewSummary) : null;
}

/**
 * Accepts a page of public reviews only if every review is public-shaped, the
 * page is bounded, and each review belongs to the stated scope.
 */
export function publicReviewPageSchema(value: unknown): PublicReviewPage | null {
  const page = exactObject(value, ["scope", "summary", "reviews", "nextCursor"]);
  const scope = page && exactObject(page.scope, ["productIds"]);
  if (!page || !scope || !Array.isArray(scope.productIds) || !scope.productIds.length || scope.productIds.length > 50 ||
    !scope.productIds.every(isProductId) || new Set(scope.productIds).size !== scope.productIds.length) return null;
  const summary = reviewSummarySchema(page.summary);
  if (!summary || !Array.isArray(page.reviews) || page.reviews.length > REVIEW_PAGE_MAX || page.reviews.length > summary.count) return null;
  const productIds = new Set(scope.productIds as string[]);
  const reviews = page.reviews.map(publicReviewSchema);
  if (reviews.some((review) => !review || !productIds.has(review.item.productId))) return null;
  if (new Set(reviews.map((review) => review!.id)).size !== reviews.length) return null;
  if (!(page.nextCursor === null || (typeof page.nextCursor === "string" && /^[A-Za-z0-9_-]{1,512}$/.test(page.nextCursor)))) return null;
  return page as PublicReviewPage;
}
