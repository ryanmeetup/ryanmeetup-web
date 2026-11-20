import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { isPublicReviewPhotoPath, publicReviewPhotoPath, publicReviewSchema } from "@ryanmeetup/reviews";
import { createPublicReviewPhotoReader, handlePublicReviewPhoto } from "../lib/public-review-photo";
import { publishedReviewPhotoUrl } from "../lib/review-photo-hosts";
import { fakeSupabase, supabaseCall } from "./fixtures/customer-auth-backend";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const reference = { reviewId: id(1), revisionId: id(2), photoId: id(3) };
const bytes = Buffer.from("normalized-webp");
const metadata = { id: reference.photoId, width: 48, height: 32, byteSize: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
function fixture() {
  const state = { initial: metadata as unknown, last: metadata as unknown, body: bytes as BodyInit, reads: 0, downloads: 0, fail: false };
  const calls: unknown[] = [];
  const database = fakeSupabase(async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      calls.push(supabaseCall(input, init));
      if (state.fail) return Response.json({ code: "P0001", message: "private buyer subject" }, { status: 500 });
      return Response.json(state.reads++ ? state.last : state.initial);
    }
    state.downloads++;
    expect(url.pathname).toBe(`/storage/v1/object/store-review-photos/123/${reference.photoId}.webp`);
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    return new Response(state.body);
  });
  return { state, calls, read: createPublicReviewPhotoReader(database, "123") };
}

test("public photo paths identify exactly one review revision without an external host or query", () => {
  const path = publicReviewPhotoPath(reference.reviewId, reference.revisionId, reference.photoId)!;
  expect(publishedReviewPhotoUrl(path)).toBe(path);
  for (const invalid of [path + "?token=secret", path + "/extra", `https://evil.test${path}`, "https://judgeme.imgix.net/image.jpg", "/api/reviews/media/no/review/photo", "//evil.test/image"]) {
    expect(isPublicReviewPhotoPath(invalid)).toBe(false); expect(publishedReviewPhotoUrl(invalid)).toBeNull();
  }
  expect(publicReviewPhotoPath("bad", reference.revisionId, reference.photoId)).toBeNull();
  expect(publicReviewSchema({ id: reference.reviewId, rating: 1, title: "Small", body: "Too small.", displayName: "Ryan", publishedAt: "2026-11-20T00:00:00Z", editedAt: null,
    item: { productId: "100", productTitle: "Shirt", variantTitle: null }, verifiedPurchase: true, photos: [{ url: path, width: 48, height: 32 }], reply: null })).not.toBeNull();
});

test("approved media uses pinned shop/context, digest verification and a second authorization check", async () => {
  const { read, state, calls } = fixture();
  const response = await handlePublicReviewPhoto(reference, read);
  expect(response.status).toBe(200);
  expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("cdn-cache-control")).toBe("no-store");
  expect(response.headers.get("content-type")).toBe("image/webp");
  expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  expect(response.headers.has("location")).toBe(false); expect(response.headers.has("etag")).toBe(false);
  expect(state.downloads).toBe(1); expect(state.reads).toBe(2);
  expect(calls).toEqual(Array(2).fill({ name: "store_public_review_photo", args: { p_shop_id: "123", p_review_id: reference.reviewId, p_revision_id: reference.revisionId, p_photo_id: reference.photoId } }));
});

test("hidden, withdrawn, rejected, replaced or missing authorization never downloads an object", async () => {
  const { read, state } = fixture(); state.initial = null;
  const response = await handlePublicReviewPhoto(reference, read);
  expect(response.status).toBe(404); expect(await response.text()).toBe(""); expect(state.downloads).toBe(0);
});

test("revocation during a download suppresses its bytes", async () => {
  const { read, state } = fixture(); state.last = null;
  const response = await handlePublicReviewPhoto(reference, read);
  expect(response.status).toBe(404); expect(await response.text()).toBe(""); expect(state.downloads).toBe(1);
});

test("unsafe metadata, corrupt bytes and provider errors never leak a body or private details", async () => {
  for (const mutate of [(s: ReturnType<typeof fixture>["state"]) => { s.initial = { ...metadata, path: "secret" }; },
    (s: ReturnType<typeof fixture>["state"]) => { s.body = Buffer.from("wrong"); },
    (s: ReturnType<typeof fixture>["state"]) => { s.last = { ...metadata, width: 100 }; },
    (s: ReturnType<typeof fixture>["state"]) => { s.fail = true; }]) {
    const { read, state } = fixture(); mutate(state);
    const response = await handlePublicReviewPhoto(reference, read);
    expect(response.status).toBe(503); expect(await response.text()).toBe(""); expect(response.headers.get("cache-control")).toBe("no-store");
  }
});

test("malformed paths and missing configuration stay uncached and never call storage", async () => {
  let called = false;
  const invalid = await handlePublicReviewPhoto({ ...reference, photoId: "../secret" }, async () => { called = true; return bytes; });
  expect(invalid.status).toBe(404); expect(called).toBe(false);
  const unavailable = await handlePublicReviewPhoto(reference, null);
  expect(unavailable.status).toBe(503); expect(unavailable.headers.get("cache-control")).toBe("no-store");
});

test("public delivery bounds simultaneous downloads and releases every slot", async () => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const active = Array.from({ length: 8 }, () => handlePublicReviewPhoto(reference, async () => { await waiting; return bytes; }));
  const busy = await handlePublicReviewPhoto(reference, async () => bytes);
  expect(busy.status).toBe(503); expect(busy.headers.get("retry-after")).toBe("3");
  release(); await Promise.all(active);
  expect((await handlePublicReviewPhoto(reference, async () => bytes)).status).toBe(200);
});
