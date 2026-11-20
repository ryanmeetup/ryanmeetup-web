import type { SupabaseClient } from "@supabase/supabase-js";
import { buyerReviewPhotoSchema, buyerReviewPhotoSelectionSchema } from "@ryanmeetup/reviews";
import type { BuyerReviewPhoto } from "@ryanmeetup/reviews";
import { getStoreDatabase, getStoreShopId } from "./store-database";
import { loadVerifiedReviewPhoto } from "@ryanmeetup/reviews/server";

const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const numeric = (value: unknown): value is string => typeof value === "string" && /^[1-9][0-9]{0,19}$/.test(value);
type PhotoContext = BuyerReviewPhoto & { productId: string; sha256: string; byteSize: number };
export class ReviewPhotoReadError extends Error {
  constructor() { super("Review photos are temporarily unavailable."); }
}
function subject(value: string) {
  if (typeof value !== "string" || value.length < 1 || value.length > 512 || /[\u0000-\u001f\u007f]/u.test(value)) throw new ReviewPhotoReadError();
}
function context(value: unknown, id: string, productId: string): PhotoContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ReviewPhotoReadError();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== 6 || row.id !== id || row.productId !== productId ||
    !buyerReviewPhotoSchema({ id: row.id, width: row.width, height: row.height }) ||
    typeof row.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(row.sha256) ||
    typeof row.byteSize !== "number" || !Number.isSafeInteger(row.byteSize) || row.byteSize < 1 || row.byteSize > 4 * 1024 * 1024) throw new ReviewPhotoReadError();
  return row as PhotoContext;
}

/** Server-only reads. The HTTP boundary supplies the authenticated subject; the shop stays pinned. */
export function createReviewPhotoReader({ database, shopId }: { database: SupabaseClient; shopId: string }) {
  if (!numeric(shopId)) throw new ReviewPhotoReadError();
  async function rpc(name: string, args: Record<string, unknown>) {
    try {
      const result = await database.rpc(name, { ...args, p_shop_id: shopId }).abortSignal(AbortSignal.timeout(10_000));
      if (result.error) throw new ReviewPhotoReadError();
      return result.data as unknown;
    } catch { throw new ReviewPhotoReadError(); }
  }
  return {
    async selection(input: { subject: string; reviewId: string }) {
      subject(input.subject);
      if (!uuid(input.reviewId)) throw new ReviewPhotoReadError();
      const value = await rpc("store_buyer_review_photo_selection", { p_subject: input.subject, p_review_id: input.reviewId });
      if (value === null) return null;
      const selection = buyerReviewPhotoSelectionSchema(value);
      if (!selection || selection.reviewId !== input.reviewId) throw new ReviewPhotoReadError();
      return selection;
    },
    async preview(input: { subject: string; productId: string; id: string }): Promise<Buffer | null> {
      subject(input.subject);
      if (!uuid(input.id) || !numeric(input.productId)) throw new ReviewPhotoReadError();
      const scope = { p_subject: input.subject, p_product_id: input.productId, p_id: input.id };
      try {
        return await loadVerifiedReviewPhoto({
          context: async () => {
            const value = await rpc("store_get_review_photo_preview", scope);
            if (value === null) return null;
            const photo = context(value, input.id, input.productId);
            return { id: photo.id, width: photo.width, height: photo.height, sha256: photo.sha256, byteSize: photo.byteSize };
          },
          download: async () => {
            const result = await database.storage.from("store-review-photos")
              .download(`${shopId}/${input.id}.webp`, {}, { signal: AbortSignal.timeout(10_000), cache: "no-store" }).asStream();
            if (result.error) throw new ReviewPhotoReadError();
            return result.data;
          },
        });
      } catch { throw new ReviewPhotoReadError(); }
    },
  };
}
export function getReviewPhotoReader() {
  const database = getStoreDatabase(); const shopId = getStoreShopId();
  return database && shopId ? createReviewPhotoReader({ database, shopId }) : null;
}
export type ReviewPhotoReader = ReturnType<typeof createReviewPhotoReader>;
