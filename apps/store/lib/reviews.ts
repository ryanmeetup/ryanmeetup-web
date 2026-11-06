import type { ReviewsData } from "./types";
import { publishedReviewPhotoUrl } from "./review-photo-hosts";
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
  averageRating: 0,
  count: 0,
  reviews: [],
};

function shopifyNumericId(id: string) {
  return id.split("/").at(-1)?.replace(/^demo-/, "") ?? id;
}

export async function getReviews(productId: string): Promise<ReviewsData> {
  const token = process.env.JUDGEME_PRIVATE_API_TOKEN;
  const shopDomain = getJudgeMeShopDomain();
  if (!token || !shopDomain || productId.includes("/demo-")) return emptyReviews;

  const lookupUrl = new URL("https://api.judge.me/api/v1/products/-1");
  lookupUrl.searchParams.set("shop_domain", shopDomain);
  lookupUrl.searchParams.set("external_id", shopifyNumericId(productId));
  const requestOptions = { headers: { "X-Api-Token": token }, next: { revalidate: 300 } };
  const productResponse = await fetch(lookupUrl, requestOptions);
  if (!productResponse.ok) return emptyReviews;
  const productPayload = (await productResponse.json()) as { product?: { id: number } };
  if (!productPayload.product?.id) return emptyReviews;

  const reviewsUrl = new URL("https://api.judge.me/api/v1/reviews");
  reviewsUrl.searchParams.set("shop_domain", shopDomain);
  reviewsUrl.searchParams.set("product_id", String(productPayload.product.id));
  reviewsUrl.searchParams.set("published", "true");
  reviewsUrl.searchParams.set("per_page", "20");
  const reviewsResponse = await fetch(reviewsUrl, requestOptions);
  if (!reviewsResponse.ok) return emptyReviews;
  const payload = (await reviewsResponse.json()) as { reviews?: JudgeMeReview[] };
  const reviews = (payload.reviews ?? []).filter((review) => review.hidden === false && review.curated === "ok");

  return {
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
      verified: review.verified === "buyer" || review.verified === "verified-buyer",
      photoUrls: Array.from(new Set((review.pictures ?? []).flatMap((picture) => {
        if (picture.hidden !== false) return [];
        const url = publishedReviewPhotoUrl(picture.urls?.huge) ?? publishedReviewPhotoUrl(picture.urls?.original);
        return url ? [url] : [];
      }))).slice(0, 5),
    })),
  };
}
