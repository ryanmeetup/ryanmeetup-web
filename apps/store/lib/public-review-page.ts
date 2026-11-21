import { publicReviewSearchPageSchema } from "@ryanmeetup/reviews";
import type { PublicReviewSearchPage } from "@ryanmeetup/reviews";
import {
  FEED_REVIEW_PARAMS, parseReviewView, reviewViewOffset, reviewViewSearch,
} from "./public-review-view";
import type { ReviewView } from "./public-review-view";
import { privateJson } from "./request-guard";
import type { ReviewBackend } from "./review-backend";

const REVIEW_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PRODUCT_ID = /^[1-9][0-9]{0,19}$/;

/**
 * Reads a review page request using the same readable names as the /reviews
 * URL. Unlike a browser URL, which falls back to defaults, an API request
 * with an unknown, repeated or malformed parameter is refused.
 */
export function readReviewPageRequest(params: URLSearchParams, extra: readonly string[] = []) {
  const names = FEED_REVIEW_PARAMS;
  const allowed = [...Object.values(names), "review", ...extra];
  if ([...params.keys()].some((key) => !allowed.includes(key) || params.getAll(key).length !== 1)) return null;
  const view = parseReviewView(params, names);
  // parseReviewView falls back to a default for anything it can't use; here that fallback must not hide a bad value.
  const kept = (key: keyof ReviewView) => !params.has(names[key]) || params.get(names[key]) === String(view[key]);
  if (!(Object.keys(names) as (keyof ReviewView)[]).every(kept)) return null;
  const review = params.get("review");
  if (review !== null && !REVIEW_ID.test(review)) return null;
  return { view, focusReviewId: review };
}

/**
 * One numbered page of published reviews from storage. Null means the read
 * failed, so callers can say so rather than show "no reviews".
 */
export async function readPublicReviewPage({ backend, productIds, view, focusReviewId = null }: {
  backend: ReviewBackend | null; productIds: string[] | null; view: ReviewView; focusReviewId?: string | null;
}): Promise<PublicReviewSearchPage | null> {
  if (!backend) return null;
  try {
    const page = publicReviewSearchPageSchema(await backend({
      operation: "reviews.search", productIds, search: reviewViewSearch(view),
      limit: view.pageSize, offset: reviewViewOffset(view), focusReviewId,
    }));
    // Product pages must never show another product's review.
    return page && page.reviews.length <= view.pageSize &&
      (!productIds || page.reviews.every((review) => productIds.includes(review.item.productId))) ? page : null;
  } catch { return null; }
}

/** Anonymous, approved-only reads for one product. Identity, shop scope, tables and page size cannot be selected by callers. */
export async function handlePublicReviewPage(request: Request, { backend }: {
  backend: ReviewBackend | null;
}) {
  const params = new URL(request.url).searchParams;
  const productId = params.get("productId");
  const parsed = readReviewPageRequest(params, ["productId"]);
  if (!parsed || !productId || !PRODUCT_ID.test(productId)) return privateJson(400, { error: "That review page could not be read." });
  const page = await readPublicReviewPage({ backend, productIds: [productId], ...parsed });
  return page ? privateJson(200, page) : privateJson(503, { error: "More reviews are temporarily unavailable. Please try again." });
}
