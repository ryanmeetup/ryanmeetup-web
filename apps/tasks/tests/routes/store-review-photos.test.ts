import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock("@/lib/server/store-reviews/staff-context", () => ({ storeReviewStaffContext: mocks.context }));
import { GET, POST } from "@/app/api/admin/reviews/photos/route";

const actor = "00000000-0000-4000-8000-000000000901";
const reviewId = "00000000-0000-4000-8000-000000000001";
const revisionId = "00000000-0000-4000-8000-000000000002";
const photoId = "00000000-0000-4000-8000-000000000003";
const expectedUpdatedAt = "2026-11-20T00:00:00.123456Z";
const reference = { reviewId, revisionId, photoId, expectedUpdatedAt };
const bytes = Buffer.from("normalized-webp");
const photo = { id: photoId, width: 48, height: 32, byteSize: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
let calls: { name: string; args: Record<string, unknown> }[];
let reads: number;
let last: unknown;
let result: unknown;
let downloads: number;
const get = (params = new URLSearchParams(reference), headers: HeadersInit = {}) => new Request(`https://tasks.test/api/admin/reviews/photos?${params}`, { headers });
const post = (body: unknown, headers: HeadersInit = {}) => new Request("https://tasks.test/api/admin/reviews/photos", { method: "POST", headers: { origin: "https://tasks.test", "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.stubEnv("TASKS_APP_URL", "https://tasks.test");
  calls = []; reads = 0; last = photo; result = true; downloads = 0;
  const admin = createClient("https://fake.supabase.co", "fake-secret", { auth: { persistSession: false, autoRefreshToken: false }, global: {
    fetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path.startsWith("/rest/v1/rpc/")) {
        const name = path.split("/").at(-1)!; calls.push({ name, args: JSON.parse(String(init?.body)) });
        return Response.json(name === "store_staff_review_photo" ? reads++ ? last : photo : result);
      }
      downloads++; return new Response(bytes);
    },
  } });
  mocks.context.mockResolvedValue({ user: { id: actor }, admin, shopId: "123" });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it("requires owner context and denies cross-site previews", async () => {
  mocks.context.mockResolvedValue({ response: Response.json({ error: "Denied" }, { status: 403 }) });
  expect((await GET(get())).status).toBe(403);
  expect((await POST(post({ ...reference, action: "approve", note: null }))).status).toBe(403);
  expect((await GET(get(undefined, { "sec-fetch-site": "same-site" }))).status).toBe(403);
  expect(calls).toHaveLength(0);
});
it("previews exact current media without emitting a storage capability", async () => {
  const response = await GET(get());
  expect(response.status).toBe(200); expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  expect(response.headers.get("cache-control")).toBe("no-store"); expect(response.headers.get("content-type")).toBe("image/webp");
  expect(response.headers.has("location")).toBe(false); expect(reads).toBe(2); expect(downloads).toBe(1);
  expect(calls[0]).toEqual({ name: "store_staff_review_photo", args: { p_actor: actor, p_shop_id: "123", p_review_id: reviewId, p_revision_id: revisionId, p_photo_id: photoId, p_expected_updated_at: expectedUpdatedAt } });
});
it("denies a foreign Origin even when fetch metadata is absent", async () => {
  expect((await GET(get(undefined, { origin: "https://evil.test" }))).status).toBe(403);
  expect(calls).toHaveLength(0);
});
it("rechecks owner/version/media after downloading and suppresses revoked bytes", async () => {
  last = null; const response = await GET(get()); expect(response.status).toBe(404); expect(downloads).toBe(1);
});
it("pins actor and shop and requires a private rejection reason", async () => {
  expect((await POST(post({ ...reference, action: "reject", note: "  Wrong item  " }))).status).toBe(200);
  expect(calls[0]).toEqual({ name: "store_moderate_review_photo", args: { p_actor: actor, p_shop_id: "123", p_review_id: reviewId, p_revision_id: revisionId, p_photo_id: photoId, p_expected_updated_at: expectedUpdatedAt, p_action: "reject", p_note: "Wrong item" } });
});
it("rejects forged authority, malformed versions, blank reasons and cross-origin writes", async () => {
  const valid = { ...reference, action: "approve", note: null };
  for (const invalid of [{ ...valid, actor }, { ...valid, shopId: "999" }, { ...valid, action: "publish" }, { ...valid, expectedUpdatedAt: "2026-11-20T00:00:00.123Z" }, { ...valid, action: "reject", note: "  " }, { ...valid, note: "x".repeat(1001) }]) expect((await POST(post(invalid))).status).toBe(400);
  expect((await POST(post(valid, { origin: "https://evil.test" }))).status).toBe(403);
  expect(calls).toHaveLength(0);
});
it("a stale/duplicate decision returns a conflict without retrying", async () => {
  result = false; expect((await POST(post({ ...reference, action: "approve", note: null }))).status).toBe(409); expect(calls).toHaveLength(1);
});
it("duplicate or unknown preview parameters never reach storage", async () => {
  for (const params of [new URLSearchParams({ ...reference, subject: "buyer" }), new URLSearchParams({ ...reference, photoId: "bad" })]) expect((await GET(get(params))).status).toBe(400);
  const params = new URLSearchParams(reference); params.append("photoId", photoId);
  expect((await GET(get(params))).status).toBe(400); expect(calls).toHaveLength(0);
});
