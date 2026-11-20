import { sameCustomerAccountSession } from "./customer-account/storage";
import type { CustomerSessionResult } from "./customer-account/session";
import type { ReviewEligibilityLookup } from "./review-purchases";
import { isSameOriginRequest, privateJson as reply } from "./request-guard";
import { prepareReviewPhoto } from "./review-photo-processing";
import type { getReviewPhotoStaging } from "./review-photo-staging";
import { readReviewPhotoBytes } from "@ryanmeetup/reviews/server";
import { matchesReviewViewer, reviewViewerChanged, reviewViewerKey } from "./review-viewer";

// Raw bytes stay below the hosting platform's 4.5 MB request limit.
export const REVIEW_PHOTO_HTTP_MAX_BYTES = 4 * 1024 * 1024;
type Services = {
  enabled: boolean;
  loadSession: () => Promise<CustomerSessionResult>;
  findPurchases: ReviewEligibilityLookup;
  findProductTitle: (productId: string) => Promise<string | null>;
  staging: ReturnType<typeof getReviewPhotoStaging>;
};
const unavailable = () => reply(503, { error: "Review photos are temporarily unavailable. Please try again later." });
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
let active = 0;

async function readPhoto(request: Request): Promise<Uint8Array | "too_large" | null> {
  if (Number(request.headers.get("content-length")) > REVIEW_PHOTO_HTTP_MAX_BYTES) return "too_large";
  return readReviewPhotoBytes(request.body, REVIEW_PHOTO_HTTP_MAX_BYTES);
}

/** Private raw-image upload/discard boundary. No caller-selected identity, path, URL or bucket. */
export async function handleReviewPhoto(request: Request, services: Services): Promise<Response> {
  if (!services.enabled || !services.staging) return unavailable();
  if (!isSameOriginRequest(request)) return reply(403, { error: "Manage review photos from this storefront." });
  const uploading = request.method === "POST";
  if (!uploading && request.method !== "DELETE") return reply(405, { error: "That photo action is unavailable." });
  const params = new URL(request.url).searchParams;
  const key = uploading ? "requestKey" : "photoId";
  const productId = params.get("productId"); const id = params.get(key);
  if (!productId || !/^[1-9][0-9]{0,19}$/.test(productId) || !id || !uuid.test(id) ||
    [...params.keys()].some((name) => name !== "productId" && name !== key) || params.getAll(key).length !== 1 || params.getAll("productId").length !== 1) {
    return reply(400, { error: "That photo request could not be read." });
  }
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  if (uploading && !["image/jpeg", "image/png", "image/webp"].includes(contentType)) return reply(415, { error: "Choose a JPEG, PNG or WebP photo." });
  const load = () => services.loadSession().catch((): CustomerSessionResult => ({ status: "unavailable" }));
  const session = await load();
  if (session.status === "sign_in_required") return reply(401, { error: "Sign in to add review photos." });
  if (session.status !== "authenticated") return unavailable();
  if (!matchesReviewViewer(request, session.session)) return reviewViewerChanged();
  const scope = { subject: session.session.subject, productId };
  const current = async () => {
    const next = await load();
    return next.status === "authenticated" && sameCustomerAccountSession(session.session, next.session);
  };
  try {
    if (!uploading) {
      if (request.body !== null) return reply(400, { error: "That photo request could not be read." });
      if (!await current()) return unavailable();
      return await services.staging.discard({ ...scope, id }) ? reply(200, { status: "discarded" }) : reply(404, { error: "That photo is unavailable." });
    }
    const budget = await services.staging.consumeUploadBudget(scope.subject);
    if (!budget.allowed) {
      const response = reply(429, { error: "You've tried several photos. Please wait a little before trying again." });
      response.headers.set("Retry-After", String(budget.retryAfter));
      return response;
    }
    // A per-process bound complements the shared per-buyer budget. Never queue decoders.
    if (active >= 2) { const response = unavailable(); response.headers.set("Retry-After", "3"); return response; }
    active++;
    try {
      const eligibility = await services.findPurchases(session.session, productId);
      if (eligibility.status === "unavailable") return unavailable();
      if (eligibility.status !== "eligible" || !eligibility.purchases.some((line) => line.productId === productId)) {
        if (!await services.findProductTitle(productId)) return reply(404, { error: "We couldn't find that product." });
      }
      const bytes = await readPhoto(request);
      if (bytes === "too_large") return reply(413, { error: "Choose a photo no larger than 4 MiB." });
      if (!bytes) return reply(400, { error: "That photo could not be read. Please try again." });
      const prepared = await prepareReviewPhoto(bytes, contentType);
      if (!prepared.ok) return reply(422, { error: "Choose a still JPEG, PNG or WebP photo that can be opened." });
      if (!await current()) return unavailable();
      const result = await services.staging.stage({ ...scope, requestKey: id, photo: prepared.photo });
      if (!await current()) return unavailable();
      if (result.status === "ready") {
        const response = reply(200, { status: "ready", photo: result.photo });
        response.headers.set("X-Review-Viewer", reviewViewerKey(session.session));
        return response;
      }
      return reply(409, { error: result.status === "full" ? "A review can have up to five photos." : "Start a new upload for that photo." });
    } finally { active--; }
  } catch { return unavailable(); }
}
