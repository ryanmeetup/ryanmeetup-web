import { getCustomerAccountSession } from "@/lib/customer-account/runtime";
import { handleReviewPhotoRead } from "@/lib/review-photo-reads";
import { getReviewPhotoReader } from "@/lib/review-photo-reader";
import { reviewPhotosEnabled } from "@/lib/review-photo-policy";

export const runtime = "nodejs";
export const maxDuration = 30;

export function GET(request: Request) {
  const enabled = reviewPhotosEnabled();
  return handleReviewPhotoRead(request, "selection", { enabled, reader: enabled ? getReviewPhotoReader() : null,
    loadSession: () => getCustomerAccountSession(request) });
}
