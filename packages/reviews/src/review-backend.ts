/**
 * Private contract between the storefront server and review storage. The
 * storefront sends only what it has already verified: the buyer's Shopify
 * subject from their session, and the purchased line from Shopify, or no line
 * for a review without a matching order. Storage pins the shop from its own
 * configuration. Never expose these commands to a browser.
 */

import {
  REVIEW_DISPLAY_NAME_MAX,
  REVIEW_PAGE_MAX,
  REVIEW_PHOTOS_MAX,
  publicReviewPageSchema,
  publicReviewSchema,
  reviewSubmissionSchema,
  reviewSummarySchema,
  type PublicReviewItem,
  type PublicReview,
  type PublicReviewPage,
  type ReviewStar,
  type ReviewSubmission,
  type ReviewSummary,
} from "./content";

/** Staff moderation notes, including a rejection reason the buyer reads, stop at this many characters. */
export const REVIEW_REJECTION_REASON_MAX = 1000;

/**
 * What a review is written against. A purchased order line the storefront has
 * verified with Shopify carries its order and line; a signed-in buyer with no
 * matching order reviews the product alone, with both set to null and no variant.
 */
export type ReviewPurchase = {
  orderId: string | null;
  lineId: string | null;
  productId: string;
  variantId: string | null;
  productTitle: string;
  variantTitle: string | null;
};

/** A purchased line found in the buyer's Shopify orders: always has its order and line. */
export type VerifiedReviewPurchase = ReviewPurchase & { orderId: string; lineId: string };

/** How a buyer's own review stands, in words they can act on. */
export type BuyerReviewStatus = "pending" | "published" | "rejected" | "hidden" | "withdrawn";

/** A photo staff turned down, and why, as the buyer reads it. */
export type BuyerRejectedPhoto = { id: string; reason: string };

