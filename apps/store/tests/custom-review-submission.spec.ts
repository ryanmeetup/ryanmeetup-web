import { expect, test } from "@playwright/test";
import type { BuyerReview, ReviewCommand } from "@ryanmeetup/reviews";
import { submitCustomReview } from "../lib/custom-review-submission";
import { getCustomReviewAccess } from "../lib/custom-review-access";
import { reviewSignInUrl } from "../lib/review-sign-in";
import type { CustomerSessionResult } from "../lib/customer-account/session";
import type { CustomerAccountSession } from "../lib/customer-account/storage";
import type { ReviewEligibility } from "../lib/review-purchases";

// decodeJwt only reads the claims; the real ID token was verified at sign-in.
const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const idToken = `${part({ alg: "RS256" })}.${part({ sub: "synthetic-buyer", email: "ryan@example.com" })}.signature`;
const session = { sessionHash: "a".repeat(64), subject: "synthetic-buyer", createdAt: 1, expiresAt: 2, accessExpiresAt: 2, revision: 0, tokens: { accessToken: "a", refreshToken: "r", idToken } } as CustomerAccountSession;
const signedIn: CustomerSessionResult = { status: "authenticated", session };
const purchase = { orderId: "9000", lineId: "1", productId: "100", variantId: "200", productTitle: "Name Tag Shirt", variantTitle: "Black / M", label: "Order #1001 · Black / M" };
const eligible: ReviewEligibility = { status: "eligible", buyer: { firstName: "Ryan", lastName: "Le" }, purchases: [purchase] };
const myReview: BuyerReview = {
  id: "3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b", lineId: "1", item: { productId: "100", productTitle: "Name Tag Shirt", variantTitle: "Black / M" },
  status: "pending", hasPendingEdit: false, publishedAt: null, createdAt: "2026-11-17T12:00:00.000000Z", updatedAt: "2026-11-17T12:00:00.000000Z",
  current: { rating: 5, title: "Ryan approved", body: "Great shirt.", nameStyle: "first-initial", displayName: "Ryan L." },
};
const review = { productId: "gid://shopify/Product/100", lineId: "1", rating: 5, title: "  Big fan ", body: "Great shirt.", nameStyle: "first-initial" };

function request(body: unknown = review, headers: HeadersInit = {}) {
  return new Request("https://store.test/api/reviews", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://store.test", host: "store.test", "x-forwarded-proto": "https", ...headers },
    body: JSON.stringify(body),
  });
}

const notBought: ReviewEligibility = { status: "none", reason: "not_purchased" };
const unverified = { ...review, lineId: null };

function setup({ sessionResult = signedIn, eligibility = eligible, outcome = "created" as const, name = { firstName: "Ryan", lastName: "Le" } as { firstName: string | null; lastName: string | null } | null, title = "Name Tag Shirt" as string | null | Error }: {
  sessionResult?: CustomerSessionResult; eligibility?: ReviewEligibility; outcome?: "created" | "exists" | "resubmitted" | "forbidden";
  name?: { firstName: string | null; lastName: string | null } | null; title?: string | null | Error;
} = {}) {
  const commands: ReviewCommand[] = [];
  const backend = (async (command: ReviewCommand) => {
    commands.push(command);
    return { reviewId: outcome === "forbidden" ? null : "3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b", outcome };
  }) as Parameters<typeof submitCustomReview>[1]["backend"];
  const findProductTitle = async () => { if (title instanceof Error) throw title; return title; };
  return { commands, deps: { loadSession: async () => sessionResult, findPurchases: async () => eligibility, findBuyerName: async () => name, findProductTitle, backend } };
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
  expect((await submitCustomReview(request(), setup({ eligibility: notBought }).deps)).status).toBe(403);
  expect((await submitCustomReview(request(), { ...setup().deps, backend: null })).status).toBe(503);
  const failing = { ...setup().deps, backend: (async () => { throw new Error("down"); }) as Parameters<typeof submitCustomReview>[1]["backend"] };
  expect((await submitCustomReview(request(), failing)).status).toBe(503);
});

test("a signed-in buyer without a matching order saves an unverified review of the product", async () => {
  const { commands, deps } = setup({ eligibility: notBought });
  const response = await submitCustomReview(request(unverified), deps);
  expect(response.status).toBe(200);
  expect(commands).toEqual([{
    operation: "review.submit", subject: "synthetic-buyer",
    purchase: { orderId: null, lineId: null, productId: "100", variantId: null, productTitle: "Name Tag Shirt", variantTitle: null },
    submission: { rating: 5, title: "Big fan", body: "Great shirt.", nameStyle: "first-initial" },
    displayName: "Ryan L.",
  }]);
  // A refunded or edited order the store would check by hand also takes this path.
  expect((await submitCustomReview(request(unverified), setup({ eligibility: { status: "none", reason: "needs_help" } }).deps)).status).toBe(200);
});

test("a review without an order is refused when the buyer has the order, or when a lookup fails", async () => {
  const withOrder = setup();
  const response = await submitCustomReview(request(unverified), withOrder.deps);
  expect(response.status).toBe(409);
  expect((await response.json()).error).toContain("Choose it so your review shows as verified");
  expect(withOrder.commands).toHaveLength(0);
  // A Shopify outage never downgrades a buyer's order into an unverified review.
  expect((await submitCustomReview(request(unverified), setup({ eligibility: { status: "unavailable" } }).deps)).status).toBe(503);
  expect((await submitCustomReview(request(unverified), setup({ eligibility: notBought, name: null }).deps)).status).toBe(503);
  expect((await submitCustomReview(request(unverified), setup({ eligibility: notBought, title: new Error("down") }).deps)).status).toBe(503);
  expect((await submitCustomReview(request(unverified), setup({ eligibility: notBought, title: null }).deps)).status).toBe(404);
  expect((await submitCustomReview(request({ ...review, lineId: undefined }), setup({ eligibility: notBought }).deps)).status).toBe(400);
});

