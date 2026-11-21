import { getReviewBackend } from "@/lib/review-backend";
import { handleReviewFeedPage } from "@/lib/review-feed";

export const runtime = "nodejs";

export function GET(request: Request) {
  return handleReviewFeedPage(request, { backend: getReviewBackend() });
}
