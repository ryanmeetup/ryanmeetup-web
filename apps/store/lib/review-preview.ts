import { cookies } from "next/headers";
import { getReviewProvider, isReviewPreviewEnabled, parseReviewPreviewChoice, resolveReviewProvider, reviewPreviewCookie } from "./review-provider";
import type { ReviewPreviewState } from "./review-provider";

export async function getReviewPreview(): Promise<ReviewPreviewState | undefined> {
  // Avoid making normal storefront requests cookie-dependent.
  if (!isReviewPreviewEnabled()) return undefined;
  const choice = parseReviewPreviewChoice((await cookies()).get(reviewPreviewCookie)?.value) ?? "default";
  return { choice, provider: resolveReviewProvider(choice) };
}

export async function getActiveReviewProvider() {
  const preview = await getReviewPreview();
  return preview ? preview.provider : getReviewProvider();
}
