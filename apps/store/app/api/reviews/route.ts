import { validateEmail } from "@ryanmeetup/utils";
import { getJudgeMeShopDomain } from "@/lib/judgeme";
import { resolveReviewProvider, reviewPreviewCookie } from "@/lib/review-provider";
import { getCustomerAccountSession } from "@/lib/customer-account/runtime";
import { submitCustomReview } from "@/lib/custom-review-submission";
import { getReviewBackend } from "@/lib/review-backend";
import { numericProductId } from "@/lib/custom-reviews";
import { findReviewablePurchases } from "@/lib/review-purchases";
import { hasJsonBody, isSameOriginRequest, privateJson, readCookie, readJsonObject } from "@/lib/request-guard";

const fail = (error: string, status: number) => privateJson(status, { error });

function text(value: unknown, max: number) {
  return typeof value === "string" && value.trim().length <= max ? value.trim() : "";
}

/**
 * Forwards an unverified web review to Judge.me. Judge.me's create endpoint
 * takes no API token, so this only needs the shop domain; publication follows
 * the moderation settings in Judge.me. Photos are not accepted until they have
 * somewhere to be hosted, since Judge.me only takes picture URLs. Only this
 * storefront's own pages may submit, so the route is not an open relay.
 */
export async function POST(request: Request) {
  const provider = resolveReviewProvider(readCookie(request, reviewPreviewCookie));
  if (provider === "custom") {
    return submitCustomReview(request, { loadSession: () => getCustomerAccountSession(request), findPurchases: findReviewablePurchases, backend: getReviewBackend() });
  }
  if (provider !== "judgeme") {
    return fail("Review collection is temporarily unavailable. Please try again later.", 503);
  }
  const shopDomain = getJudgeMeShopDomain();
  if (!shopDomain) return fail("Review submissions will open when Judge.me is connected.", 503);

  if (!isSameOriginRequest(request)) return fail("Submit reviews from this storefront.", 403);
  if (!hasJsonBody(request)) return fail("Your review could not be read. Please try again.", 415);
  const submission = await readJsonObject(request);
  if (!submission) return fail("Your review could not be read. Please try again.", 400);

  const name = text(submission.name, 100);
  const email = text(submission.email, 254);
  const body = text(submission.body, 5000);
  const productId = numericProductId(text(submission.productId, 200));
  const rating = submission.rating;
  if (!name || !body || !productId || !Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) {
    return fail("Please complete every required field.", 400);
  }
  if (!validateEmail(email)) return fail("Enter a valid email address.", 400);

  try {
    const response = await fetch("https://judge.me/api/v1/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop_domain: shopDomain, platform: "shopify", id: Number(productId), name, email, rating, body }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return fail("Judge.me could not accept that review. Please try again.", 502);
  } catch {
    return fail("Judge.me could not be reached. Please try again.", 502);
  }
  return privateJson(200, { success: true });
}
