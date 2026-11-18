import { expect, test } from "@playwright/test";
import type { BuyerReview, ReviewCommand } from "@ryanmeetup/reviews";
import { submitCustomReview } from "../lib/custom-review-submission";
import { getCustomReviewAccess } from "../lib/custom-review-access";
import { reviewSignInUrl } from "../lib/review-sign-in";
import type { CustomerSessionResult } from "../lib/customer-account/session";
import type { CustomerAccountSession } from "../lib/customer-account/storage";
import type { ReviewEligibility } from "../lib/review-purchases";

const session = { sessionHash: "a".repeat(64), subject: "synthetic-buyer", createdAt: 1, expiresAt: 2, accessExpiresAt: 2, revision: 0, tokens: { accessToken: "a", refreshToken: "r", idToken: "i" } } as CustomerAccountSession;
const signedIn: CustomerSessionResult = { status: "authenticated", session };
const purchase = { orderId: "9000", lineId: "1", productId: "100", variantId: "200", productTitle: "Name Tag Shirt", variantTitle: "Black / M", label: "Order #1001 · Black / M" };
const eligible: ReviewEligibility = { status: "eligible", buyer: { firstName: "Ryan", lastName: "Le" }, purchases: [purchase] };
const myReview: BuyerReview = {
  id: "3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b", lineId: "1", item: { productId: "100", productTitle: "Name Tag Shirt", variantTitle: "Black / M" },
  status: "pending", hasPendingEdit: false, publishedAt: null, createdAt: "2026-11-17T12:00:00.000000Z", updatedAt: "2026-11-17T12:00:00.000000Z",
  current: { rating: 5, title: null, body: "Great shirt.", nameStyle: "first-initial", displayName: "Ryan L." },
};
const review = { productId: "gid://shopify/Product/100", lineId: "1", rating: 5, title: "  Big fan ", body: "Great shirt.", nameStyle: "first-initial" };

function request(body: unknown = review, headers: HeadersInit = {}) {
  return new Request("https://store.test/api/reviews", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://store.test", host: "store.test", "x-forwarded-proto": "https", ...headers },
    body: JSON.stringify(body),
  });
}

function setup({ sessionResult = signedIn, eligibility = eligible, outcome = "created" as const }: { sessionResult?: CustomerSessionResult; eligibility?: ReviewEligibility; outcome?: "created" | "exists" | "resubmitted" | "forbidden" } = {}) {
  const commands: ReviewCommand[] = [];
  const backend = (async (command: ReviewCommand) => {
    commands.push(command);
    return { reviewId: outcome === "forbidden" ? null : "3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b", outcome };
  }) as Parameters<typeof submitCustomReview>[1]["backend"];
  return { commands, deps: { loadSession: async () => sessionResult, findPurchases: async () => eligibility, backend } };
}

test("a signed-in buyer's review of their own line is saved with server-side identity and name", async () => {
  const { commands, deps } = setup();
  const response = await submitCustomReview(request(), deps);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "pending" });
  expect(commands).toEqual([{
    operation: "review.submit", subject: "synthetic-buyer",
    purchase: { orderId: "9000", lineId: "1", productId: "100", variantId: "200", productTitle: "Name Tag Shirt", variantTitle: "Black / M" },
    submission: { rating: 5, title: "Big fan", body: "Great shirt.", nameStyle: "first-initial" },
    displayName: "Ryan L.",
  }]);
});

test("the browser cannot pick the buyer, the name, or a line it does not own", async () => {
  const { commands, deps } = setup();
  expect((await submitCustomReview(request({ ...review, lineId: "999" }), deps)).status).toBe(403);
  expect((await submitCustomReview(request({ ...review, productId: "gid://shopify/Product/555" }), deps)).status).toBe(403);
  expect((await submitCustomReview(request({ ...review, subject: "someone-else" }), deps)).status).toBe(400);
  expect((await submitCustomReview(request({ ...review, displayName: "Admin" }), deps)).status).toBe(400);
  expect(commands).toHaveLength(0);
});

