import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { handleReviewPhoto, REVIEW_PHOTO_HTTP_MAX_BYTES } from "../lib/review-photo-actions";
import { reviewPhotosEnabled } from "../lib/review-photo-policy";
import type { CustomerAccountSession } from "../lib/customer-account/storage";
import type { CustomerSessionResult } from "../lib/customer-account/session";

const id = "00000000-0000-4000-8000-000000000001";
const session = { sessionHash: "a".repeat(64), subject: "private-buyer", createdAt: 1, expiresAt: 2, revision: 0 } as CustomerAccountSession;
const authenticated: CustomerSessionResult = { status: "authenticated", session };
const reference = { id, width: 48, height: 32, expiresAt: new Date(Date.now() + 3600_000).toISOString() };
let png: Buffer;
test.beforeAll(async () => { png = await sharp({ create: { width: 48, height: 32, channels: 3, background: "red" } }).png().toBuffer(); });
function request({ body = png as BodyInit, query = `productId=100&requestKey=${id}`, method = "POST", headers = {} }: { body?: BodyInit | null; query?: string; method?: string; headers?: Record<string, string> } = {}) {
  return new Request(`https://store.test/api/reviews/photos?${query}`, { method, body, headers: { origin: "https://store.test", "content-type": "image/png", ...headers }, ...(body instanceof ReadableStream ? { duplex: "half" } : {}) });
}
function setup() {
  const calls: string[] = []; const inputs: unknown[] = [];
  const deps: Parameters<typeof handleReviewPhoto>[1] = {
    enabled: true,
    loadSession: async () => { calls.push("session"); return authenticated; },
    findPurchases: async () => { calls.push("purchases"); return { status: "none", reason: "not_purchased" }; },
    findProductTitle: async () => { calls.push("product"); return "Shirt"; },
    staging: {
      consumeUploadBudget: async () => { calls.push("budget"); return { allowed: true, retryAfter: 0 }; },
      stage: async (input) => { calls.push("stage"); inputs.push(input); return { status: "ready", photo: reference }; },
      getReady: async () => reference,
      discard: async (input) => { calls.push("discard"); inputs.push(input); return true; },
    },
  };
  return { calls, inputs, deps };
}

test("disabled collection, cross-origin and caller authority fields stop before authentication", async () => {
  const { deps, calls } = setup();
  expect((await handleReviewPhoto(request(), { ...deps, enabled: false })).status).toBe(503);
  expect((await handleReviewPhoto(request({ headers: { origin: "https://other.test" } }), deps)).status).toBe(403);
  for (const extra of ["&subject=other", "&productId=101", "&path=private", "&shopId=456", "&url=https://other.test"]) {
    expect((await handleReviewPhoto(request({ query: `productId=100&requestKey=${id}${extra}` }), deps)).status).toBe(400);
  }
  expect(calls).toEqual([]);
});

test("default collection stages authenticated attachments and an explicit pause stops before private work", async () => {
  const original = process.env.STORE_REVIEW_PHOTOS_ENABLED;
  try {
    delete process.env.STORE_REVIEW_PHOTOS_ENABLED;
    const enabled = setup();
    expect((await handleReviewPhoto(request(), { ...enabled.deps, enabled: reviewPhotosEnabled() })).status).toBe(200);
    expect(enabled.calls).toContain("stage");
    for (const setting of ["false", "invalid"]) {
      process.env.STORE_REVIEW_PHOTOS_ENABLED = setting;
      const paused = setup();
      expect((await handleReviewPhoto(request(), { ...paused.deps, enabled: reviewPhotosEnabled() })).status).toBe(503);
      expect(paused.calls).toEqual([]);
    }
  } finally {
    if (original === undefined) delete process.env.STORE_REVIEW_PHOTOS_ENABLED;
    else process.env.STORE_REVIEW_PHOTOS_ENABLED = original;
  }
});

test("signed-out and failed sessions cannot stage bytes", async () => {
  const { deps, calls } = setup();
  expect((await handleReviewPhoto(request(), { ...deps, loadSession: async () => ({ status: "sign_in_required" }) })).status).toBe(401);
  expect((await handleReviewPhoto(request(), { ...deps, loadSession: async () => { throw new Error("secret"); } })).status).toBe(503);
  expect(calls).toEqual([]);
});

