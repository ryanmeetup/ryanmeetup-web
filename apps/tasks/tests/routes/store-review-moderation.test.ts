import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ context: vi.fn(), rpc: vi.fn(), remove: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/server/privileged-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server/privileged-api")>(), privilegedContext: mocks.context,
}));
import { DELETE, GET, POST, PATCH } from "@/app/api/admin/reviews/route";

const actor = "00000000-0000-4000-8000-000000000901";
const reviewId = "00000000-0000-4000-8000-000000000001";
const revisionId = "00000000-0000-4000-8000-000000000002";
const time = "2026-11-18T12:00:00.123456Z";
const scope = { shopId: "123", clientId: "client", issuer: "https://shopify.com/authentication/123", redirectUri: "https://store.test/api/reviews/auth/callback" };
const revision = { id: revisionId, rating: 1, title: "Ryan approved", body: "Too small.", displayName: "Anonymous", submittedAt: time, photos: [] };
const row = { reply: null, id: reviewId, state: "active", createdAt: time, updatedAt: time,
  item: { productId: "100", productTitle: "Shirt", variantTitle: null }, verifiedPurchase: true, pending: revision, published: null, latest: revision, rejected: null,
  recentEvents: [{ action: "submitted", actorKind: "buyer", actor: null, note: null, createdAt: time }] };
const decision = { action: "approve", reviewId, expectedUpdatedAt: time, revisionId, note: null };
function post(body: unknown = decision, headers: HeadersInit = {}) {
  return new Request("https://tasks.test/api/admin/reviews", { method: "POST", headers: {
    "content-type": "application/json", origin: "https://tasks.test", ...headers,
  }, body: JSON.stringify(body) });
}
function patch(body: unknown, headers: HeadersInit = {}) {
  return new Request("https://tasks.test/api/admin/reviews", { method: "PATCH", headers: {
    "content-type": "application/json", origin: "https://tasks.test", ...headers,
  }, body: JSON.stringify(body) });
}
const reply = { reviewId, expectedUpdatedAt: time, body: "Thanks for the feedback." };
function del(body: unknown, headers: HeadersInit = {}) {
  return new Request("https://tasks.test/api/admin/reviews", { method: "DELETE", headers: {
    "content-type": "application/json", origin: "https://tasks.test", ...headers,
  }, body: JSON.stringify(body) });
}
const deletion = { reviewId, expectedUpdatedAt: time, reason: "spam", note: "Link spam" };
const photoId = "00000000-0000-4000-8000-000000000003";
const get = (query = "") => new Request(`https://tasks.test/api/admin/reviews${query}`);
const products = [{ productId: "100", productTitle: "Shirt" }, { productId: "200", productTitle: "Hat" }];
// GET reads the page and the product list together; each answers its own RPC.
let pageResult: { data: unknown; error: unknown };
let productResult: { data: unknown; error: unknown };

