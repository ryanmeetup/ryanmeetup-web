import { reviewDisplayName, reviewSubmissionSchema } from "@ryanmeetup/reviews";
import { numericProductId } from "./custom-reviews";
import { hasJsonBody, isSameOriginRequest, privateJson as reply, readJsonObject } from "./request-guard";
import type { ReviewBackend } from "./review-backend";
import type { ReviewBuyerSession, ReviewEligibility } from "./review-purchases";

const unavailable = () => reply(503, { error: "Review collection is temporarily unavailable. Please try again later." });

/**
 * Saves a signed-in buyer's review of one purchased line. The browser sends
 * only the line it chose and the review; the buyer's identity, the purchase
 * details, and the public name all come from the server.
 */
export async function submitCustomReview<Session extends { subject: string }>(request: Request, { loadSession, findPurchases, backend }: {
  loadSession: () => Promise<ReviewBuyerSession<Session>>;
  findPurchases: (session: Session, productId: string) => Promise<ReviewEligibility>;
  backend: ReviewBackend | null;
}): Promise<Response> {
  if (!backend) return unavailable();
  if (!isSameOriginRequest(request)) return reply(403, { error: "Submit reviews from this storefront." });
  if (!hasJsonBody(request)) return reply(415, { error: "Your review could not be read. Please try again." });
  const input = await readJsonObject(request);
  if (!input) return reply(400, { error: "Your review could not be read. Please try again." });
  const { productId, lineId, ...fields } = input;
  const submission = reviewSubmissionSchema(fields);
  const product = typeof productId === "string" ? numericProductId(productId) : null;
  if (!submission || !product || typeof lineId !== "string" || !/^[1-9][0-9]{0,19}$/.test(lineId)) {
    return reply(400, { error: "Please complete every required field." });
  }

  const session = await loadSession().catch((): ReviewBuyerSession<Session> => ({ status: "unavailable" }));
  if (session.status === "unavailable") return unavailable();
  if (session.status === "sign_in_required") return reply(401, { error: "Sign in to review your purchase." });

  // Ownership and eligibility are rechecked on every write, never trusted from the page.
  const eligibility = await findPurchases(session.session, product).catch(() => ({ status: "unavailable" as const }));
  if (eligibility.status === "unavailable") return unavailable();
  const purchase = eligibility.status === "eligible" ? eligibility.purchases.find((line) => line.lineId === lineId) : undefined;
  if (eligibility.status !== "eligible" || !purchase || purchase.productId !== product) {
    return reply(403, { error: "We couldn't find that purchase on your account." });
  }

  try {
    const verified = { orderId: purchase.orderId, lineId: purchase.lineId, productId: purchase.productId, variantId: purchase.variantId, productTitle: purchase.productTitle, variantTitle: purchase.variantTitle };
    const result = await backend({
      operation: "review.submit", subject: session.session.subject, purchase: verified, submission,
      displayName: reviewDisplayName(submission.nameStyle, eligibility.buyer),
    });
    if (result.outcome === "created" || result.outcome === "resubmitted") return reply(200, { status: "pending" });
    if (result.outcome === "exists") return reply(409, { error: "You've already reviewed this purchase." });
    return reply(403, { error: "We couldn't find that purchase on your account." });
  } catch {
    return unavailable();
  }
}
