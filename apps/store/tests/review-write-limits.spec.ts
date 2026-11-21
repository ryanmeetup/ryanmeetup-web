import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuyerReview, ReviewCommand } from "@ryanmeetup/reviews";
import { submitCustomReview } from "../lib/custom-review-submission";
import { handleMyReviewAction } from "../lib/my-review-actions";
import type { ReviewBackend } from "../lib/review-backend";
import type { CustomerSessionResult } from "../lib/customer-account/session";
import type { CustomerAccountSession } from "../lib/customer-account/storage";
import type { ReviewEligibility } from "../lib/review-purchases";
import {
  REVIEW_WRITE_BUDGETS, clientAddress, clientNetwork, createReviewWriteLimiter, reviewWriteLimited, reviewWriteRules,
} from "../lib/review-write-limits";
import type { ReviewWriteAction, ReviewWriteLimit, ReviewWriteLimiter } from "../lib/review-write-limits";

const session = { sessionHash: "a".repeat(64), subject: "synthetic-buyer", createdAt: 1, expiresAt: 2, accessExpiresAt: 2, revision: 0, tokens: { accessToken: "a", refreshToken: "r", idToken: "i" } } as CustomerAccountSession;
const signedIn: CustomerSessionResult = { status: "authenticated", session };
const headers = { "content-type": "application/json", origin: "https://store.test", host: "store.test", "x-forwarded-proto": "https", "x-real-ip": "203.0.113.9" };
const post = (path: string, body: unknown) => new Request(`https://store.test${path}`, { method: "POST", headers, body: JSON.stringify(body) });

const reviewId = "3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b";
const version = "2026-11-17T12:00:00.123456Z";
const mine: BuyerReview = { id: reviewId, lineId: "1", item: { productId: "100", productTitle: "Name Tag Shirt", variantTitle: null },
  status: "published", hasPendingEdit: false, rejectionReason: null, rejectedPhotos: [], publishedAt: "2026-11-17T12:00:00.123Z", createdAt: version, updatedAt: version,
  current: { rating: 5, title: "Ryan approved", body: "Great shirt.", nameStyle: "first-initial", displayName: "Ryan L." } };
const review = { productId: "gid://shopify/Product/100", lineId: "1", rating: 5, title: "Big fan", body: "Great shirt.", nameStyle: "first-initial" };
const purchase = { orderId: "9000", lineId: "1", productId: "100", variantId: "200", productTitle: "Name Tag Shirt", variantTitle: "Black / M", label: "Order #1001", orderLabel: "#1001" };
const eligible: ReviewEligibility = { status: "eligible", buyer: { firstName: "Ryan", lastName: "Le" }, purchases: [purchase] };

function limiter(decision: ReviewWriteLimit | Error) {
  const calls: { action: ReviewWriteAction; subject: string }[] = [];
  const limitWrites: ReviewWriteLimiter = async (action, { subject }) => {
    calls.push({ action, subject });
    if (decision instanceof Error) throw decision;
    return decision;
  };
  return { calls, limitWrites };
}

function services() {
  const commands: ReviewCommand[] = [];
  let lookups = 0;
  const backend = (async (command: ReviewCommand) => {
    commands.push(command);
    if (command.operation === "review.submit") return { reviewId, outcome: "created" };
    if (command.operation === "review.mine") return mine;
    if (command.operation === "review.edit") return "pending";
    if (command.operation === "review.withdraw") return "withdrawn";
    return null;
  }) as ReviewBackend;
  return {
    commands, lookups: () => lookups, backend, loadSession: async () => signedIn,
    findPurchases: async () => { lookups++; return eligible; },
    findBuyerName: async () => ({ firstName: "Ryan", lastName: "Le" }), findProductTitle: async () => "Name Tag Shirt",
  };
}