describe("owner review moderation", () => {
  beforeEach(() => {
    vi.stubEnv("TASKS_APP_URL", "https://tasks.test");
    vi.stubEnv("STORE_REVIEWS_CUSTOMER_AUTH_ENABLED", "true");
    vi.stubEnv("STORE_REVIEWS_SUPABASE_PROJECT_REF", "lvfaartgcpphuokoswcm");
    vi.stubEnv("STORE_REVIEWS_CUSTOMER_AUTH_SCOPE", JSON.stringify(scope));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://lvfaartgcpphuokoswcm.supabase.co");
    mocks.context.mockResolvedValue({ user: { id: actor }, admin: { rpc: mocks.rpc, storage: { from: mocks.from } } });
    mocks.from.mockReturnValue({ remove: mocks.remove });
    mocks.remove.mockResolvedValue({ data: [], error: null });
    pageResult = { data: [row], error: null };
    productResult = { data: products, error: null };
    mocks.rpc.mockImplementation(async (name: string) => name === "store_review_moderation_products" ? productResult : pageResult);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("requires Tasks owner authentication for reads and writes, regardless of service bearer", async () => {
    mocks.context.mockImplementation(async () => ({ response: NextResponse.json({ error: "Denied" }, { status: 403 }) }));
    expect((await GET(get())).status).toBe(403);
    expect((await POST(post(decision, { authorization: `Bearer ${"a".repeat(43)}` }))).status).toBe(403);
    expect((await PATCH(patch(reply, { authorization: `Bearer ${"a".repeat(43)}` }))).status).toBe(403);
    expect((await DELETE(del(deletion, { authorization: `Bearer ${"a".repeat(43)}` }))).status).toBe(403);
    expect(mocks.context).toHaveBeenCalledWith({ owner: true });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails closed for PRD, a mismatched backend, a disabled service, and missing scope", async () => {
    for (const url of ["https://vjsnobmfsfrsnwukfaoq.supabase.co", "https://other.supabase.co"]) {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
      expect((await GET(get())).status).toBe(503);
      expect((await POST(post())).status).toBe(503);
      expect((await PATCH(patch(reply))).status).toBe(503);
      expect((await DELETE(del(deletion))).status).toBe(503);
    }
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://lvfaartgcpphuokoswcm.supabase.co");
    vi.stubEnv("STORE_REVIEWS_CUSTOMER_AUTH_ENABLED", "false");
    expect((await GET(get())).status).toBe(503);
    vi.stubEnv("STORE_REVIEWS_CUSTOMER_AUTH_ENABLED", "true");
    vi.stubEnv("STORE_REVIEWS_CUSTOMER_AUTH_SCOPE", "{}");
    expect((await GET(get())).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("loads the pinned shop and preserves exact timestamps in a private page", async () => {
    const response = await GET(get());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(await response.json()).toEqual({ reviews: [row], next: null, products });
    expect(mocks.rpc).toHaveBeenCalledWith("store_review_moderation_page_v5", {
      p_actor: actor, p_shop_id: "123", p_filter: "pending", p_product_id: null, p_limit: 21, p_after_created_at: null, p_after_id: null,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("store_review_moderation_products", { p_actor: actor, p_shop_id: "123" });
  });

  it("filters the rejected queue to one product and validates the product list", async () => {
    const rejectedRow = { ...row, pending: null, rejected: revision };
    pageResult = { data: [rejectedRow], error: null };
    const response = await GET(get("?filter=rejected&productId=100"));
    expect(response.status).toBe(200);
    expect((await response.json()).reviews[0].rejected).toEqual(revision);
    expect(mocks.rpc).toHaveBeenCalledWith("store_review_moderation_page_v5", expect.objectContaining({ p_filter: "rejected", p_product_id: "100" }));
    for (const invalid of [[{ ...rejectedRow, pending: revision }], [{ ...rejectedRow, rejected: { ...revision, id: reviewId } }]]) {
      pageResult = { data: invalid, error: null };
      expect((await GET(get())).status).toBe(500);
    }
    pageResult = { data: [row], error: null };
    for (const invalid of [[{ productId: "gid://shopify/Product/1", productTitle: "Shirt" }], [{ ...products[0], customerSubject: "secret" }], null]) {
      productResult = { data: invalid, error: null };
      expect((await GET(get())).status).toBe(500);
    }
  });

  it("bounds paging and validates complete keyset cursors without rounding", async () => {
    pageResult = { data: Array.from({ length: 21 }, (_, i) => ({ ...row, id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}` })), error: null };
    const response = await GET(get());
    const page = await response.json();
    expect(page.reviews).toHaveLength(20);
    expect(page.next).toEqual({ id: "00000000-0000-4000-8000-000000000020", createdAt: time });
    await GET(get(`?filter=published&afterCreatedAt=${encodeURIComponent(time)}&afterId=${reviewId}`));
    expect(mocks.rpc).toHaveBeenCalledWith("store_review_moderation_page_v5", expect.objectContaining({ p_filter: "published", p_after_created_at: time, p_after_id: reviewId }));
  });

  it("rejects unknown fields, caller shops/actors, rating filters, and malformed cursor dates", async () => {
    for (const query of ["?shopId=999", "?filter=5", "?filter=pending&filter=all", "?afterId=" + reviewId, "?productId=shirt", "?productId=0",
      `?afterCreatedAt=2026-02-31T12:00:00.123456Z&afterId=${reviewId}`]) {
      expect((await GET(get(query))).status).toBe(400);
    }
    for (const body of [{ ...decision, shopId: "999" }, { ...decision, actor }, { ...decision, action: ["approve"] },
      { ...decision, revisionId: null }, { ...decision, action: "republish", revisionId: null }, { ...decision, expectedUpdatedAt: time.slice(0, 23) + "Z" },
      { ...decision, action: "hide", revisionId: null, note: " " }, { ...decision, action: "reject", note: "x".repeat(1001) },
      // Publishing carries no note.
      { ...decision, note: "Looks good" }, { ...decision, action: "republish", note: "Changed my mind" }]) {
      expect((await POST(post(body))).status).toBe(400);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("checks browser origin, media type, and body size before any decision", async () => {
    expect((await POST(post(decision, { origin: "https://evil.test" }))).status).toBe(403);
    expect((await POST(post(decision, { "content-type": "text/plain" }))).status).toBe(415);
    expect((await POST(post({ ...decision, note: "x".repeat(9000) }))).status).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("writes one transactional decision with the authenticated actor and exact expected version", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const response = await POST(post({ ...decision, action: "hide", revisionId: null, note: "  Contains a phone number  " }));
    expect(await response.json()).toEqual({ saved: true });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("store_moderate_review", {
      p_actor: actor, p_shop_id: "123", p_review_id: reviewId, p_expected_updated_at: time,
      p_action: "hide", p_revision_id: null, p_note: "Contains a phone number",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("publishes a rejected revision only by its exact ID, with an optional private note", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const response = await POST(post({ ...decision, action: "republish", note: null }));
    expect(await response.json()).toEqual({ saved: true });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("store_moderate_review", expect.objectContaining({
      p_action: "republish", p_revision_id: revisionId, p_note: null,
    }));
  });

  it("returns a conflict for a stale or withdrawn review and maps revoked owner access", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect((await POST(post())).status).toBe(409);
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "private subject" } });
    expect((await POST(post())).status).toBe(403);
  });

  it("never passes raw database errors or unexpected private columns to the browser", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "private review text", details: "private reason" } });
    const response = await POST(post());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private");
    mocks.rpc.mockImplementation(async (name: string) => name === "store_review_moderation_products" ? productResult : pageResult);
    for (const data of [[{ ...row, customerSubject: "secret" }], [{ ...row, recentEvents: [{ ...row.recentEvents[0], actor: "buyer-secret" }] }], [{ ...row, pending: { ...revision, rating: 8 } }], null]) {
      pageResult = { data, error: null };
      expect((await GET(get())).status).toBe(500);
    }
  });

  it("saves normalized public reply text with a pinned actor/shop and exact version", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const response = await PATCH(patch({ ...reply, body: "  Thanks!\r\n\r\n\r\nCafe\u0301.\u0000  " }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("store_save_review_reply", {
      p_actor: actor, p_shop_id: "123", p_review_id: reviewId, p_expected_updated_at: time, p_body: "Thanks!\n\nCafé.",
    });
  });
  it("removes only with an explicit null body and rejects invalid/privileged reply fields", async () => {
    for (const invalid of [{ ...reply, body: " " }, { ...reply, body: "x".repeat(2001) },
      { reviewId, expectedUpdatedAt: time }, { ...reply, actor }, { ...reply, shopId: "999" },
      { ...reply, author: "Somebody else" }, { ...reply, note: "Private" }, { ...reply, expectedUpdatedAt: time.slice(0, 23) + "Z" }]) {
      expect((await PATCH(patch(invalid))).status).toBe(400);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    expect((await PATCH(patch({ ...reply, body: null }))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenLastCalledWith("store_save_review_reply", expect.objectContaining({ p_body: null }));
    expect((await PATCH(patch({ ...reply, body: "😀".repeat(2000) }))).status).toBe(200);
    expect((await PATCH(patch({ ...reply, body: "😀".repeat(2001) }))).status).toBe(400);
  });
  it("refuses cross-origin/oversized replies and never hides stale or uncertain write failures", async () => {
    expect((await PATCH(patch(reply, { origin: "https://evil.test" }))).status).toBe(403);
    expect((await PATCH(patch({ ...reply, body: "x".repeat(13 * 1024) }))).status).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect((await PATCH(patch(reply))).status).toBe(409);
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "private reply" } });
    expect((await PATCH(patch(reply))).status).toBe(403);
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0001", details: "private reply" } });
    const response = await PATCH(patch(reply));
    expect(response.status).toBe(500); expect(JSON.stringify(await response.json())).not.toContain("private reply");
  });
  it("returns only the validated staff reply fields and rejects malformed projections", async () => {
    const staffReply = { body: reply.body, publishedAt: time, updatedAt: time };
    pageResult = { data: [{ ...row, reply: staffReply }], error: null };
    expect((await (await GET(get())).json()).reviews[0].reply).toEqual(staffReply);
    for (const invalid of [{ ...staffReply, author: actor }, { ...staffReply, body: "  untrimmed " }, { ...staffReply, updatedAt: "bad" }]) {
      pageResult = { data: [{ ...row, reply: invalid }], error: null };
      expect((await GET(get())).status).toBe(500);
    }
  });

  it("deletes with a pinned actor and shop, then removes the review's private photo files", async () => {
    mocks.rpc.mockResolvedValue({ data: [photoId], error: null });
    const response = await DELETE(del(deletion));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ deleted: true, photosRemoved: true });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("store_delete_review", {
      p_actor: actor, p_shop_id: "123", p_review_id: reviewId, p_expected_updated_at: time, p_reason: "spam", p_note: "Link spam",
    });
    expect(mocks.from).toHaveBeenCalledWith("store-review-photos");
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([`123/${photoId}.webp`]);
  });
  it("skips storage without photos and reports, never hides, a failed file removal", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect(await (await DELETE(del({ ...deletion, note: null }))).json()).toEqual({ deleted: true, photosRemoved: true });
    expect(mocks.remove).not.toHaveBeenCalled();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({ data: [photoId], error: null });
    mocks.remove.mockResolvedValue({ data: null, error: { message: "storage down" } });
    const response = await DELETE(del(deletion));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true, photosRemoved: false });
  });
  it("accepts only policy reasons and refuses privileged or malformed deletion fields", async () => {
    for (const invalid of [{ ...deletion, reason: "low_rating" }, { ...deletion, reason: null }, { reviewId, expectedUpdatedAt: time, reason: "spam" },
      { ...deletion, actor }, { ...deletion, shopId: "999" }, { ...deletion, note: "x".repeat(1001) }, { ...deletion, note: "bad\u0001" },
      { ...deletion, reviewId: "not-a-uuid" }, { ...deletion, expectedUpdatedAt: time.slice(0, 23) + "Z" }]) {
      expect((await DELETE(del(invalid))).status).toBe(400);
    }
    expect((await DELETE(del(deletion, { origin: "https://evil.test" }))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect((await DELETE(del({ ...deletion, note: "   " }))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenLastCalledWith("store_delete_review", expect.objectContaining({ p_note: null }));
  });
  it("returns a conflict for a stale or deleted review and keeps database details private", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect((await DELETE(del(deletion))).status).toBe(409);
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "private" } });
    expect((await DELETE(del(deletion))).status).toBe(403);
    mocks.rpc.mockResolvedValue({ data: ["not-a-uuid"], error: null });
    expect((await DELETE(del(deletion))).status).toBe(500);
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0001", details: "private review text" } });
    const response = await DELETE(del(deletion));
    expect(response.status).toBe(500); expect(JSON.stringify(await response.json())).not.toContain("private");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
