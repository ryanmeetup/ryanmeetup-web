import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReviewCommand } from "@ryanmeetup/reviews";
import { createReviewBackend, ReviewBackendError } from "../lib/review-backend";
import { getCustomReviews } from "../lib/custom-reviews";
import { handlePublicReviewPage } from "../lib/public-review-page";
import { fakeSupabase, supabaseCall } from "./fixtures/customer-auth-backend";

const originalError = console.error;
let logs: unknown[][];
test.beforeEach(() => { logs = []; console.error = (...args: unknown[]) => { logs.push(args); }; });
test.afterEach(() => { console.error = originalError; });

const privateDetail = "buyer@example.test private-token private-review-text private-session private-staff-note";
const publicCommand: Extract<ReviewCommand, { operation: "reviews.page" }> = { operation: "reviews.page", productIds: ["100"], limit: 20, cursor: null };
const reviewId = "00000000-0000-4000-8000-000000000001";
const write: ReviewCommand = {
  operation: "review.submit", subject: "private-buyer-subject",
  purchase: { orderId: "200", lineId: "201", productId: "100", variantId: "101", productTitle: "Shirt", variantTitle: "Blue / M" },
  submission: { rating: 4, title: "Private pending title", body: privateDetail, nameStyle: "first-initial" }, displayName: "Ryan L.",
};
const event = (operation: string, failure: string, code: string | null) => ({ event: "store_review_operation_failed", operation, failure, code });
const parsedLogs = () => logs.map((args) => {
  expect(args).toHaveLength(1);
  expect(typeof args[0]).toBe("string");
  return JSON.parse(args[0] as string);
});

function backendWithFailure(code: unknown = "PGRST202") {
  return createReviewBackend({ database: fakeSupabase(async () => Response.json({
    code, message: privateDetail, details: { subject: "private-buyer-subject", tokens: "private-token" }, hint: privateDetail,
  }, { status: 500 })), shopId: "123456" });
}

test("a failed public read emits one fixed event even when both read RPCs fail", async () => {
  expect(await getCustomReviews("100", backendWithFailure())).toEqual({ status: "unavailable", count: 0, averageRating: 0, reviews: [] });
  expect(parsedLogs()).toEqual([event("reviews.page", "storage_error", "PGRST202")]);
});

test("private writes log only the operation, category and known code without submission or error fields", async () => {
  await expect(backendWithFailure("23514")(write)).rejects.toThrow("Review storage is temporarily unavailable.");
  expect(parsedLogs()).toEqual([event("review.submit", "storage_error", "23514")]);
  expect(JSON.stringify(logs)).not.toMatch(/private|buyer@example|123456|\b201\b|Ryan/);
});

test("unknown and malformed error codes never become free-form log content", async () => {
  for (const code of [privateDetail, "PGRST202\nprivate-token", { secret: privateDetail }, 123456, null]) {
    await expect(backendWithFailure(code)(write)).rejects.toBeInstanceOf(ReviewBackendError);
  }
  expect(parsedLogs()).toEqual(Array.from({ length: 5 }, () => event("review.submit", "storage_error", "unrecognized")));
});

test("published data that violates the public contract is classified without logging its rows", async () => {
  const backend = createReviewBackend({ database: fakeSupabase(async (input, init) => {
    const name = supabaseCall(input, init)?.name;
    return Response.json(name === "store_review_summary" ? {
      count: 1, average: 4, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 },
    } : [{ id: reviewId, body: privateDetail, customerEmail: "buyer@example.test" }]);
  }), shopId: "123456" });
  await expect(backend(publicCommand)).rejects.toBeInstanceOf(ReviewBackendError);
  expect(parsedLogs()).toEqual([event("reviews.page", "invalid_response", null)]);
});

test("transport failures remain unavailable and never log the exception message or connection URL", async () => {
  const backend = createReviewBackend({ database: fakeSupabase(async () => { throw new Error(`https://private-token@backend.test ${privateDetail}`); }), shopId: "123456" });
  expect((await getCustomReviews("100", backend)).status).toBe("unavailable");
  expect(parsedLogs()).toEqual([event("reviews.page", "storage_error", null)]);
});

test("an unexpected database-client exception is classified without serializing the exception", async () => {
  const database = { rpc: () => { throw new Error(privateDetail, { cause: { tokens: "private-token" } }); } } as unknown as SupabaseClient;
  await expect(createReviewBackend({ database, shopId: "123456" })(publicCommand)).rejects.toBeInstanceOf(ReviewBackendError);
  expect(parsedLogs()).toEqual([event("reviews.page", "unexpected_error", null)]);
});

test("HTTP callers retain the generic unavailable response while server diagnostics stay private", async () => {
  const response = await handlePublicReviewPage(new Request("https://store.test/api/reviews/page?productId=100"), { backend: backendWithFailure("42501") });
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ error: "More reviews are temporarily unavailable. Please try again." });
  expect(parsedLogs()).toEqual([event("reviews.search", "storage_error", "42501")]);
});

test("successful reads, normal domain outcomes and rejected commands do not emit failure events", async () => {
  const read = createReviewBackend({ database: fakeSupabase(async (input, init) => Response.json(supabaseCall(input, init)?.name === "store_review_summary"
    ? { count: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } } : [])), shopId: "123456" });
  expect((await read(publicCommand)).summary.count).toBe(0);
  for (const outcome of ["created", "exists", "resubmitted", "forbidden"]) {
    const backend = createReviewBackend({ database: fakeSupabase(async () => Response.json([{ review_id: outcome === "forbidden" ? null : reviewId, outcome }])), shopId: "123456" });
    expect((await backend(write)).outcome).toBe(outcome);
  }
  for (const operation of ["review.edit", "review.withdraw"] as const) {
    for (const outcome of operation === "review.edit" ? ["pending", "closed", "not_found", "conflict"] : ["withdrawn", "not_found", "conflict"]) {
      const backend = createReviewBackend({ database: fakeSupabase(async () => Response.json(outcome)), shopId: "123456" });
      const common = { subject: "private-buyer-subject", reviewId, expectedUpdatedAt: "2026-11-20T12:00:00.000000Z" };
      const result = operation === "review.edit"
        ? await backend({ ...common, operation, submission: write.submission, displayName: "Ryan L." })
        : await backend({ ...common, operation });
      expect(result).toBe(outcome);
    }
  }
  // @ts-expect-error -- an untrusted operation must not reach storage or the event's operation field
  await expect(read({ operation: privateDetail })).rejects.toBeInstanceOf(ReviewBackendError);
  expect(logs).toEqual([]);
});

test("a broken logging sink cannot replace the original storage error", async () => {
  console.error = () => { throw new Error(privateDetail); };
  const failure = await backendWithFailure()(write).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(ReviewBackendError);
  expect((failure as Error).message).toBe("Review storage is temporarily unavailable.");
  expect((failure as ReviewBackendError).code).toBe("PGRST202");
});
