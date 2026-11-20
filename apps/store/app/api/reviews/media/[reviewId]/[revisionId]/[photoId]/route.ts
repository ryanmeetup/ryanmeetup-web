import { getPublicReviewPhotoReader, handlePublicReviewPhoto } from "@/lib/public-review-photo";
import type { PublicPhotoReference } from "@/lib/public-review-photo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<PublicPhotoReference> }) {
  return handlePublicReviewPhoto(await params, getPublicReviewPhotoReader());
}
