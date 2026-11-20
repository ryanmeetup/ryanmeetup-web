import { decodeReviewCursor } from "@ryanmeetup/reviews";
import { PUBLIC_REVIEW_PAGE_SIZE, productReviewPage } from "./public-review-view";
import { privateJson } from "./request-guard";
import type { ReviewBackend } from "./review-backend";

/** Anonymous, approved-only reads. Identity, shop scope, tables and limits cannot be selected by callers. */
export async function handlePublicReviewPage(request: Request, { backend }: {
  backend: ReviewBackend | null;
}) {
  const unavailable = () => privateJson(503, { error: "More reviews are temporarily unavailable. Please try again." });
  const params = new URL(request.url).searchParams;
  const productId = params.get("productId");
  const cursor = params.get("cursor");
  if ([...params.keys()].some((key) => key !== "productId" && key !== "cursor") ||
    params.getAll("productId").length !== 1 || params.getAll("cursor").length > 1 ||
    !productId || !/^[1-9][0-9]{0,19}$/.test(productId) || (cursor !== null && !decodeReviewCursor(cursor))) {
    return privateJson(400, { error: "That review page could not be read." });
  }
  if (!backend) return unavailable();
  try {
    const page = productReviewPage(await backend({ operation: "reviews.page", productIds: [productId], limit: PUBLIC_REVIEW_PAGE_SIZE, cursor }), productId, cursor);
    return page ? privateJson(200, page) : unavailable();
  } catch { return unavailable(); }
}