test("valid images are normalized before staging and only private references are returned", async () => {
  const { deps, calls, inputs } = setup();
  const response = await handleReviewPhoto(request(), deps);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(await response.json()).toEqual({ status: "ready", photo: reference });
  expect(calls).toEqual(["session", "budget", "purchases", "product", "session", "stage", "session"]);
  const input = inputs[0] as { subject: string; productId: string; requestKey: string; photo: { bytes: Buffer; contentType: string } };
  expect(input).toMatchObject({ subject: session.subject, productId: "100", requestKey: id, photo: { contentType: "image/webp" } });
  expect((await sharp(input.photo.bytes).metadata()).format).toBe("webp");
});

test("lookup errors never become permission to stage an unverified photo", async () => {
  const { deps, calls } = setup();
  expect((await handleReviewPhoto(request(), { ...deps, findPurchases: async () => ({ status: "unavailable" }) })).status).toBe(503);
  expect((await handleReviewPhoto(request(), { ...deps, findProductTitle: async () => { throw new Error("private failure"); } })).status).toBe(503);
  expect((await handleReviewPhoto(request(), { ...deps, findProductTitle: async () => null })).status).toBe(404);
  expect(calls).not.toContain("stage");
});

test("budget denial avoids Shopify and image work and includes retry guidance", async () => {
  const { deps, calls } = setup();
  deps.staging!.consumeUploadBudget = async () => ({ allowed: false, retryAfter: 120 });
  const response = await handleReviewPhoto(request(), deps);
  expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("120");
  expect(calls).toEqual(["session"]);
});

test("actual streamed bytes are bounded despite a false length and excess data is cancelled", async () => {
  const { deps, calls } = setup(); let cancelled = false;
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(REVIEW_PHOTO_HTTP_MAX_BYTES + 1)); }, cancel() { cancelled = true; } });
  expect((await handleReviewPhoto(request({ body: stream, headers: { "content-length": "1" } }), deps)).status).toBe(413);
  expect(cancelled).toBe(true); expect(calls).not.toContain("stage");
  expect((await handleReviewPhoto(request({ headers: { "content-length": String(REVIEW_PHOTO_HTTP_MAX_BYTES + 1) } }), deps)).status).toBe(413);
});

test("empty, corrupt and unsupported images cannot be staged", async () => {
  const { deps, calls } = setup();
  expect((await handleReviewPhoto(request({ body: null }), deps)).status).toBe(400);
  expect((await handleReviewPhoto(request({ body: "not an image" }), deps)).status).toBe(422);
  expect((await handleReviewPhoto(request({ headers: { "content-type": "image/svg+xml" } }), deps)).status).toBe(415);
  expect(calls).not.toContain("stage");
});

test("account changes before or after staging never return a photo reference", async () => {
  for (const switchAt of [2, 3]) {
    const { deps, calls } = setup(); let count = 0;
    deps.loadSession = async () => ++count >= switchAt ? { status: "authenticated", session: { ...session, subject: "other-buyer", sessionHash: "b".repeat(64) } } : authenticated;
    const response = await handleReviewPhoto(request(), deps);
    expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain(id);
    expect(calls.filter((call) => call === "stage")).toHaveLength(switchAt === 2 ? 0 : 1);
    expect(calls).not.toContain("discard");
  }
});

test("discard uses the authenticated owner and never reveals foreign or attached photos", async () => {
  const { deps, inputs } = setup();
  const discard = () => request({ method: "DELETE", body: null, query: `productId=100&photoId=${id}` });
  expect((await handleReviewPhoto(discard(), deps)).status).toBe(200);
  expect(inputs).toEqual([{ subject: session.subject, productId: "100", id }]);
  deps.staging!.discard = async () => false;
  expect((await handleReviewPhoto(discard(), deps)).status).toBe(404);
});

test("only two body/decoder pipelines run per process and failure releases slots", async () => {
  const { deps } = setup();
  let release!: () => void; const blocked = new Promise<void>((resolve) => { release = resolve; });
  let entered = 0;
  deps.findPurchases = async () => { entered++; await blocked; return { status: "unavailable" }; };
  const first = handleReviewPhoto(request(), deps); const second = handleReviewPhoto(request(), deps);
  await expect.poll(() => entered).toBe(2);
  const response = await handleReviewPhoto(request(), deps);
  expect(response.status).toBe(503); expect(response.headers.get("retry-after")).toBe("3");
  release(); await Promise.all([first, second]);
  const { deps: fresh } = setup(); expect((await handleReviewPhoto(request(), fresh)).status).toBe(200);
});
