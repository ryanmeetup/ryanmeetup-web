import { reviewDisplayName, reviewSubmissionSchema } from "@ryanmeetup/reviews";
import type { ReviewCommand, ReviewResults } from "@ryanmeetup/reviews";
import type { CustomerSessionResult } from "./customer-account/session";
import { numericProductId } from "./custom-reviews";
import type { ReviewEligibilityLookup } from "./review-purchases";

const privateHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: privateHeaders });
const unavailable = () => reply(503, { error: "Review collection is temporarily unavailable. Please try again later." });

type Backend = <Command extends ReviewCommand>(command: Command) => Promise<ReviewResults[Command["operation"]]>;

function sameOrigin(request: Request) {
  const url = new URL(request.url);
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? url.protocol.slice(0, -1);
  const host = request.headers.get("host") ?? url.host;
  return request.headers.get("origin") === `${protocol}://${host}` && request.headers.get("sec-fetch-site") !== "cross-site";
}

/**
 * Saves a signed-in buyer's review of one purchased line. The browser sends
 * only the line it chose and the review; the buyer's identity, the purchase
 * details, and the public name all come from the server.
 */
export async function submitCustomReview(request: Request, { loadSession, findPurchases, backend }: {
  loadSession: () => Promise<CustomerSessionResult>;
  findPurchases: ReviewEligibilityLookup;
  backend: Backend | null;
}): Promise<Response> {
  if (!backend) return unavailable();
  if (!sameOrigin(request)) return reply(403, { error: "Submit reviews from this storefront." });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return reply(415, { error: "Your review could not be read. Please try again." });
  }
  let input: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    input = parsed as Record<string, unknown>;
  } catch {
    return reply(400, { error: "Your review could not be read. Please try again." });
  }
  const { productId, lineId, ...fields } = input;
  const submission = reviewSubmissionSchema(fields);
  const product = typeof productId === "string" ? numericProductId(productId) : null;
  if (!submission || !product || typeof lineId !== "string" || !/^[1-9][0-9]{0,19}$/.test(lineId)) {
    return reply(400, { error: "Please complete every required field." });
  }

  const session = await loadSession().catch((): CustomerSessionResult => ({ status: "unavailable" }));
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
