/**
 * Private server-to-server contract between the storefront and the review
 * backend. The storefront sends only what it has already verified: the buyer's
 * Shopify subject from their session, and the purchased line from Shopify.
 * The backend pins the shop from its own configuration. Never expose these
 * commands to a browser.
 */

import {
  REVIEW_DISPLAY_NAME_MAX,
  REVIEW_PAGE_MAX,
  publicReviewPageSchema,
  reviewSubmissionSchema,
  type PublicReviewItem,
  type PublicReviewPage,
  type ReviewSubmission,
} from "./content";

export const reviewBackendPath = "/api/store/reviews";

/** A purchased order line the storefront has verified with Shopify. */
export type ReviewPurchase = {
  orderId: string;
  lineId: string;
  productId: string;
  variantId: string | null;
  productTitle: string;
  variantTitle: string | null;
};

/** How a buyer's own review stands, in words they can act on. */
export type BuyerReviewStatus = "pending" | "published" | "rejected" | "hidden" | "withdrawn";

/** One of the signed-in buyer's own reviews, for "My reviews". Never public. */
export type BuyerReview = {
  id: string;
  lineId: string;
  item: PublicReviewItem;
  status: BuyerReviewStatus;
  /** Published, with a newer edit waiting for approval. */
  hasPendingEdit: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** What the buyer last wrote: a waiting edit, else the live version, else their latest attempt. */
  current: ReviewSubmission & { displayName: string };
};

export type BuyerReviewPage = { reviews: BuyerReview[]; nextCursor: string | null };
export type BuyerReviewCursor = { createdAt: string; id: string };

export type ReviewCommand =
  | { operation: "review.submit"; subject: string; purchase: ReviewPurchase; submission: ReviewSubmission; displayName: string }
  | { operation: "review.edit"; subject: string; reviewId: string; expectedUpdatedAt: string; submission: ReviewSubmission; displayName: string }
  | { operation: "review.withdraw"; subject: string; reviewId: string; expectedUpdatedAt: string }
  | { operation: "reviews.page"; productIds: string[]; limit: number; cursor: string | null }
  | { operation: "reviews.mine"; subject: string; cursor: string | null }
  | { operation: "review.mine"; subject: string; reviewId: string }
  | { operation: "reviews.reviewedLines"; subject: string; lineIds: string[] };
export type ReviewOperation = ReviewCommand["operation"];

export type ReviewSubmitOutcome = "created" | "exists" | "resubmitted" | "forbidden";
export type ReviewResults = {
  /** `forbidden` means the line belongs to another buyer; it never reveals that review's ID. */
  "review.submit": { reviewId: string | null; outcome: ReviewSubmitOutcome };
  "review.edit": "pending" | "closed" | "not_found" | "conflict";
  "review.withdraw": "withdrawn" | "not_found" | "conflict";
  "reviews.page": PublicReviewPage;
  "reviews.mine": BuyerReviewPage;
  "review.mine": BuyerReview | null;
  "reviews.reviewedLines": string[];
};

function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return Object.keys(record).every((key) => keys.includes(key)) && keys.every((key) => key in record) ? record : null;
}

const numericId = (value: unknown): value is string => typeof value === "string" && /^[1-9][0-9]{0,19}$/.test(value);
const uuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const subject = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/u.test(value);
const singleLine = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && [...value].length <= max && value === value.trim() && !/[\u0000-\u001f\u007f]|\s{2,}/u.test(value);

function purchaseSchema(value: unknown): ReviewPurchase | null {
  const purchase = exactObject(value, ["orderId", "lineId", "productId", "variantId", "productTitle", "variantTitle"]);
  return purchase && numericId(purchase.orderId) && numericId(purchase.lineId) && numericId(purchase.productId) &&
    (purchase.variantId === null || numericId(purchase.variantId)) && singleLine(purchase.productTitle, 255) &&
    (purchase.variantTitle === null || singleLine(purchase.variantTitle, 255))
    ? (purchase as ReviewPurchase) : null;
}

