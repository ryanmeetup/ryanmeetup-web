import { reviewBackendPath, reviewCommandSchema, reviewResultSchema } from "@ryanmeetup/reviews";
import type { ReviewCommand, ReviewResults } from "@ryanmeetup/reviews";
import { createServiceClient } from "./service-client";

export class ReviewBackendError extends Error {
  constructor() { super("Review storage is temporarily unavailable."); }
}

/** Server-only client for the private review backend; it shares the customer sign-in credential. */
export function createReviewBackend({ origin, token, fetcher }: { origin: string; token: string; fetcher?: typeof fetch }) {
  return createServiceClient<ReviewCommand, ReviewResults>({
    origin, token, fetcher, path: reviewBackendPath, commandSchema: reviewCommandSchema, resultSchema: reviewResultSchema,
    // A full page of maximum-length reviews fits well inside this.
    maxResponseBytes: 1024 * 1024,
    fail: () => new ReviewBackendError(),
  });
}

export type ReviewBackend = ReturnType<typeof createReviewBackend>;

/** The configured backend, or null when review storage isn't set up here. */
export function getReviewBackend() {
  try {
    return createReviewBackend({ origin: process.env.STORE_REVIEWS_BACKEND_URL ?? "", token: process.env.STORE_REVIEWS_BACKEND_TOKEN ?? "" });
  } catch {
    return null;
  }
}