test("retries and resubmissions report what already exists", async () => {
  expect((await submitCustomReview(request(), setup({ outcome: "exists" }).deps)).status).toBe(409);
  expect((await submitCustomReview(request(), setup({ outcome: "resubmitted" }).deps)).status).toBe(200);
  expect((await submitCustomReview(request(), setup({ outcome: "forbidden" }).deps)).status).toBe(403);
});

test("the form state follows the buyer's session and purchases", async () => {
  const args = { productId: "gid://shopify/Product/100", productPath: "/products/name-tag-shirt" };
  const access = (sessionResult: CustomerSessionResult, eligibility: ReviewEligibility = eligible, mine: BuyerReview[] | null = [],
    { products = [] as string[] | null, name = { firstName: "Ryan", lastName: "Le" } as { firstName: string | null; lastName: string | null } | null } = {}) =>
    getCustomReviewAccess({ ...args, loadSession: async () => sessionResult, findPurchases: async () => eligibility, findBuyerName: async () => name,
      reviewedLines: async () => { if (!mine) throw new Error("down"); return mine.filter((review) => review.status !== "withdrawn").flatMap((review) => review.lineId ? [review.lineId] : []); },
      reviewedProducts: async () => { if (!products) throw new Error("down"); return products; } });
  expect(await access({ status: "unavailable" })).toEqual({ status: "unavailable" });
  expect(await access({ status: "sign_in_required" })).toEqual({ status: "signed-out", signInUrl: reviewSignInUrl("/products/name-tag-shirt#reviews") });
  expect(reviewSignInUrl("/products/name-tag-shirt#reviews")).toBe("/api/reviews/auth/start?returnTo=%2Fproducts%2Fname-tag-shirt%23reviews");
  expect(await access(signedIn, { status: "unavailable" })).toEqual({ status: "unavailable" });
  expect(await access(signedIn)).toEqual({ status: "ready", buyer: { firstName: "Ryan", lastName: "Le" }, purchases: [{ lineId: "1", label: purchase.label }], defaultNameStyle: "first-initial" });
  const reviewedLine = (status: BuyerReview["status"]) => ({ ...myReview, status });
  expect(await access(signedIn, eligible, [reviewedLine("pending")])).toEqual({ status: "reviewed" });
  expect(await access(signedIn, eligible, [reviewedLine("rejected")])).toEqual({ status: "reviewed" });
  expect((await access(signedIn, eligible, [reviewedLine("withdrawn")])).status).toBe("ready");
  expect(await access(signedIn, eligible, null)).toEqual({ status: "unavailable" });
});

test("without a matching order, a signed-in buyer can still write one unverified review", async () => {
  const args = { productId: "gid://shopify/Product/100", productPath: "/products/name-tag-shirt", loadSession: async () => signedIn, reviewedLines: async () => [] };
  const access = (eligibility: ReviewEligibility, { products = [] as string[] | null, name = { firstName: "Ryan", lastName: null } as { firstName: string | null; lastName: string | null } | null } = {}) =>
    getCustomReviewAccess({ ...args, findPurchases: async () => eligibility, findBuyerName: async () => name,
      reviewedProducts: async () => { if (!products) throw new Error("down"); return products; } });
  for (const reason of ["not_purchased", "not_shipped", "needs_help"] as const) {
    expect(await access({ status: "none", reason })).toEqual({ status: "ready", buyer: { firstName: "Ryan", lastName: null }, purchases: [], defaultNameStyle: "first-initial" });
  }
  expect(await access(notBought, { products: ["100"] })).toEqual({ status: "reviewed" });
  expect(await access(notBought, { products: null })).toEqual({ status: "unavailable" });
  expect(await access(notBought, { name: null })).toEqual({ status: "unavailable" });
});

test("photos are gated, bounded and attached with server authority after a session recheck", async () => {
  const photoId = "00000000-0000-4000-8000-000000000001";
  const { commands, deps } = setup();
  expect((await submitCustomReview(request({ ...review, photoIds: [photoId] }), deps)).status).toBe(503);
  expect(commands).toEqual([]);
  expect((await submitCustomReview(request({ ...review, photoIds: [photoId, photoId] }), { ...deps, photosEnabled: true })).status).toBe(400);
  let sessions = 0;
  expect((await submitCustomReview(request({ ...review, photoIds: [photoId] }), { ...deps, photosEnabled: true, loadSession: async () => { sessions++; return signedIn; } })).status).toBe(200);
  expect(sessions).toBe(2); expect(commands[0]).toMatchObject({ operation: "review.submit", subject: session.subject, photoIds: [photoId] });
  sessions = 0;
  expect((await submitCustomReview(request({ ...review, photoIds: [photoId] }), { ...deps, photosEnabled: true,
    loadSession: async () => ++sessions === 1 ? signedIn : { status: "sign_in_required" } })).status).toBe(503);
  expect(commands).toHaveLength(1);
});

test("a failed atomic photo association returns a recoverable conflict and large review bodies are bounded", async () => {
  const { deps } = setup();
  const backend = (async () => ({ reviewId: null, outcome: "invalid_photos" })) as NonNullable<typeof deps.backend>;
  expect((await submitCustomReview(request({ ...review, photoIds: [] }), { ...deps, backend })).status).toBe(409);
  expect((await submitCustomReview(request({ ...review, body: "a".repeat(49 * 1024) }), deps)).status).toBe(413);
});
