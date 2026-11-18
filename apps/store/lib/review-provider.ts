import { readCookie } from "./request-guard";

export type ReviewProvider = "judgeme" | "custom";
/** `custom-sample` is custom reviews with a pretend signed-in buyer, for trying the composer before sign-in exists. */
export type ReviewPreviewChoice = ReviewProvider | "custom-sample" | "default";
export type ReviewPreviewState = {
  choice: ReviewPreviewChoice;
  provider: ReviewProvider | null;
};

export const reviewPreviewCookie = "store-review-preview";

const loopbackHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;

/** A request addressed to this machine, by its Host header. */
export function isLoopbackHost(host: string | null | undefined) {
  return typeof host === "string" && loopbackHost.test(host);
}

/**
 * Review testing (the Review mode control, its endpoint, and the preference
 * cookie) exists only on localhost: `next dev`, or a local production build
 * with `REVIEWS_PREVIEW_ENABLED=true`. No Vercel deployment, Preview included,
 * accepts it, even with the flag set or a forged Host header.
 */
export function isReviewPreviewEnabled(host: string | null | undefined) {
  return isReviewPreviewConfigured() && isLoopbackHost(host);
}

/** The environment half of the check, which needs no request. */
export function isReviewPreviewConfigured() {
  if (process.env.VERCEL) return false;
  return process.env.NODE_ENV === "development" || process.env.REVIEWS_PREVIEW_ENABLED === "true";
}

export function parseReviewPreviewChoice(value: unknown): ReviewPreviewChoice | null {
  return value === "judgeme" || value === "custom" || value === "custom-sample" || value === "default" ? value : null;
}

/** Server-only configuration, shared by reads, collection, and submission. */
export function getReviewProvider(): ReviewProvider | null {
  const value = process.env.REVIEWS_PROVIDER?.trim();
  if (!value) return "judgeme";
  if (value === "judgeme" || value === "custom") return value;
  // A typo must not silently reopen the legacy anonymous submission path.
  return null;
}

/** Cookie preference is effective only where review testing is allowed. */
export function resolveReviewProvider(previewChoice: string | undefined, host: string | null | undefined): ReviewProvider | null {
  const choice = parseReviewPreviewChoice(previewChoice);
  if (isReviewPreviewEnabled(host) && choice && choice !== "default") return choice === "custom-sample" ? "custom" : choice;
  return getReviewProvider();
}

/** The Host header, which is what the browser addressed; Next may rewrite `request.url`. */
export function requestHost(request: Request) {
  return request.headers.get("host") ?? new URL(request.url).host;
}

/** The provider for a route handler's request, honoring a localhost preference. */
export function resolveRequestReviewProvider(request: Request) {
  return resolveReviewProvider(readCookie(request, reviewPreviewCookie), requestHost(request));
}