/** One of the signed-in buyer's own reviews, for "My reviews". Never public. */
export type BuyerReview = {
  id: string;
  /** Null when the review was written without a matching order. */
  lineId: string | null;
  item: PublicReviewItem;
  status: BuyerReviewStatus;
  /** Published, with a newer edit waiting for approval. */
  hasPendingEdit: boolean;
  /**
   * Why staff rejected the buyer's latest submission, written for the buyer.
   * Null unless that submission is still the rejected one: a resubmission
   * clears it. A published review may carry one for a rejected edit; hidden
   * and withdrawn reviews, which the buyer cannot resubmit, never do.
   */
  rejectionReason: string | null;
  /**
   * Photos staff rejected on the version the buyer edits from, each with the
   * reason written for the buyer. Empty once they resubmit, and always empty
   * for hidden and withdrawn reviews.
   */
  rejectedPhotos: BuyerRejectedPhoto[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** What the buyer last wrote: a waiting edit, else the live version, else their latest attempt. */
  current: ReviewSubmission & { displayName: string };
};

/** How a public review list is narrowed and ordered. Every field is applied by storage, across every page. */
export type PublicReviewSort = "newest" | "oldest" | "highest" | "lowest";
export const PUBLIC_REVIEW_SORTS: readonly PublicReviewSort[] = ["newest", "oldest", "highest", "lowest"];
/** Where a review came from: a checked store order, an Etsy import, or a store review with no matching order. */
export type PublicReviewSource = "verified" | "etsy" | "unmatched";
export const PUBLIC_REVIEW_SOURCES: readonly PublicReviewSource[] = ["verified", "etsy", "unmatched"];
export const PUBLIC_REVIEW_QUERY_MAX = 200;
export type PublicReviewSearch = { rating: ReviewStar | null; source: PublicReviewSource | null; sort: PublicReviewSort; query: string };
/** One numbered page of matches. `offset` is where the served page starts, which a focused review or a stale page number can move. */
export type PublicReviewSearchPage = { reviews: PublicReview[]; total: number; offset: number };

export type BuyerReviewPage = { reviews: BuyerReview[]; nextCursor: string | null };
export type BuyerReviewCursor = { createdAt: string; id: string };

export type ReviewCommand =
  | { operation: "review.submit"; subject: string; purchase: ReviewPurchase; submission: ReviewSubmission; displayName: string; photoIds?: string[] }
  | { operation: "review.edit"; subject: string; reviewId: string; expectedUpdatedAt: string; submission: ReviewSubmission; displayName: string; photoIds?: string[] }
  | { operation: "review.withdraw"; subject: string; reviewId: string; expectedUpdatedAt: string }
  | { operation: "reviews.page"; productIds: string[]; limit: number; cursor: string | null }
  /** Rating totals for each product on its own, for listing cards. */
  | { operation: "reviews.summaries"; productIds: string[] }
  | { operation: "reviews.latest" }
  /** A page of published reviews for some products, or the whole shop when `productIds` is null. */
  | { operation: "reviews.search"; productIds: string[] | null; search: PublicReviewSearch; limit: number; offset: number; focusReviewId: string | null }
  | { operation: "reviews.mine"; subject: string; cursor: string | null }
  | { operation: "review.mine"; subject: string; reviewId: string }
  | { operation: "reviews.reviewedLines"; subject: string; lineIds: string[] }
  /** Products the buyer already reviewed without a matching order. */
  | { operation: "reviews.reviewedProducts"; subject: string; productIds: string[] };
export type ReviewOperation = ReviewCommand["operation"];

export type ReviewSubmitOutcome = "created" | "exists" | "resubmitted" | "forbidden" | "invalid_photos";
export type ReviewResults = {
  /** `forbidden` means the line belongs to another buyer; it never reveals that review's ID. */
  "review.submit": { reviewId: string | null; outcome: ReviewSubmitOutcome };
  "review.edit": "pending" | "closed" | "not_found" | "conflict" | "invalid_photos";
  "review.withdraw": "withdrawn" | "not_found" | "conflict";
  "reviews.page": PublicReviewPage;
  /** Keyed by product ID; every requested product is present, with a zero count when it has no reviews. */
  "reviews.summaries": Record<string, ReviewSummary>;
  "reviews.latest": PublicReview[];
  "reviews.search": PublicReviewSearchPage;
  "reviews.mine": BuyerReviewPage;
  "review.mine": BuyerReview | null;
  "reviews.reviewedLines": string[];
  "reviews.reviewedProducts": string[];
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

const productIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.length <= 50 && value.every(numericId) && new Set(value).size === value.length;

/** Ordered private draft IDs, never storage paths or public URLs. Missing means retain on edit. */
export function reviewPhotoIdsSchema(value: unknown): string[] | null {
  return Array.isArray(value) && value.length <= REVIEW_PHOTOS_MAX && value.every(uuid) && new Set(value).size === value.length ? value : null;
}
const singleLine = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && [...value].length <= max && value === value.trim() && !/[\u0000-\u001f\u007f]|\s{2,}/u.test(value);

/** Deepest offset storage serves; far beyond any real shop, it only bounds a hostile page number. */
export const PUBLIC_REVIEW_OFFSET_MAX = 100_000;

/** Only the fixed filters and sorts, and already-trimmed search text. */
export function publicReviewSearchSchema(value: unknown): PublicReviewSearch | null {
  const search = exactObject(value, ["rating", "source", "sort", "query"]);
  return search && (search.rating === null || (Number.isInteger(search.rating) && (search.rating as number) >= 1 && (search.rating as number) <= 5)) &&
    (search.source === null || PUBLIC_REVIEW_SOURCES.includes(search.source as PublicReviewSource)) &&
    PUBLIC_REVIEW_SORTS.includes(search.sort as PublicReviewSort) && typeof search.query === "string" &&
    search.query === search.query.trim() && [...search.query].length <= PUBLIC_REVIEW_QUERY_MAX && !/[\u0000-\u001f\u007f]/u.test(search.query)
    ? (search as PublicReviewSearch) : null;
}

/** Public and unique; the order follows the requested sort, so it is the reader's to trust. */
export function publicReviewSearchPageSchema(value: unknown): PublicReviewSearchPage | null {
  const page = exactObject(value, ["reviews", "total", "offset"]);
  if (!page || !Array.isArray(page.reviews) || page.reviews.length > REVIEW_PAGE_MAX || !page.reviews.every((review) => publicReviewSchema(review) !== null)) return null;
  const reviews = page.reviews as PublicReview[];
  return new Set(reviews.map((review) => review.id)).size === reviews.length &&
    Number.isSafeInteger(page.total) && Number.isSafeInteger(page.offset) && (page.offset as number) >= 0 &&
    (page.offset as number) + reviews.length <= (page.total as number) && (reviews.length > 0 || page.total === 0 || (page.offset as number) >= (page.total as number))
    ? (page as PublicReviewSearchPage) : null;
}

function purchaseSchema(value: unknown): ReviewPurchase | null {
  const purchase = exactObject(value, ["orderId", "lineId", "productId", "variantId", "productTitle", "variantTitle"]);
  const unverified = purchase && purchase.orderId === null && purchase.lineId === null;
  return purchase && (unverified ? purchase.variantId === null && purchase.variantTitle === null : numericId(purchase.orderId) && numericId(purchase.lineId)) &&
    numericId(purchase.productId) && (purchase.variantId === null || numericId(purchase.variantId)) && singleLine(purchase.productTitle, 255) &&
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
      const hasPhotos = Object.hasOwn(value as object, "photoIds");
      const command = exactObject(value, ["operation", "subject", "purchase", "submission", "displayName", ...(hasPhotos ? ["photoIds"] : [])]);
      return command && subject(command.subject) && purchaseSchema(command.purchase) && normalizedSubmission(command.submission) &&
        (!hasPhotos || reviewPhotoIdsSchema(command.photoIds)) &&
        singleLine(command.displayName, REVIEW_DISPLAY_NAME_MAX) ? (command as ReviewCommand) : null;
    }
    case "review.edit": {
      const hasPhotos = Object.hasOwn(value as object, "photoIds");
      const command = exactObject(value, ["operation", "subject", "reviewId", "expectedUpdatedAt", "submission", "displayName", ...(hasPhotos ? ["photoIds"] : [])]);
      return command && subject(command.subject) && uuid(command.reviewId) && buyerReviewTimestamp(command.expectedUpdatedAt) && normalizedSubmission(command.submission) &&
        (!hasPhotos || reviewPhotoIdsSchema(command.photoIds)) &&
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
    case "reviews.summaries": {
      const command = exactObject(value, ["operation", "productIds"]);
      return command && productIdList(command.productIds) ? (command as ReviewCommand) : null;
    }
    case "reviews.latest":
      return exactObject(value, ["operation"]) ? value as ReviewCommand : null;
    case "reviews.search": {
      const command = exactObject(value, ["operation", "productIds", "search", "limit", "offset", "focusReviewId"]);
      return command && (command.productIds === null || productIdList(command.productIds)) && publicReviewSearchSchema(command.search) &&
        Number.isSafeInteger(command.limit) && (command.limit as number) >= 1 && (command.limit as number) <= REVIEW_PAGE_MAX &&
        Number.isSafeInteger(command.offset) && (command.offset as number) >= 0 && (command.offset as number) <= PUBLIC_REVIEW_OFFSET_MAX &&
        (command.focusReviewId === null || uuid(command.focusReviewId)) ? (command as ReviewCommand) : null;
    }
    case "reviews.mine": {
      const command = exactObject(value, ["operation", "subject", "cursor"]);
      return command && subject(command.subject) && (command.cursor === null || (typeof command.cursor === "string" && decodeBuyerReviewCursor(command.cursor))) ? (command as ReviewCommand) : null;
    }
    case "review.mine": {
      const command = exactObject(value, ["operation", "subject", "reviewId"]);
      return command && subject(command.subject) && uuid(command.reviewId) ? (command as ReviewCommand) : null;
    }
    case "reviews.reviewedProducts": {
      const command = exactObject(value, ["operation", "subject", "productIds"]);
      return command && subject(command.subject) && Array.isArray(command.productIds) && command.productIds.length > 0 && command.productIds.length <= 50 &&
        command.productIds.every(numericId) && new Set(command.productIds).size === command.productIds.length ? (command as ReviewCommand) : null;
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

const BUYER_REVIEW_KEYS = ["id", "lineId", "item", "status", "hasPendingEdit", "rejectionReason", "rejectedPhotos", "publishedAt", "createdAt", "updatedAt", "current"] as const;
const BUYER_REVIEW_ITEM_KEYS = ["productId", "productTitle", "variantTitle"] as const;
const BUYER_REVIEW_CURRENT_KEYS = ["rating", "title", "body", "nameStyle", "displayName"] as const;

function pick(value: unknown, keys: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(keys.filter((key) => Object.hasOwn(record, key)).map((key) => [key, record[key]]));
}

/**
 * Keeps only the fields this build knows from a buyer review row read from the
 * database, so a migration that adds a field doesn't break a deployment still
 * running older code. Missing or invalid fields still fail validation. Public
 * reviews stay exact: an unexpected field there is a sign of a leaking query.
 */
export function buyerReviewRow(value: unknown): unknown {
  const row = pick(value, BUYER_REVIEW_KEYS);
  if (!row || typeof row !== "object" || Array.isArray(row)) return row;
  const { item, current } = row as Record<string, unknown>;
  // Rows from before photo rejection reasons existed carry none.
  return { rejectedPhotos: [], ...row, ...("item" in row ? { item: pick(item, BUYER_REVIEW_ITEM_KEYS) } : {}),
    ...("current" in row ? { current: pick(current, BUYER_REVIEW_CURRENT_KEYS) } : {}) };
}

const BUYER_REJECTED_PHOTO_KEYS = ["id", "reason"] as const;
function buyerRejectedPhoto(value: unknown): value is BuyerRejectedPhoto {
  const photo = exactObject(value, BUYER_REJECTED_PHOTO_KEYS);
  return Boolean(photo && uuid(photo.id) && typeof photo.reason === "string" && photo.reason.trim() !== "" &&
    [...photo.reason].length <= REVIEW_REJECTION_REASON_MAX);
}

function buyerReviewSchema(value: unknown): BuyerReview | null {
  const review = exactObject(value, BUYER_REVIEW_KEYS);
  const item = review && exactObject(review.item, BUYER_REVIEW_ITEM_KEYS);
  const current = review && exactObject(review.current, BUYER_REVIEW_CURRENT_KEYS);
  return review && item && current && uuid(review.id) && (review.lineId === null || numericId(review.lineId)) &&
    numericId(item.productId) && singleLine(item.productTitle,255) && (item.variantTitle === null || singleLine(item.variantTitle,255)) &&
    ["pending","published","rejected","hidden","withdrawn"].includes(review.status as string) &&
    typeof review.hasPendingEdit === "boolean" && (!review.hasPendingEdit || review.status === "published") &&
    (review.rejectionReason === null || (typeof review.rejectionReason === "string" && review.rejectionReason.trim() !== "" &&
      [...review.rejectionReason].length <= REVIEW_REJECTION_REASON_MAX && ["rejected","published"].includes(review.status as string) && !review.hasPendingEdit)) &&
    Array.isArray(review.rejectedPhotos) && review.rejectedPhotos.length <= REVIEW_PHOTOS_MAX &&
    review.rejectedPhotos.every(buyerRejectedPhoto) && new Set(review.rejectedPhotos.map((photo) => (photo as BuyerRejectedPhoto).id)).size === review.rejectedPhotos.length &&
    (review.rejectedPhotos.length === 0 || !["hidden","withdrawn"].includes(review.status as string)) &&
    (review.publishedAt === null || isoDate(review.publishedAt)) && (review.status !== "published" || review.publishedAt !== null) &&
    buyerReviewTimestamp(review.createdAt) && buyerReviewTimestamp(review.updatedAt) &&
    normalizedSubmission({ rating:current.rating,title:current.title,body:current.body,nameStyle:current.nameStyle }) &&
    singleLine(current.displayName,REVIEW_DISPLAY_NAME_MAX) ? review as BuyerReview : null;
}

/** Public, unique and in the shared keyset order: newest publish time, then highest ID. */
function newestFirstReviews(data: unknown[]): data is PublicReview[] {
  if (!data.every((review) => publicReviewSchema(review) !== null)) return false;
  const reviews = data as PublicReview[];
  return new Set(reviews.map((review) => review.id)).size === reviews.length &&
    reviews.every((review, index) => index === 0 || Date.parse(reviews[index - 1].publishedAt) > Date.parse(review.publishedAt) ||
      (reviews[index - 1].publishedAt === review.publishedAt && reviews[index - 1].id > review.id));
}

/** An invalid transport payload stays distinct from a legitimate refusal or empty page. */
export function reviewResultSchema<Operation extends ReviewOperation>(operation: Operation, value: unknown): { data: ReviewResults[Operation] } | null {
  const result = exactObject(value, ["data"]);
  if (!result) return null;
  const data = result.data;
  let valid = false;
  if (operation === "review.submit") {
    const submit = exactObject(data, ["reviewId", "outcome"]);
    valid = Boolean(submit && (["forbidden", "invalid_photos"].includes(submit.outcome as string) ? submit.reviewId === null
      : ["created", "exists", "resubmitted"].includes(submit.outcome as string) && uuid(submit.reviewId)));
  } else if (operation === "review.edit") {
    valid = data === "pending" || data === "closed" || data === "not_found" || data === "conflict" || data === "invalid_photos";
  } else if (operation === "review.withdraw") {
    valid = data === "withdrawn" || data === "not_found" || data === "conflict";
  } else if (operation === "reviews.page") {
    valid = publicReviewPageSchema(data) !== null;
  } else if (operation === "reviews.summaries") {
    const summaries = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
    valid = Boolean(summaries && productIdList(Object.keys(summaries)) && Object.values(summaries).every((summary) => reviewSummarySchema(summary) !== null));
  } else if (operation === "reviews.latest") {
    valid = Array.isArray(data) && data.length <= 6 && newestFirstReviews(data);
  } else if (operation === "reviews.search") {
    valid = publicReviewSearchPageSchema(data) !== null;
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
  } else if (operation === "reviews.reviewedProducts") {
    valid = Array.isArray(data) && data.length <= 50 && data.every(numericId) && new Set(data).size === data.length;
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