/** Only an already-normalized submission is accepted, so both sides agree on the stored text. */
function normalizedSubmission(value: unknown): ReviewSubmission | null {
  const parsed = reviewSubmissionSchema(value);
  const input = value as ReviewSubmission;
  return parsed && parsed.rating === input.rating && parsed.title === input.title && parsed.body === input.body &&
    parsed.nameStyle === input.nameStyle ? parsed : null;
}

export function reviewCommandSchema(value: unknown): ReviewCommand | null {
  const operation = value && typeof value === "object" ? (value as { operation?: unknown }).operation : undefined;
  switch (operation) {
    case "review.submit": {
      const command = exactObject(value, ["operation", "subject", "purchase", "submission", "displayName"]);
      return command && subject(command.subject) && purchaseSchema(command.purchase) && normalizedSubmission(command.submission) &&
        singleLine(command.displayName, REVIEW_DISPLAY_NAME_MAX) ? (command as ReviewCommand) : null;
    }
    case "review.edit": {
      const command = exactObject(value, ["operation", "subject", "reviewId", "expectedUpdatedAt", "submission", "displayName"]);
      return command && subject(command.subject) && uuid(command.reviewId) && buyerReviewTimestamp(command.expectedUpdatedAt) && normalizedSubmission(command.submission) &&
        singleLine(command.displayName, REVIEW_DISPLAY_NAME_MAX) ? (command as ReviewCommand) : null;
    }
    case "review.withdraw": {
      const command = exactObject(value, ["operation", "subject", "reviewId", "expectedUpdatedAt"]);
      return command && subject(command.subject) && uuid(command.reviewId) && buyerReviewTimestamp(command.expectedUpdatedAt) ? (command as ReviewCommand) : null;
    }
    case "reviews.page": {
      const command = exactObject(value, ["operation", "productIds", "limit", "cursor"]);
      return command && Array.isArray(command.productIds) && command.productIds.length > 0 && command.productIds.length <= 50 &&
        command.productIds.every(numericId) && new Set(command.productIds).size === command.productIds.length &&
        Number.isSafeInteger(command.limit) && (command.limit as number) >= 1 && (command.limit as number) <= REVIEW_PAGE_MAX &&
        (command.cursor === null || (typeof command.cursor === "string" && decodeReviewCursor(command.cursor) !== null)) ? (command as ReviewCommand) : null;
    }
    case "reviews.mine": {
      const command = exactObject(value, ["operation", "subject", "cursor"]);
      return command && subject(command.subject) && (command.cursor === null || (typeof command.cursor === "string" && decodeBuyerReviewCursor(command.cursor))) ? (command as ReviewCommand) : null;
    }
    case "review.mine": {
      const command = exactObject(value, ["operation", "subject", "reviewId"]);
      return command && subject(command.subject) && uuid(command.reviewId) ? (command as ReviewCommand) : null;
    }
    case "reviews.reviewedLines": {
      const command = exactObject(value, ["operation", "subject", "lineIds"]);
      return command && subject(command.subject) && Array.isArray(command.lineIds) && command.lineIds.length > 0 && command.lineIds.length <= 2000 &&
        command.lineIds.every(numericId) && new Set(command.lineIds).size === command.lineIds.length ? (command as ReviewCommand) : null;
    }
    default:
      return null;
  }
}

/** Exact database versions are never rounded through JavaScript Date. */
export const buyerReviewTimestamp = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === `${value.slice(0,23)}Z`;
const isoDate = (value: unknown): value is string => typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

function buyerReviewSchema(value: unknown): BuyerReview | null {
  const review = exactObject(value, ["id", "lineId", "item", "status", "hasPendingEdit", "publishedAt", "createdAt", "updatedAt", "current"]);
  const item = review && exactObject(review.item, ["productId", "productTitle", "variantTitle"]);
  const current = review && exactObject(review.current, ["rating", "title", "body", "nameStyle", "displayName"]);
  return review && item && current && uuid(review.id) && numericId(review.lineId) &&
    numericId(item.productId) && singleLine(item.productTitle,255) && (item.variantTitle === null || singleLine(item.variantTitle,255)) &&
    ["pending","published","rejected","hidden","withdrawn"].includes(review.status as string) &&
    typeof review.hasPendingEdit === "boolean" && (!review.hasPendingEdit || review.status === "published") &&
    (review.publishedAt === null || isoDate(review.publishedAt)) && (review.status !== "published" || review.publishedAt !== null) &&
    buyerReviewTimestamp(review.createdAt) && buyerReviewTimestamp(review.updatedAt) &&
    normalizedSubmission({ rating:current.rating,title:current.title,body:current.body,nameStyle:current.nameStyle }) &&
    singleLine(current.displayName,REVIEW_DISPLAY_NAME_MAX) ? review as BuyerReview : null;
}

