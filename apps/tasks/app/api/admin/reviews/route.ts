import { NextResponse } from "next/server";
import { storeReviewDeletionSchema, storeReviewModerationQuery, storeReviewModerationSchema, storeReviewReplySchema } from "@/lib/api-schema";
import { apiError, databaseFailure, logServerFailure, privateResponse } from "@/lib/server/api-response";
import { readJson } from "@/lib/server/privileged-api";
import { deleteReview, loadReviewModerationPage, moderateReview, saveReviewReply } from "@/lib/server/store-reviews/moderation";
import { StoreReviewDatabaseError } from "@/lib/server/store-reviews/errors";
import { storeReviewStaffContext as context } from "@/lib/server/store-reviews/staff-context";

export const runtime = "nodejs";

function failure(request: Request, error: unknown) {
  // Database details can contain review text or a private moderation reason.
  return privateResponse(databaseFailure(request, "store_review_moderation", {
    code: error instanceof StoreReviewDatabaseError ? error.code : undefined,
  }, { error: "Review moderation is temporarily unavailable." }));
}

export async function GET(request: Request) {
  const authorized = await context();
  if ("response" in authorized) return privateResponse(authorized.response);
  const query = storeReviewModerationQuery(new URL(request.url).searchParams);
  if (!query) return privateResponse(apiError(400, "INVALID_REQUEST", "Choose a valid review queue and page."));
  try {
    return privateResponse(NextResponse.json(await loadReviewModerationPage(authorized.admin, authorized.user.id, authorized.shopId, query)));
  } catch (error) { return failure(request, error); }
}

export async function POST(request: Request) {
  const authorized = await context();
  if ("response" in authorized) return privateResponse(authorized.response);
  const parsed = await readJson(request, storeReviewModerationSchema, { maxBytes: 8 * 1024 });
  if ("response" in parsed) return privateResponse(parsed.response);
  try {
    const changed = await moderateReview(authorized.admin, authorized.user.id, authorized.shopId, parsed.data);
    return privateResponse(changed ? NextResponse.json({ saved: true }) :
      apiError(409, "CONFLICT", "This review changed. Refresh the queue before deciding."));
  } catch (error) { return failure(request, error); }
}

export async function PATCH(request: Request) {
  const authorized = await context();
  if ("response" in authorized) return privateResponse(authorized.response);
  const parsed = await readJson(request, storeReviewReplySchema, { maxBytes: 12 * 1024 });
  if ("response" in parsed) return privateResponse(parsed.response);
  try {
    const changed = await saveReviewReply(authorized.admin, authorized.user.id, authorized.shopId, parsed.data);
    return privateResponse(changed ? NextResponse.json({ saved: true }) :
      apiError(409, "CONFLICT", "This review or reply changed. Refresh the queue before editing it."));
  } catch (error) { return failure(request, error); }
}

export async function DELETE(request: Request) {
  const authorized = await context();
  if ("response" in authorized) return privateResponse(authorized.response);
  const parsed = await readJson(request, storeReviewDeletionSchema, { maxBytes: 8 * 1024 });
  if ("response" in parsed) return privateResponse(parsed.response);
  let outcome;
  try {
    outcome = await deleteReview(authorized.admin, authorized.user.id, authorized.shopId, parsed.data);
  } catch (error) { return failure(request, error); }
  if (!outcome.deleted) return privateResponse(apiError(409, "CONFLICT", "This review changed. Refresh the queue before deleting it."));
  // The review is gone either way; leftover files are private and unreferenced.
  if (!outcome.photosRemoved) logServerFailure(request, "store_review_photo_removal", { code: "STORAGE", message: `${outcome.photoCount} photo file(s) left after deleting a review` });
  return privateResponse(NextResponse.json({ deleted: true, photosRemoved: outcome.photosRemoved }));
}
