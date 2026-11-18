import { reviewBackendPath, reviewCommandSchema, reviewResultSchema } from "@ryanmeetup/reviews";
import type { ReviewCommand, ReviewResults } from "@ryanmeetup/reviews";
import { publicHttpsUrl } from "./customer-account/config";

export class ReviewBackendError extends Error {
  constructor() { super("Review storage is temporarily unavailable."); }
}

/**
 * Server-only client for the private review backend. It uses the same service
 * credential as customer sign-in and no Supabase key.
 */
export function createReviewBackend({ origin, token, fetcher = fetch }: { origin: string; token: string; fetcher?: typeof fetch }) {
  const url = publicHttpsUrl(origin);
  if (!url || url.pathname !== "/" || url.search || url.port || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ReviewBackendError();
  const endpoint = new URL(reviewBackendPath, url.origin).href;

  return async function execute<Command extends ReviewCommand>(command: Command): Promise<ReviewResults[Command["operation"]]> {
    if (!reviewCommandSchema(command)) throw new ReviewBackendError();
    try {
      const response = await fetcher(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(command), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new ReviewBackendError();
      const text = await response.text();
      // A full page of maximum-length reviews fits well inside this.
      if (Buffer.byteLength(text) > 1024 * 1024) throw new ReviewBackendError();
      const result = reviewResultSchema<Command["operation"]>(command.operation, JSON.parse(text));
      if (!result) throw new ReviewBackendError();
      return result.data;
    } catch {
      // Never copy upstream errors, URLs, bodies, or the bearer token into diagnostics.
      throw new ReviewBackendError();
    }
  };
}

/** The configured backend, or null when review storage isn't set up here. */
export function getReviewBackend() {
  try {
    return createReviewBackend({ origin: process.env.STORE_REVIEWS_BACKEND_URL ?? "", token: process.env.STORE_REVIEWS_BACKEND_TOKEN ?? "" });
  } catch {
    return null;
  }
}
