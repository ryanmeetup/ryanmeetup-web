import { NextResponse } from "next/server";
import { isAllowedTasksRequestOrigin } from "@/lib/app-url";
import { parseUuid, storeReviewPhotoDecisionSchema } from "@/lib/api-schema";
import { isModerationTimestamp } from "@/lib/store-reviews/moderation";
import { apiError, databaseFailure, privateResponse } from "@/lib/server/api-response";
import { readJson } from "@/lib/server/privileged-api";
import { storeReviewStaffContext } from "@/lib/server/store-reviews/staff-context";
import { moderateReviewPhoto, readStaffReviewPhoto } from "@/lib/server/store-reviews/photos";
import { StoreReviewDatabaseError } from "@/lib/server/store-reviews/errors";

export const runtime = "nodejs";
let previews = 0;
function failure(request: Request, error: unknown) {
  return privateResponse(databaseFailure(request, "store_review_photos", {
    code: error instanceof StoreReviewDatabaseError ? error.code : undefined,
  }, { error: "Review photos are temporarily unavailable." }));
}
export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  if (["cross-site", "same-site"].includes(request.headers.get("sec-fetch-site") ?? "") ||
    (origin !== null && !isAllowedTasksRequestOrigin(origin))) return privateResponse(apiError(403, "FORBIDDEN", "Read photos from this workspace."));
  const owner = await storeReviewStaffContext();
  if ("response" in owner) return privateResponse(owner.response);
  const params = new URL(request.url).searchParams;
  const keys = ["reviewId", "revisionId", "photoId", "expectedUpdatedAt"];
  const reviewId = parseUuid(params.get("reviewId")); const revisionId = parseUuid(params.get("revisionId"));
  const photoId = parseUuid(params.get("photoId")); const expectedUpdatedAt = params.get("expectedUpdatedAt");
  if (!reviewId || !revisionId || !photoId || !isModerationTimestamp(expectedUpdatedAt) ||
    [...params.keys()].some((key) => !keys.includes(key)) || keys.some((key) => params.getAll(key).length !== 1)) return privateResponse(apiError(400, "INVALID_REQUEST", "Choose a valid review photo."));
  if (previews >= 4) return privateResponse(apiError(503, "SERVICE_UNAVAILABLE", "Photo previews are busy. Try again."));
  previews++;
  try {
    const bytes = await readStaffReviewPhoto(owner.admin, owner.user.id, owner.shopId, { reviewId, revisionId, photoId, expectedUpdatedAt });
    return bytes ? new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/webp", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" } }) : privateResponse(apiError(404, "NOT_FOUND", "That review photo is unavailable."));
  } catch (error) { return failure(request, error); }
  finally { previews--; }
}
export async function POST(request: Request) {
  const owner = await storeReviewStaffContext();
  if ("response" in owner) return privateResponse(owner.response);
  const parsed = await readJson(request, storeReviewPhotoDecisionSchema, { maxBytes: 8 * 1024 });
  if ("response" in parsed) return privateResponse(parsed.response);
  try {
    const changed = await moderateReviewPhoto(owner.admin, owner.user.id, owner.shopId, parsed.data);
    return privateResponse(changed ? NextResponse.json({ saved: true }) : apiError(409, "CONFLICT", "This review or photo changed. Refresh the queue before deciding."));
  } catch (error) { return failure(request, error); }
}
