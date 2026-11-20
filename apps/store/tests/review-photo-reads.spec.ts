import { expect, test } from "@playwright/test";
import { handleReviewPhotoRead } from "../lib/review-photo-reads";
import type { CustomerAccountSession } from "../lib/customer-account/storage";
import type { CustomerSessionResult } from "../lib/customer-account/session";

const photoId = "00000000-0000-4000-8000-000000000001";
const reviewId = "00000000-0000-4000-8000-000000000002";
const selection = { reviewId, productId: "100", updatedAt: "2026-11-20T00:00:00.123456Z", photos: [{ id: photoId, width: 48, height: 32 }] };
const bytes = Buffer.from("synthetic normalized WebP");
const session = { sessionHash: "a".repeat(64), subject: "private-buyer", createdAt: 1, expiresAt: 2, revision: 0 } as CustomerAccountSession;
const authenticated: CustomerSessionResult = { status: "authenticated", session };
function request(kind: "selection" | "preview", headers: Record<string, string> = {}, query?: string) {
  return new Request(`https://store.test/api/reviews/photos${kind === "selection" ? "/selection" : ""}?${query ?? (kind === "selection" ? `reviewId=${reviewId}` : `productId=100&photoId=${photoId}`)}`,
    { headers: { "sec-fetch-site": "same-origin", ...headers } });
}
function setup() {
  const calls: unknown[] = [];
  const deps: Parameters<typeof handleReviewPhotoRead>[2] = { enabled: true,
    loadSession: async () => { calls.push("session"); return authenticated; }, reader: {
      selection: async (input) => { calls.push(input); return selection; },
      preview: async (input) => { calls.push(input); return bytes; },
    } };
  return { deps, calls };
}

test("disabled reads and cross-site or sibling-site requests stop before loading the buyer", async () => {
  const { deps, calls } = setup();
  for (const kind of ["selection", "preview"] as const) {
    expect((await handleReviewPhotoRead(request(kind), kind, { ...deps, enabled: false })).status).toBe(503);
    const foreignHeaders: Record<string, string>[] = [{ "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "same-site" }, { origin: "https://other.test" }];
    for (const headers of foreignHeaders) {
      expect((await handleReviewPhotoRead(request(kind, headers), kind, deps)).status).toBe(403);
    }
  }
  expect(calls).toEqual([]);
});

test("malformed and caller-selected authority parameters are rejected before storage", async () => {
  const { deps, calls } = setup();
  for (const extra of ["&reviewId=" + reviewId, "&subject=other", "&shopId=456", "&path=other", "&url=https://private.test"]) {
    expect((await handleReviewPhotoRead(request("selection", {}, `reviewId=${reviewId}${extra}`), "selection", deps)).status).toBe(400);
  }
  expect((await handleReviewPhotoRead(request("preview", {}, `productId=100&photoId=${photoId}&productId=101`), "preview", deps)).status).toBe(400);
  expect(calls).toEqual([]);
});

test("selection reads return only the authenticated buyer's current reference set", async () => {
  const { deps, calls } = setup(); const response = await handleReviewPhotoRead(request("selection"), "selection", deps);
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ selection });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(calls).toEqual(["session", { subject: session.subject, reviewId }, "session"]);
});

test("image responses carry private, same-origin, uncacheable headers and no signed URL", async () => {
  const { deps, calls } = setup(); const response = await handleReviewPhotoRead(request("preview"), "preview", deps);
  expect(response.status).toBe(200); expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  expect(Object.fromEntries(response.headers)).toMatchObject({ "cache-control": "no-store", "referrer-policy": "no-referrer", "content-type": "image/webp",
    "content-length": String(bytes.length), "cross-origin-resource-policy": "same-origin", "x-content-type-options": "nosniff", vary: "Cookie" });
  expect(response.headers.has("location")).toBe(false); expect(response.headers.has("etag")).toBe(false);
  expect(calls).toEqual(["session", { subject: session.subject, productId: "100", id: photoId }, "session"]);
});

test("signed-out, failed or changed sessions never return references or bytes", async () => {
  for (const kind of ["selection", "preview"] as const) {
    const { deps, calls } = setup();
    expect((await handleReviewPhotoRead(request(kind), kind, { ...deps, loadSession: async () => ({ status: "sign_in_required" }) })).status).toBe(401);
    expect(calls).toEqual([]);
    let count = 0;
    deps.loadSession = async () => ++count === 1 ? authenticated : { status: "authenticated", session: { ...session, subject: "other", sessionHash: "b".repeat(64) } };
    const response = await handleReviewPhotoRead(request(kind), kind, deps);
    expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain(photoId);
  }
});

test("unknown/foreign references return the same private 404 and storage failures use safe copy", async () => {
  const { deps } = setup(); deps.reader!.selection = async () => null; deps.reader!.preview = async () => null;
  for (const kind of ["selection", "preview"] as const) {
    const response = await handleReviewPhotoRead(request(kind), kind, deps);
    expect(response.status).toBe(404); expect(response.headers.get("cache-control")).toBe("no-store");
  }
  deps.reader!.preview = async () => { throw new Error("private token storage path buyer ID"); };
  const response = await handleReviewPhotoRead(request("preview"), "preview", deps);
  expect(response.status).toBe(503); expect(await response.text()).not.toContain("token");
});

test("four verified preview pipelines may run and errors release all slots", async () => {
  const { deps } = setup(); let entered = 0; let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  deps.reader!.preview = async () => { entered++; await blocked; throw new Error("private failure"); };
  const pending = Array.from({ length: 4 }, () => handleReviewPhotoRead(request("preview"), "preview", deps));
  await expect.poll(() => entered).toBe(4);
  const busy = await handleReviewPhotoRead(request("preview"), "preview", deps);
  expect(busy.status).toBe(503); expect(busy.headers.get("retry-after")).toBe("3");
  release(); await Promise.all(pending);
  expect((await handleReviewPhotoRead(request("preview"), "preview", setup().deps)).status).toBe(200);
});
