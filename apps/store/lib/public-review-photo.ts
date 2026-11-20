import type { SupabaseClient } from "@supabase/supabase-js";
import { publicReviewPhotoPath } from "@ryanmeetup/reviews";
import { loadVerifiedReviewPhoto, reviewPhotoObjectSchema } from "@ryanmeetup/reviews/server";
import { getStoreDatabase, getStoreShopId } from "./store-database";

export type PublicPhotoReference = { reviewId: string; revisionId: string; photoId: string };
export function createPublicReviewPhotoReader(database: SupabaseClient, shopId: string) {
  if (!/^[1-9][0-9]{0,19}$/.test(shopId)) throw new Error("Review photos unavailable.");
  return async (input: PublicPhotoReference) => {
    if (!publicReviewPhotoPath(input.reviewId, input.revisionId, input.photoId)) return null;
    return loadVerifiedReviewPhoto({
      context: async () => {
        const { data, error } = await database.rpc("store_public_review_photo", {
          p_shop_id: shopId, p_review_id: input.reviewId, p_revision_id: input.revisionId, p_photo_id: input.photoId,
        }).abortSignal(AbortSignal.timeout(10_000));
        if (error) throw new Error("Review photos unavailable.");
        if (data === null) return null;
        const photo = reviewPhotoObjectSchema(data);
        if (!photo || photo.id !== input.photoId) throw new Error("Review photos unavailable.");
        return photo;
      },
      download: async () => {
        const result = await database.storage.from("store-review-photos")
          .download(`${shopId}/${input.photoId}.webp`, {}, { signal: AbortSignal.timeout(10_000), cache: "no-store" }).asStream();
        if (result.error) throw new Error("Review photos unavailable.");
        return result.data;
      },
    });
  };
}
export function getPublicReviewPhotoReader() {
  const database = getStoreDatabase(); const shopId = getStoreShopId();
  return database && shopId ? createPublicReviewPhotoReader(database, shopId) : null;
}
const headers = {
  "Cache-Control": "no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin",
};
let downloads = 0;
/** No redirects, signed URLs, optimizer or shared cache can outlive a decision. */
export async function handlePublicReviewPhoto(input: PublicPhotoReference, read: ReturnType<typeof getPublicReviewPhotoReader>) {
  if (!publicReviewPhotoPath(input.reviewId, input.revisionId, input.photoId)) return new Response(null, { status: 404, headers });
  if (!read) return new Response(null, { status: 503, headers });
  if (downloads >= 8) return new Response(null, { status: 503, headers: { ...headers, "Retry-After": "3" } });
  downloads++;
  try {
    const bytes = await read(input);
    return bytes ? new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/webp" } }) : new Response(null, { status: 404, headers });
  } catch { return new Response(null, { status: 503, headers }); }
  finally { downloads--; }
}
