import type { CustomerSessionResult } from "./customer-account/session";
import { sameCustomerAccountSession } from "./customer-account/storage";
import { isSameOriginRead, privateHeaders, privateJson } from "./request-guard";
import type { ReviewPhotoReader } from "./review-photo-reader";

type Services = { enabled: boolean; loadSession: () => Promise<CustomerSessionResult>; reader: ReviewPhotoReader | null };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const unavailable = () => privateJson(503, { error: "Review photos are temporarily unavailable. Please try again later." });
let activePreviews = 0;

/** Private GETs only. References and image bytes never enter public review reads or an image optimizer. */
export async function handleReviewPhotoRead(request: Request, kind: "selection" | "preview", services: Services): Promise<Response> {
  if (!services.enabled || !services.reader) return unavailable();
  if (!isSameOriginRead(request)) return privateJson(403, { error: "View review photos from this storefront." });
  if (request.method !== "GET") return privateJson(405, { error: "That photo action is unavailable." });
  const params = new URL(request.url).searchParams;
  const idKey = kind === "selection" ? "reviewId" : "photoId";
  const keys = kind === "selection" ? [idKey] : [idKey, "productId"];
  const id = params.get(idKey); const productId = params.get("productId");
  if (!id || !uuid.test(id) || keys.some((key) => params.getAll(key).length !== 1) ||
    [...params.keys()].some((key) => !keys.includes(key)) || (kind === "preview" && (!productId || !/^[1-9][0-9]{0,19}$/.test(productId)))) {
    return privateJson(400, { error: "That photo request could not be read." });
  }
  const load = () => services.loadSession().catch((): CustomerSessionResult => ({ status: "unavailable" }));
  const session = await load();
  if (session.status === "sign_in_required") return privateJson(401, { error: "Sign in to view your review photos." });
  if (session.status !== "authenticated") return unavailable();
  const current = async () => {
    const next = await load();
    return next.status === "authenticated" && sameCustomerAccountSession(session.session, next.session);
  };
  try {
    if (kind === "selection") {
      const selection = await services.reader.selection({ subject: session.session.subject, reviewId: id });
      if (!await current()) return unavailable();
      return selection ? privateJson(200, { selection }) : privateJson(404, { error: "Those review photos are unavailable." });
    }
    // A fixed bound limits fully verified private buffers in flight; no download queue.
    if (activePreviews >= 4) { const response = unavailable(); response.headers.set("Retry-After", "3"); return response; }
    activePreviews++;
    try {
      const bytes = await services.reader.preview({ subject: session.session.subject, productId: productId!, id });
      if (!await current()) return unavailable();
      if (!bytes) return privateJson(404, { error: "That review photo is unavailable." });
      return new Response(new Uint8Array(bytes), { headers: { ...privateHeaders,
        "Content-Type": "image/webp", "Content-Length": String(bytes.length),
        "Content-Disposition": 'inline; filename="review-photo.webp"',
        "Cross-Origin-Resource-Policy": "same-origin", "X-Content-Type-Options": "nosniff", "Vary": "Cookie" } });
    } finally { activePreviews--; }
  } catch { return unavailable(); }
}
