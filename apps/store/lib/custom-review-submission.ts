import { reviewDisplayName, reviewPhotoIdsSchema, reviewSubmissionSchema } from "@ryanmeetup/reviews";
import { numericProductId } from "./custom-reviews";
import { hasJsonBody, isSameOriginRequest, privateJson as reply, readBoundedJsonObject } from "./request-guard";
import { sameCustomerAccountSession } from "./customer-account/storage";
import type { ReviewPurchase } from "@ryanmeetup/reviews";
import type { CustomerAccountSession } from "./customer-account/storage";
import type { ReviewBackend } from "./review-backend";
import type { CustomerSessionResult } from "./customer-account/session";
import type { ReviewEligibilityLookup } from "./review-purchases";

const unavailable = () => reply(503, { error: "Review collection is temporarily unavailable. Please try again later." });

/**
 * Saves a signed-in buyer's review. With a chosen order line, the line must be
 * one of their verified purchases and the review is marked verified. With no
 * line, the buyer must have no reviewable order for the product, and the review
 * is saved without one. The browser sends only the line and the review; the
 * buyer, purchase details, product title, and public name come from the server.
 */
export async function submitCustomReview(request: Request, { loadSession, findPurchases, findBuyerName, findProductTitle, backend, photosEnabled = false }: {
  loadSession: () => Promise<CustomerSessionResult>;
  findPurchases: ReviewEligibilityLookup;
  findBuyerName: (session: CustomerAccountSession) => Promise<{ firstName: string | null; lastName: string | null } | null>;
  findProductTitle: (productId: string) => Promise<string | null>;
  backend: ReviewBackend | null;
  photosEnabled?: boolean;
}): Promise<Response> {
  if (!backend) return unavailable();
  if (!isSameOriginRequest(request)) return reply(403, { error: "Submit reviews from this storefront." });
  if (!hasJsonBody(request)) return reply(415, { error: "Your review could not be read. Please try again." });
  const parsed = await readBoundedJsonObject(request, 48 * 1024);
  if (parsed.status === "too-large") return reply(413, { error: "That review is too large." });
  if (parsed.status !== "valid") return reply(400, { error: "Your review could not be read. Please try again." });
  const { productId, lineId, photoIds, ...fields } = parsed.value;
  const hasPhotos = Object.hasOwn(parsed.value, "photoIds");
  if (hasPhotos && !reviewPhotoIdsSchema(photoIds)) return reply(400, { error: "Those review photos could not be read." });
  if (hasPhotos && (photoIds as string[]).length && !photosEnabled) return unavailable();
  const submission = reviewSubmissionSchema(fields);
  const product = typeof productId === "string" ? numericProductId(productId) : null;
  if (!submission || !product || !(lineId === null || (typeof lineId === "string" && /^[1-9][0-9]{0,19}$/.test(lineId)))) {
    return reply(400, { error: "Please complete every required field." });
  }

  const session = await loadSession().catch((): CustomerSessionResult => ({ status: "unavailable" }));
  if (session.status === "unavailable") return unavailable();
  if (session.status === "sign_in_required") return reply(401, { error: "Sign in to write a review." });

  // Ownership and eligibility are rechecked on every write, never trusted from the page.
  const eligibility = await findPurchases(session.session, product).catch(() => ({ status: "unavailable" as const }));
  if (eligibility.status === "unavailable") return unavailable();
  const purchases = eligibility.status === "eligible" ? eligibility.purchases : [];

  let purchase: ReviewPurchase;
  let buyer: { firstName: string | null; lastName: string | null };
  if (lineId !== null) {
    const line = purchases.find((candidate) => candidate.lineId === lineId);
    if (eligibility.status !== "eligible" || !line || line.productId !== product) {
      return reply(403, { error: "We couldn't find that purchase on your account." });
    }
    purchase = { orderId: line.orderId, lineId: line.lineId, productId: line.productId, variantId: line.variantId, productTitle: line.productTitle, variantTitle: line.variantTitle };
    buyer = eligibility.buyer;
  } else {
    // A buyer who has the order reviews the order, so it carries the Verified badge.
    if (purchases.length) return reply(409, { error: "We found your order for this. Choose it so your review shows as verified." });
    const [title, name] = await Promise.all([findProductTitle(product).catch(() => undefined), findBuyerName(session.session).catch(() => null)]);
    if (title === undefined || !name) return unavailable();
    if (!title) return reply(404, { error: "We couldn't find that product." });
    purchase = { orderId: null, lineId: null, productId: product, variantId: null, productTitle: title, variantTitle: null };
    buyer = name;
  }

  try {
    if (hasPhotos) {
      const current = await loadSession();
      if (current.status !== "authenticated" || !sameCustomerAccountSession(session.session, current.session)) return unavailable();
    }
    const result = await backend({
      operation: "review.submit", subject: session.session.subject, purchase, submission,
      displayName: reviewDisplayName(submission.nameStyle, buyer),
      ...(hasPhotos ? { photoIds: photoIds as string[] } : {}),
    });
    if (result.outcome === "created" || result.outcome === "resubmitted") return reply(200, { status: "pending" });
    if (result.outcome === "exists") return reply(409, { error: "You've already reviewed this." });
    if (result.outcome === "invalid_photos") return reply(409, { error: "A review photo is unavailable. Upload it again before submitting." });
    return reply(403, { error: "We couldn't find that purchase on your account." });
  } catch {
    return unavailable();
  }
}
