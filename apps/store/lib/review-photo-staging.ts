import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStoreDatabase, getStoreShopId } from "./store-database";
import { REVIEW_PHOTO_OUTPUT_MAX_BYTES, REVIEW_PHOTO_OUTPUT_MAX_EDGE } from "./review-photo-processing";
import type { PreparedReviewPhoto } from "./review-photo-processing";

const bucketName = "store-review-photos";
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const numeric = (value: unknown): value is string => typeof value === "string" && /^[1-9][0-9]{0,19}$/.test(value);
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const bounded = (value: unknown, max: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max;
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)));

export class ReviewPhotoStagingError extends Error {
  constructor() { super("Review photo storage is temporarily unavailable."); }
}
type Owner = { subject: string; productId: string };
type StagedPhoto = { id: string; productId: string; sha256: string; byteSize: number; width: number; height: number; state: "uploading" | "ready"; expiresAt: string };
export type ReviewPhotoDraftReference = Pick<StagedPhoto, "id" | "width" | "height" | "expiresAt">;
export type ReviewPhotoStageResult = { status: "ready"; photo: ReviewPhotoDraftReference } | { status: "full" | "closed" | "conflict" };

function owner(owner: Owner) {
  if (!numeric(owner.productId) || typeof owner.subject !== "string" || owner.subject.length < 1 || owner.subject.length > 512 || /[\u0000-\u001f\u007f]/u.test(owner.subject)) throw new ReviewPhotoStagingError();
  return { p_subject: owner.subject, p_product_id: owner.productId };
}
function photoRow(value: unknown, productId: string): StagedPhoto {
  if (!exact(value, ["id", "productId", "sha256", "byteSize", "width", "height", "state", "expiresAt"]) || !uuid(value.id) || value.productId !== productId ||
    typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256) || !bounded(value.byteSize, REVIEW_PHOTO_OUTPUT_MAX_BYTES) ||
    !bounded(value.width, REVIEW_PHOTO_OUTPUT_MAX_EDGE) || !bounded(value.height, REVIEW_PHOTO_OUTPUT_MAX_EDGE) ||
    (value.state !== "uploading" && value.state !== "ready") || typeof value.expiresAt !== "string" || !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now()) {
    throw new ReviewPhotoStagingError();
  }
  return { id: value.id.toLowerCase(), productId, sha256: value.sha256, byteSize: value.byteSize, width: value.width,
    height: value.height, state: value.state, expiresAt: new Date(value.expiresAt).toISOString() };
}
const reference = ({ id, width, height, expiresAt }: StagedPhoto): ReviewPhotoDraftReference => ({ id, width, height, expiresAt });

/**
 * Store server only. Callers must first authenticate/recheck the buyer and product.
 * The subject is server authority, never a browser field. This creates no review,
 * signed upload/download URL, public object, workspace membership or publication.
 */