/** An invalid transport payload stays distinct from a legitimate refusal or empty page. */
export function reviewResultSchema<Operation extends ReviewOperation>(operation: Operation, value: unknown): { data: ReviewResults[Operation] } | null {
  const result = exactObject(value, ["data"]);
  if (!result) return null;
  const data = result.data;
  let valid = false;
  if (operation === "review.submit") {
    const submit = exactObject(data, ["reviewId", "outcome"]);
    valid = Boolean(submit && (submit.outcome === "forbidden" ? submit.reviewId === null
      : ["created", "exists", "resubmitted"].includes(submit.outcome as string) && uuid(submit.reviewId)));
  } else if (operation === "review.edit") {
    valid = data === "pending" || data === "closed" || data === "not_found" || data === "conflict";
  } else if (operation === "review.withdraw") {
    valid = data === "withdrawn" || data === "not_found" || data === "conflict";
  } else if (operation === "reviews.page") {
    valid = publicReviewPageSchema(data) !== null;
  } else if (operation === "reviews.mine") {
    const page = exactObject(data,["reviews","nextCursor"]);
    if (page && Array.isArray(page.reviews) && page.reviews.length <= 20 && page.reviews.every((review) => buyerReviewSchema(review) !== null)) {
      const reviews = page.reviews as BuyerReview[];
      const cursor = typeof page.nextCursor === "string" ? decodeBuyerReviewCursor(page.nextCursor) : null;
      const last = reviews.at(-1);
      valid = new Set(reviews.map((review) => review.id)).size === reviews.length && (page.nextCursor === null ||
        Boolean(reviews.length === 20 && cursor && last && cursor.id === last.id && cursor.createdAt === last.createdAt));
    }
  } else if (operation === "review.mine") {
    valid = data === null || buyerReviewSchema(data) !== null;
  } else if (operation === "reviews.reviewedLines") {
    valid = Array.isArray(data) && data.length <= 2000 && data.every(numericId) && new Set(data).size === data.length;
  }
  return valid ? { data: data as ReviewResults[Operation] } : null;
}

// --- page cursors --------------------------------------------------------------

export type ReviewCursor = { publishedAt: string; id: string };

const base64url = (text: string) => btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Opaque to browsers: the last review's publish time and ID. */
export function encodeReviewCursor(cursor: ReviewCursor) {
  return base64url(`${cursor.publishedAt}|${cursor.id}`);
}

export function decodeReviewCursor(value: string): ReviewCursor | null {
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(value)) return null;
  try {
    const [publishedAt, id, extra] = atob(value.replace(/-/g, "+").replace(/_/g, "/")).split("|");
    return extra === undefined && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(publishedAt) && !Number.isNaN(Date.parse(publishedAt)) && uuid(id)
      ? { publishedAt, id } : null;
  } catch {
    return null;
  }
}

/** Keyset pagination uses immutable creation order, so editing does not move rows. */
export function encodeBuyerReviewCursor(cursor: BuyerReviewCursor) {
  return base64url(`${cursor.createdAt}|${cursor.id}`);
}
export function decodeBuyerReviewCursor(value: string): BuyerReviewCursor | null {
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(value)) return null;
  try {
    const [createdAt,id,extra] = atob(value.replace(/-/g,"+").replace(/_/g,"/")).split("|");
    return extra === undefined && buyerReviewTimestamp(createdAt) && uuid(id) ? { createdAt,id } : null;
  } catch { return null; }
}
