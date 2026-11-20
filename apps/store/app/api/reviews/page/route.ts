import { handlePublicReviewPage } from "@/lib/public-review-page";
import { getReviewBackend } from "@/lib/review-backend";

export const runtime = "nodejs";

export function GET(request: Request) {
  return handlePublicReviewPage(request, { backend: getReviewBackend() });
}
