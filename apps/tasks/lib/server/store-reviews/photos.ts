import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadVerifiedReviewPhoto, reviewPhotoObjectSchema } from "@ryanmeetup/reviews/server";
import type { ReviewPhotoDecision } from "@/lib/store-reviews/moderation";
import { StoreReviewDatabaseError } from "./errors";

type PhotoReference = Pick<ReviewPhotoDecision, "reviewId" | "revisionId" | "photoId" | "expectedUpdatedAt">;
export async function readStaffReviewPhoto(admin: SupabaseClient, actor: string, shopId: string, photo: PhotoReference) {
  return loadVerifiedReviewPhoto({
    context: async () => {
      const { data, error } = await admin.rpc("store_staff_review_photo", {
        p_actor: actor, p_shop_id: shopId, p_review_id: photo.reviewId, p_revision_id: photo.revisionId,
        p_photo_id: photo.photoId, p_expected_updated_at: photo.expectedUpdatedAt,
      }).abortSignal(AbortSignal.timeout(10_000));
      if (error) throw new StoreReviewDatabaseError(error.code);
      if (data === null) return null;
      const value = reviewPhotoObjectSchema(data);
      if (!value || value.id !== photo.photoId) throw new StoreReviewDatabaseError();
      return value;
    },
    download: async () => {
      const result = await admin.storage.from("store-review-photos")
        .download(`${shopId}/${photo.photoId}.webp`, {}, { signal: AbortSignal.timeout(10_000), cache: "no-store" }).asStream();
      if (result.error) throw new StoreReviewDatabaseError();
      return result.data;
    },
  });
}
export async function moderateReviewPhoto(admin: SupabaseClient, actor: string, shopId: string, command: ReviewPhotoDecision) {
  const { data, error } = await admin.rpc("store_moderate_review_photo", {
    p_actor: actor, p_shop_id: shopId, p_review_id: command.reviewId, p_revision_id: command.revisionId,
    p_photo_id: command.photoId, p_expected_updated_at: command.expectedUpdatedAt, p_action: command.action, p_note: command.note,
  });
  if (error) throw new StoreReviewDatabaseError(error.code);
  if (typeof data !== "boolean") throw new StoreReviewDatabaseError();
  return data;
}