test("cross-site, malformed, and incomplete requests are refused before any lookup", async () => {
  let looked = false;
  const { deps } = setup();
  const watched = { ...deps, loadSession: async () => { looked = true; return signedIn; } };
  expect((await submitCustomReview(request(review, { origin: "https://evil.test" }), watched)).status).toBe(403);
  expect((await submitCustomReview(request(review, { "sec-fetch-site": "cross-site" }), watched)).status).toBe(403);
  expect((await submitCustomReview(request(review, { "content-type": "text/plain" }), watched)).status).toBe(415);
  expect((await submitCustomReview(request({ ...review, rating: 0 }), watched)).status).toBe(400);
  expect((await submitCustomReview(request({ ...review, body: "   " }), watched)).status).toBe(400);
  expect(looked).toBe(false);
});

test("sign-in, eligibility, and storage failures each get an honest answer", async () => {
  expect((await submitCustomReview(request(), setup({ sessionResult: { status: "sign_in_required" } }).deps)).status).toBe(401);
  expect((await submitCustomReview(request(), setup({ sessionResult: { status: "unavailable" } }).deps)).status).toBe(503);
  expect((await submitCustomReview(request(), setup({ eligibility: { status: "unavailable" } }).deps)).status).toBe(503);
  expect((await submitCustomReview(request(), setup({ eligibility: { status: "none", reason: "not_purchased" } }).deps)).status).toBe(403);
  expect((await submitCustomReview(request(), { ...setup().deps, backend: null })).status).toBe(503);
  const failing = { ...setup().deps, backend: (async () => { throw new Error("down"); }) as Parameters<typeof submitCustomReview>[1]["backend"] };
  expect((await submitCustomReview(request(), failing)).status).toBe(503);
});

test("retries and resubmissions report what already exists", async () => {
  expect((await submitCustomReview(request(), setup({ outcome: "exists" }).deps)).status).toBe(409);
  expect((await submitCustomReview(request(), setup({ outcome: "resubmitted" }).deps)).status).toBe(200);
  expect((await submitCustomReview(request(), setup({ outcome: "forbidden" }).deps)).status).toBe(403);
});

test("the form state follows the buyer's session and purchases", async () => {
  const args = { productId: "gid://shopify/Product/100", productPath: "/products/name-tag-shirt" };
  const access = (sessionResult: CustomerSessionResult, eligibility: ReviewEligibility = eligible, mine: BuyerReview[] | null = []) =>
    getCustomReviewAccess({ ...args, loadSession: async () => sessionResult, findPurchases: async () => eligibility,
      reviewedLines: async () => { if (!mine) throw new Error("down"); return mine.filter((review) => review.status !== "withdrawn").map((review) => review.lineId); } });
  expect(await access({ status: "unavailable" })).toEqual({ status: "unavailable" });
  expect(await access({ status: "sign_in_required" })).toEqual({ status: "signed-out", signInUrl: reviewSignInUrl("/products/name-tag-shirt#reviews") });
  expect(reviewSignInUrl("/products/name-tag-shirt#reviews")).toBe("/api/reviews/auth/start?returnTo=%2Fproducts%2Fname-tag-shirt%23reviews");
  expect(await access(signedIn, { status: "none", reason: "not_purchased" })).toEqual({ status: "no-purchase" });
  expect(await access(signedIn, { status: "none", reason: "not_shipped" })).toEqual({ status: "no-purchase" });
  // A lasting order state points the buyer at the store instead of "temporarily closed".
  expect(await access(signedIn, { status: "none", reason: "needs_help" })).toEqual({ status: "needs-help" });
  expect(await access(signedIn, { status: "unavailable" })).toEqual({ status: "unavailable" });
  expect(await access(signedIn)).toEqual({ status: "ready", buyer: { firstName: "Ryan", lastName: "Le" }, purchases: [{ lineId: "1", label: purchase.label }], defaultNameStyle: "first-initial", sample: false });
  const reviewedLine = (status: BuyerReview["status"]) => ({ ...myReview, status });
  expect(await access(signedIn, eligible, [reviewedLine("pending")])).toEqual({ status: "reviewed" });
  expect(await access(signedIn, eligible, [reviewedLine("rejected")])).toEqual({ status: "reviewed" });
  expect((await access(signedIn, eligible, [reviewedLine("withdrawn")])).status).toBe("ready");
  expect(await access(signedIn, eligible, null)).toEqual({ status: "unavailable" });
});
