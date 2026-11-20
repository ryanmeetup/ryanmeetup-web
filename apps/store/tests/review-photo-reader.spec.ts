import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { buyerReviewPhotoSelectionSchema } from "@ryanmeetup/reviews";
import { createReviewPhotoReader, ReviewPhotoReadError } from "../lib/review-photo-reader";
import { fakeSupabase, supabaseCall } from "./fixtures/customer-auth-backend";

const id = "00000000-0000-4000-8000-000000000001";
const reviewId = "00000000-0000-4000-8000-000000000002";
const bytes = Buffer.from("synthetic-normalized-webp-bytes");
const metadata = { id, productId: "100", width: 48, height: 32, sha256: createHash("sha256").update(bytes).digest("hex"), byteSize: bytes.length };
const selection = { reviewId, productId: "100", updatedAt: "2026-11-20T00:00:00.123456Z", photos: [{ id, width: 48, height: 32 }] };
const scope = { subject: "private-buyer", productId: "100", id };
function fixture() {
  const calls: { name: string; args?: Record<string, unknown>; signal?: AbortSignal | null; cache?: RequestCache }[] = [];
  const state = { first: metadata as unknown, last: metadata as unknown, selection: selection as unknown,
    body: bytes as BodyInit, failed: false, downloaded: 0, reads: 0 };
  const database = fakeSupabase(async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const call = supabaseCall(input, init)!; calls.push(call);
      if (state.failed) return Response.json({ message: "private buyer token raw error", code: "PGRST202" }, { status: 404 });
      if (call.name === "store_buyer_review_photo_selection") return Response.json(state.selection);
      if (call.name !== "store_get_review_photo_preview") throw new Error("Unexpected RPC");
      return Response.json(state.reads++ === 0 ? state.first : state.last);
    }
    calls.push({ name: url.pathname, signal: init?.signal, cache: init?.cache }); state.downloaded++;
    expect(url.pathname).toBe(`/storage/v1/object/store-review-photos/123/${id}.webp`);
    expect(url.search).toBe("");
    return new Response(state.body, { headers: { "content-type": "image/webp" } });
  });
  return { calls, state, reader: createReviewPhotoReader({ database, shopId: "123" }) };
}

test("the saved selection is strictly bounded and exposes only IDs, dimensions, product and exact version", async () => {
  const { reader, calls } = fixture();
  expect(await reader.selection({ subject: scope.subject, reviewId })).toEqual(selection);
  expect(calls).toEqual([{ name: "store_buyer_review_photo_selection", args: { p_review_id: reviewId, p_shop_id: "123", p_subject: scope.subject } }]);
  expect(buyerReviewPhotoSelectionSchema({ ...selection, photos: [] })).not.toBeNull();
  for (const value of [null, { ...selection, subject: "private" }, { ...selection, photos: Array(6).fill(selection.photos[0]) },
    { ...selection, photos: [selection.photos[0], selection.photos[0]] }, { ...selection, updatedAt: "2026-11-20T00:00:00.123Z" },
    { ...selection, photos: [{ ...selection.photos[0], url: "https://private.test" }] }, { ...selection, photos: [{ ...selection.photos[0], width: 2049 }] }]) {
    expect(buyerReviewPhotoSelectionSchema(value)).toBeNull();
  }
});

test("foreign or missing selections remain distinct from malformed, leaky or failed storage replies", async () => {
  const { reader, state } = fixture();
  state.selection = null; expect(await reader.selection({ subject: scope.subject, reviewId })).toBeNull();
  for (state.selection of [{ ...selection, reviewId: id }, { ...selection, subject: "secret" }, { ...selection, photos: null }]) {
    await expect(reader.selection({ subject: scope.subject, reviewId })).rejects.toThrow(ReviewPhotoReadError);
  }
  state.failed = true;
  await expect(reader.selection({ subject: scope.subject, reviewId })).rejects.toThrow("Review photos are temporarily unavailable.");
});

test("preview streams a fixed private object, verifies its digest and rechecks its current authorization", async () => {
  const { reader, calls, state } = fixture();
  expect(await reader.preview(scope)).toEqual(bytes);
  expect(state.reads).toBe(2); expect(state.downloaded).toBe(1);
  expect(calls[0]).toEqual({ name: "store_get_review_photo_preview", args: { p_shop_id: "123", p_subject: scope.subject, p_product_id: "100", p_id: id } });
  expect(calls[1]).toMatchObject({ cache: "no-store", signal: expect.any(AbortSignal) });
  expect(calls[2]).toEqual(calls[0]);
});

test("unknown, expired, foreign or removed photos do not initiate a storage download", async () => {
  const { reader, state } = fixture(); state.first = null;
  expect(await reader.preview(scope)).toBeNull(); expect(state.downloaded).toBe(0);
});

test("scope mismatch, unsafe metadata and untrusted fields fail before downloading", async () => {
  const { reader, state } = fixture();
  for (state.first of [{ ...metadata, id: reviewId }, { ...metadata, productId: "101" }, { ...metadata, path: "other/object" },
    { ...metadata, byteSize: 4 * 1024 * 1024 + 1 }, { ...metadata, sha256: "invalid" }, { ...metadata, width: 0 }]) {
    state.reads = 0;
    await expect(reader.preview(scope)).rejects.toThrow(ReviewPhotoReadError);
  }
  expect(state.downloaded).toBe(0);
});

test("wrong bytes and truncation never return an image", async () => {
  for (const body of [Buffer.alloc(bytes.length, 1), bytes.subarray(1)]) {
    const { reader, state } = fixture(); state.body = body;
    await expect(reader.preview(scope)).rejects.toThrow(ReviewPhotoReadError);
    expect(state.reads).toBe(1);
  }
});

test("oversized streaming storage responses are cancelled before buffering past the expected size", async () => {
  const { reader, state } = fixture(); let cancelled = false;
  state.body = new ReadableStream({ pull(controller) { controller.enqueue(Buffer.alloc(bytes.length + 1)); }, cancel() { cancelled = true; } });
  await expect(reader.preview(scope)).rejects.toThrow(ReviewPhotoReadError);
  expect(cancelled).toBe(true); expect(state.reads).toBe(1);
});

test("discard, expiry or a changed photo selection during download revokes the response", async () => {
  const { reader, state } = fixture(); state.last = null;
  expect(await reader.preview(scope)).toBeNull(); expect(state.downloaded).toBe(1);
  const next = fixture(); next.state.last = { ...metadata, sha256: "b".repeat(64) };
  await expect(next.reader.preview(scope)).rejects.toThrow(ReviewPhotoReadError);
});

test("unsafe shop, buyer, product and photo identifiers cannot reach storage", async () => {
  const { reader, calls } = fixture();
  await expect(reader.preview({ ...scope, id: "../private" })).rejects.toThrow(ReviewPhotoReadError);
  await expect(reader.preview({ ...scope, subject: "bad\nsubject" })).rejects.toThrow(ReviewPhotoReadError);
  await expect(reader.preview({ ...scope, productId: "100/path" })).rejects.toThrow(ReviewPhotoReadError);
  await expect(reader.selection({ subject: "", reviewId })).rejects.toThrow(ReviewPhotoReadError);
  expect(calls).toEqual([]);
});
