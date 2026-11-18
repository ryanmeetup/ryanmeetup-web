import { cookies, headers } from "next/headers";
import { getReviewProvider, isReviewPreviewConfigured, isReviewPreviewEnabled, parseReviewPreviewChoice, resolveReviewProvider, reviewPreviewCookie } from "./review-provider";
import type { ReviewPreviewState } from "./review-provider";

/** The review-testing state for this page request, or undefined anywhere but localhost. */
export async function getReviewPreview(): Promise<ReviewPreviewState | undefined> {
  // Check the environment first: reading headers or cookies would make every
  // deployed product page dynamic.
  if (!isReviewPreviewConfigured()) return undefined;
  const host = (await headers()).get("host");
  if (!isReviewPreviewEnabled(host)) return undefined;
  const choice = parseReviewPreviewChoice((await cookies()).get(reviewPreviewCookie)?.value) ?? "default";
  return { choice, provider: resolveReviewProvider(choice, host) };
}

export async function getActiveReviewProvider() {
  const preview = await getReviewPreview();
  return preview ? preview.provider : getReviewProvider();
}
