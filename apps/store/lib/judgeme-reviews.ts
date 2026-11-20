import type { ReviewsData } from "./types";
import { publishedReviewPhotoUrl } from "./review-photo-hosts";
import { isDemoProductId } from "./demo-data";
import { getJudgeMeShopDomain } from "./judgeme";

type JudgeMeReview = {
  body: string;
  created_at: string;
  id: number;
  rating: number;
  reviewer?: { name?: string };
  title?: string;
  verified?: string;
  hidden?: boolean;
  curated?: string;
  pictures?: { hidden?: boolean; urls?: { huge?: string; original?: string } }[];
};

const emptyReviews: ReviewsData = {
  status: "available",
  averageRating: 0,
  count: 0,
  reviews: [],
};

/** Judge.me couldn't be read. Never shown as "no reviews yet". */
const unavailableReviews: ReviewsData = { status: "unavailable", averageRating: 0, count: 0, reviews: [] };

// Judge.me's verified-review statuses include account authentication and manual
// verification, so the storefront labels these "Verified review", not purchase.
// https://judge.me/help/en/articles/8403775-verified-status-of-judge-me-reviews
const verifiedReviewStatuses = new Set([
  "confirmed-buyer",
  "buyer",
  "verified-purchase",
  "semi-verified-purchase",
  "customer-account",
  "admin",
]);

function shopifyNumericId(id: string) {
  return id.split("/").at(-1)?.replace(/^demo-/, "") ?? id;
}

/**
 * Published Judge.me reviews for one product. A product Judge.me has never
 * seen has no reviews; any other failure, including a slow or malformed
 * response, is reported as unavailable instead of failing the product page.
 */
export async function getJudgeMeReviews(productId: string): Promise<ReviewsData> {
  try {
    return await loadJudgeMeReviews(productId);
  } catch (error) {
    console.error("Could not load Judge.me reviews.", error instanceof Error ? error.message : error);
    return unavailableReviews;
  }
}

async function loadJudgeMeReviews(productId: string): Promise<ReviewsData> {
  const token = process.env.JUDGEME_PRIVATE_API_TOKEN;
  const shopDomain = getJudgeMeShopDomain();
  if (!token || !shopDomain || isDemoProductId(productId)) return emptyReviews;

  const lookupUrl = new URL("https://api.judge.me/api/v1/products/-1");
  lookupUrl.searchParams.set("shop_domain", shopDomain);
  lookupUrl.searchParams.set("external_id", shopifyNumericId(productId));
  const requestOptions = () => ({ headers: { "X-Api-Token": token }, next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) });
  const productResponse = await fetch(lookupUrl, requestOptions());
  if (productResponse.status === 404) return emptyReviews;
  if (!productResponse.ok) return unavailableReviews;
  const productPayload = (await productResponse.json()) as { product?: { id: number } };
  if (!productPayload.product?.id) return emptyReviews;

  const reviewsUrl = new URL("https://api.judge.me/api/v1/reviews");
  reviewsUrl.searchParams.set("shop_domain", shopDomain);
  reviewsUrl.searchParams.set("product_id", String(productPayload.product.id));
  reviewsUrl.searchParams.set("published", "true");
  reviewsUrl.searchParams.set("per_page", "20");
  const reviewsResponse = await fetch(reviewsUrl, requestOptions());
  if (!reviewsResponse.ok) return unavailableReviews;
  const payload = (await reviewsResponse.json()) as { reviews?: JudgeMeReview[] };
  const reviews = (payload.reviews ?? []).filter((review) => review.hidden === false && review.curated === "ok");

  return {
    status: "available",
    count: reviews.length,
    averageRating: reviews.length
      ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
      : 0,
    reviews: reviews.map((review) => ({
      id: String(review.id),
      title: review.title ?? "",
      body: review.body,
      rating: review.rating,
      reviewerName: review.reviewer?.name ?? "Ryan customer",
      createdAt: review.created_at,
      verification: verifiedReviewStatuses.has(review.verified ?? "") ? "review" : null,
      photoUrls: Array.from(new Set((review.pictures ?? []).flatMap((picture) => {
        if (picture.hidden !== false) return [];
        const url = publishedReviewPhotoUrl(picture.urls?.huge) ?? publishedReviewPhotoUrl(picture.urls?.original);
        return url ? [url] : [];
      }))).slice(0, 5),
    })),
  };
}