export function createReviewPhotoStaging({ database, shopId }: { database: SupabaseClient; shopId: string }) {
  if (!numeric(shopId)) throw new ReviewPhotoStagingError();
  const bucket = database.storage.from(bucketName);
  const path = (id: string) => `${shopId}/${id.toLowerCase()}.webp`;
  async function rpc(name: string, args: Record<string, unknown>) {
    try {
      const result = await database.rpc(name, { ...args, p_shop_id: shopId });
      if (result.error) throw new ReviewPhotoStagingError();
      return result.data as unknown;
    } catch { throw new ReviewPhotoStagingError(); }
  }

  return {
    /** Reuse the same request key and bytes after an uncertain response; nothing is overwritten. */
    async stage(input: Owner & { requestKey: string; photo: PreparedReviewPhoto }): Promise<ReviewPhotoStageResult> {
      const scope = owner(input);
      if (!uuid(input.requestKey) || input.photo?.contentType !== "image/webp" || !Buffer.isBuffer(input.photo.bytes) ||
        !bounded(input.photo.bytes.length, REVIEW_PHOTO_OUTPUT_MAX_BYTES) || !bounded(input.photo.width, REVIEW_PHOTO_OUTPUT_MAX_EDGE) || !bounded(input.photo.height, REVIEW_PHOTO_OUTPUT_MAX_EDGE)) throw new ReviewPhotoStagingError();
      const bytes = Buffer.from(input.photo.bytes);
      const sha256 = digest(bytes);
      const width = input.photo.width; const height = input.photo.height;
      const allocated = await rpc("store_begin_review_photo", { ...scope, p_request_key: input.requestKey, p_sha256: sha256, p_byte_size: bytes.length, p_width: width, p_height: height });
      if (!exact(allocated, ["outcome", "photo"])) throw new ReviewPhotoStagingError();
      if (allocated.outcome === "full" || allocated.outcome === "closed" || allocated.outcome === "conflict") {
        if (allocated.photo !== null) throw new ReviewPhotoStagingError();
        return { status: allocated.outcome };
      }
      if (allocated.outcome !== "allocated" && allocated.outcome !== "exists") throw new ReviewPhotoStagingError();
      const row = photoRow(allocated.photo, input.productId);
      if (row.sha256 !== sha256 || row.byteSize !== bytes.length || row.width !== width || row.height !== height) throw new ReviewPhotoStagingError();
      if (row.state === "ready") return { status: "ready", photo: reference(row) };
      let uploaded = false;
      try { uploaded = !(await bucket.upload(path(row.id), bytes, { contentType: "image/webp", cacheControl: "0", upsert: false })).error; }
      catch { /* A lost upload response can leave the exact object stored. Verify before finishing. */ }
      if (!uploaded) {
        try {
          const existing = await bucket.download(path(row.id));
          if (existing.error || !existing.data || existing.data.size !== bytes.length || existing.data.size > REVIEW_PHOTO_OUTPUT_MAX_BYTES ||
            digest(Buffer.from(await existing.data.arrayBuffer())) !== sha256) throw new ReviewPhotoStagingError();
        } catch { throw new ReviewPhotoStagingError(); }
      }
      const finished = await rpc("store_finish_review_photo", { ...scope, p_id: row.id, p_sha256: sha256 });
      if (finished !== true && finished !== false) throw new ReviewPhotoStagingError();
      // Expiry/discard can win during upload. Keep the private object for explicit cleanup.
      return finished ? { status: "ready", photo: reference({ ...row, state: "ready" }) } : { status: "closed" };
    },
    async getReady(input: Owner & { id: string }): Promise<ReviewPhotoDraftReference | null> {
      const scope = owner(input);
      if (!uuid(input.id)) throw new ReviewPhotoStagingError();
      const value = await rpc("store_get_review_photo", { ...scope, p_id: input.id });
      if (value === null) return null;
      const row = photoRow(value, input.productId);
      if (row.id !== input.id.toLowerCase()) throw new ReviewPhotoStagingError();
      return row.state === "ready" ? reference(row) : null;
    },
    async discard(input: Owner & { id: string }): Promise<boolean> {
      const scope = owner(input);
      if (!uuid(input.id)) throw new ReviewPhotoStagingError();
      const discarded = await rpc("store_discard_review_photo", { ...scope, p_id: input.id });
      if (discarded !== true && discarded !== false) throw new ReviewPhotoStagingError();
      if (!discarded) return false;
      // Only a confirmed scoped transition permits deleting its derived object path.
      try { if ((await bucket.remove([path(input.id)])).error) throw new ReviewPhotoStagingError(); }
      catch { throw new ReviewPhotoStagingError(); }
      return true;
    },
  };
}

export function getReviewPhotoStaging() {
  const database = getStoreDatabase(); const shopId = getStoreShopId();
  return database && numeric(shopId) ? createReviewPhotoStaging({ database, shopId }) : null;
}
