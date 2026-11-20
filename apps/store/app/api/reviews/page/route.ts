import { handlePublicReviewPage } from "@/lib/public-review-page";
import { getReviewBackend } from "@/lib/review-backend";
import { resolveRequestReviewProvider } from "@/lib/review-provider";

export const runtime = "nodejs";

export function GET(request: Request) {
  return handlePublicReviewPage(request, { provider: resolveRequestReviewProvider(request), backend: getReviewBackend() });
}