test.describe("review write handlers", () => {
  test("a submission within budget is saved and spends the buyer's budget", async () => {
    const deps = services();
    const { calls, limitWrites } = limiter({ allowed: true });
    expect((await submitCustomReview(post("/api/reviews", review), { ...deps, limitWrites })).status).toBe(200);
    expect(calls).toEqual([{ action: "submit", subject: "synthetic-buyer" }]);
    expect(deps.commands.map((command) => command.operation)).toEqual(["review.submit"]);
  });

  test("a submission over budget gets a 429 with Retry-After before any lookup or write", async () => {
    const deps = services();
    const response = await submitCustomReview(post("/api/reviews", review), { ...deps, ...limiter({ allowed: false, retryAfter: 1200 }) });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("1200");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ code: "rate_limited", error: expect.stringContaining("about 20 minutes") });
    expect(deps.lookups()).toBe(0);
    expect(deps.commands).toHaveLength(0);
  });

  test("a budget that cannot be checked refuses the submission", async () => {
    const deps = services();
    expect((await submitCustomReview(post("/api/reviews", review), { ...deps, ...limiter(new Error("down")) })).status).toBe(503);
    expect(deps.commands).toHaveLength(0);
  });

  test("malformed and signed-out submissions never spend the budget", async () => {
    const deps = services();
    const { calls, limitWrites } = limiter({ allowed: true });
    expect((await submitCustomReview(post("/api/reviews", { ...review, rating: 9 }), { ...deps, limitWrites })).status).toBe(400);
    expect((await submitCustomReview(post("/api/reviews", review), { ...deps, loadSession: async () => ({ status: "sign_in_required" }), limitWrites })).status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  test("an edit over budget is refused before the review is read", async () => {
    const deps = services();
    const edit = { action: "edit", reviewId, expectedUpdatedAt: version, rating: 4, title: "Ryan approved", body: "Faded a little.", nameStyle: "first-initial" };
    const { calls, limitWrites } = limiter({ allowed: false, retryAfter: 45 });
    const response = await handleMyReviewAction(post("/api/reviews/mine", edit), { ...deps, limitWrites });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("45");
    expect(calls).toEqual([{ action: "edit", subject: "synthetic-buyer" }]);
    expect(deps.commands).toHaveLength(0);
  });

  test("withdrawing a review is never budgeted", async () => {
    const deps = services();
    const { calls, limitWrites } = limiter({ allowed: false, retryAfter: 45 });
    const response = await handleMyReviewAction(post("/api/reviews/mine", { action: "withdraw", reviewId, expectedUpdatedAt: version }), { ...deps, limitWrites });
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(0);
  });
});

test.describe("review write rules", () => {
  test("the client address comes from the platform headers and must be an IP", () => {
    const at = (values: Record<string, string>) => clientAddress(new Request("https://store.test", { headers: values }));
    expect(at({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1" })).toBe("203.0.113.9");
    expect(at({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" })).toBe("198.51.100.1");
    expect(at({ "x-real-ip": "[2001:db8::1]" })).toBe("2001:db8::1");
    expect(at({ "x-real-ip": "not-an-ip", "x-forwarded-for": "also bad" })).toBeNull();
    expect(at({})).toBeNull();
  });

  test("IPv6 addresses share a budget across their /64", () => {
    expect(clientNetwork("203.0.113.9")).toBe("203.0.113.9");
    expect(clientNetwork("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(clientNetwork("2001:db8:1:2:aaaa::1")).toBe("2001:0db8:0001:0002::/64");
    expect(clientNetwork("2001:db8:1:2:ffff:ffff:ffff:ffff")).toBe("2001:0db8:0001:0002::/64");
    expect(clientNetwork("2001:db8::")).toBe("2001:0db8:0000:0000::/64");
    expect(clientNetwork("::1")).toBe("0000:0000:0000:0000::/64");
    expect(clientNetwork("64:ff9b::192.0.2.1")).toBe("0064:ff9b:0000:0000::/64");
    expect(clientNetwork("nope")).toBeNull();
  });

  test("submissions are budgeted per buyer, per day, and per hashed network; edits per buyer", () => {
    const submit = reviewWriteRules("submit", "buyer", "203.0.113.9", "secret");
    expect(submit.map(({ bucket, limit, windowSeconds }) => ({ bucket, limit, windowSeconds }))).toEqual([
      { bucket: "submit:buyer", limit: REVIEW_WRITE_BUDGETS.submit.buyerPerHour, windowSeconds: 3600 },
      { bucket: "submit:buyer-day", limit: REVIEW_WRITE_BUDGETS.submit.buyerPerDay, windowSeconds: 86_400 },
      { bucket: "submit:network", limit: REVIEW_WRITE_BUDGETS.submit.networkPerHour, windowSeconds: 3600 },
    ]);
    const network = submit[2].actor;
    expect(network).toMatch(/^[a-f0-9]{64}$/);
    expect(network).not.toContain("203.0.113.9");
    expect(reviewWriteRules("submit", "other", "203.0.113.9", "secret")[2].actor).toBe(network);
    expect(reviewWriteRules("submit", "buyer", "203.0.113.9", "rotated")[2].actor).not.toBe(network);
    expect(reviewWriteRules("submit", "buyer", null, "secret")).toHaveLength(2);
    expect(reviewWriteRules("edit", "buyer", "203.0.113.9", "secret")).toEqual([{ bucket: "edit:buyer", actor: "buyer", limit: REVIEW_WRITE_BUDGETS.edit.buyerPerHour, windowSeconds: 3600 }]);
  });

  test("the limited reply states the wait in words", async () => {
    const wait = async (seconds: number) => ((await reviewWriteLimited("submit", seconds).json()) as { error: string }).error;
    expect(await wait(30)).toContain("about a minute");
    expect(await wait(600)).toContain("about 10 minutes");
    expect(await wait(20_000)).toContain("about 6 hours");
    expect(await reviewWriteLimited("edit", 30).json()).toEqual({ code: "rate_limited", error: expect.stringContaining("review changes") });
  });
});

test.describe("review write limiter", () => {
  function database(result: { data: unknown; error: { code?: string } | null }) {
    const sent: { name: string; args: Record<string, unknown> }[] = [];
    const client = { rpc: (name: string, args: Record<string, unknown>) => { sent.push({ name, args }); return { abortSignal: async () => result }; } };
    return { sent, client: client as unknown as SupabaseClient };
  }
  const request = new Request("https://store.test", { headers: { "x-real-ip": "203.0.113.9" } });

  test("sends the store's shop and fixed rules, and reads the decision", async () => {
    const { sent, client } = database({ data: { allowed: false, retryAfter: 90 }, error: null });
    const limit = createReviewWriteLimiter({ database: client, shopId: "123", secret: "secret" });
    expect(await limit("submit", { subject: "buyer", request })).toEqual({ allowed: false, retryAfter: 90 });
    expect(sent[0].name).toBe("store_consume_review_write_budget");
    expect(sent[0].args).toEqual({ p_shop_id: "123", p_rules: reviewWriteRules("submit", "buyer", "203.0.113.9", "secret") });
  });

  test("a database without the budget function lets writes through", async () => {
    for (const code of ["PGRST202", "42883"]) {
      const limit = createReviewWriteLimiter({ database: database({ data: null, error: { code } }).client, shopId: "123", secret: "s" });
      expect(await limit("submit", { subject: "buyer", request })).toEqual({ allowed: true });
    }
  });

  test("any other failure or malformed decision rejects", async () => {
    for (const result of [
      { data: null, error: { code: "57014" } }, { data: null, error: {} }, { data: null, error: null },
      { data: { allowed: false, retryAfter: 0 }, error: null }, { data: { allowed: "yes" }, error: null },
    ]) {
      const limit = createReviewWriteLimiter({ database: database(result).client, shopId: "123", secret: "s" });
      await expect(limit("edit", { subject: "buyer", request })).rejects.toThrow();
    }
  });
});
