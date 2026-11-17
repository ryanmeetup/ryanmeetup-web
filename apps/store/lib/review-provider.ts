export type ReviewProvider = "judgeme" | "custom";
export type ReviewPreviewChoice = ReviewProvider | "default";
export type ReviewPreviewState = {
  choice: ReviewPreviewChoice;
  provider: ReviewProvider | null;
};

export const reviewPreviewCookie = "store-review-preview";

/** Vercel Production never accepts a browser override. */
export function isReviewPreviewEnabled() {
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.NODE_ENV === "development" || process.env.REVIEWS_PREVIEW_ENABLED === "true";
}

export function parseReviewPreviewChoice(value: unknown): ReviewPreviewChoice | null {
  return value === "judgeme" || value === "custom" || value === "default" ? value : null;
}

/** Server-only configuration, shared by reads, collection, and submission. */
export function getReviewProvider(): ReviewProvider | null {
  const value = process.env.REVIEWS_PROVIDER?.trim();
  if (!value) return "judgeme";
  if (value === "judgeme" || value === "custom") return value;
  // A typo must not silently reopen the legacy anonymous submission path.
  return null;
}

/** Cookie preference is effective only in an explicitly allowed environment. */
export function resolveReviewProvider(previewChoice?: string): ReviewProvider | null {
  const choice = parseReviewPreviewChoice(previewChoice);
  if (isReviewPreviewEnabled() && choice && choice !== "default") return choice;
  return getReviewProvider();
}
