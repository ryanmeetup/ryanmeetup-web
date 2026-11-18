import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeBuyerReviewCursor, decodeReviewCursor, encodeReviewCursor, publicReviewPageSchema } from "@ryanmeetup/reviews";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/server/admin-client", () => ({ getAdminClient: mocks.admin }));
import { POST } from "@/app/api/store/reviews/route";

const token = "t".repeat(43);
const scope = { shopId: "123456", clientId: "test-client", issuer: "https://shopify.com/authentication/123456", redirectUri: "https://store.test/api/reviews/auth/callback" };
const reviewId = "3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b";
const purchase = { orderId: "9000", lineId: "1", productId: "100", variantId: "200", productTitle: "Name Tag Shirt", variantTitle: "Black / M" };
const submission = { rating: 5, title: null, body: "Great shirt.", nameStyle: "first-initial" };
const submit = { operation: "review.submit", subject: "synthetic-buyer", purchase, submission, displayName: "Ryan L." };
const publicReview = (id: string, publishedAt: string) => ({
  id, rating: 5, title: null, body: "Great shirt.", displayName: "Ryan L.", publishedAt, editedAt: null,
  item: { productId: "100", productTitle: "Name Tag Shirt", variantTitle: "Black / M" }, verifiedPurchase: true, photos: [], reply: null,
});
const summary = (count: number) => ({ count, average: count ? 5 : 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: count } });
const buyerReview = (n: number) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`, lineId:String(n),
  item:{productId:"100",productTitle:"Name Tag Shirt",variantTitle:null},
  status:"pending",hasPendingEdit:false,publishedAt:null,
  createdAt:`2026-11-17T12:00:${String(59-n).padStart(2,"0")}.000123Z`,updatedAt:"2026-11-17T13:00:00.000456Z",
  current:{...submission,displayName:"Ryan L."},
});

function request(command: unknown = submit, headers: HeadersInit = {}) {
  return new Request("https://tasks.test/api/store/reviews", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...headers }, body: JSON.stringify(command) });
}

describe("store review backend", () => {
  beforeEach(() => {
    vi.stubEnv("STORE_REVIEWS_CUSTOMER_AUTH_ENABLED", "true");
    vi.stubEnv("STORE_REVIEWS_SUPABASE_PROJECT_REF", "lvfaartgcpphuokoswcm");
    vi.stubEnv("STORE_REVIEWS_CUSTOMER_AUTH_SCOPE", JSON.stringify(scope));
    vi.stubEnv("STORE_REVIEWS_SERVICE_TOKEN_SHA256", createHash("sha256").update(token).digest("hex"));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://lvfaartgcpphuokoswcm.supabase.co");
    mocks.admin.mockReturnValue({ from: mocks.from, rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({ data: [{ review_id: reviewId, outcome: "created" }], error: null });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("refuses the personal database, missing credentials, and browser requests before touching storage", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://vjsnobmfsfrsnwukfaoq.supabase.co");
    expect((await POST(request())).status).toBe(503);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://lvfaartgcpphuokoswcm.supabase.co");
    expect((await POST(request(submit, { authorization: `Bearer ${"x".repeat(43)}` }))).status).toBe(401);
    expect((await POST(request(submit, { origin: "https://store.test" }))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("pins the configured shop and passes only the verified fields", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ data: { reviewId, outcome: "created" } });
    expect(mocks.rpc).toHaveBeenCalledWith("store_submit_review", expect.objectContaining({ p_shop_id: "123456", p_subject: "synthetic-buyer", p_line_id: "1", p_display_name: "Ryan L." }));
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects caller-chosen shops, raw text, extra privileges, and unknown operations", async () => {
    for (const command of [
      { ...submit, shopId: "999" },
      { ...submit, submission: { ...submission, body: "  untrimmed  " } },
      { ...submit, submission: { ...submission, rating: 6 } },
      { ...submit, purchase: { ...purchase, orderId: "gid://shopify/Order/1" } },
      { ...submit, displayName: "" },
      { ...submit, approved: true },
      { operation: "review.approve", reviewId },
      { operation: "reviews.page", productIds: ["100"], limit: 500, cursor: null },
      { operation: "reviews.page", productIds: ["100"], limit: 10, cursor: "not-a-cursor" },
    ]) {
      expect((await POST(request(command))).status).toBe(400);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("never reveals another buyer's review ID", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ review_id: null, outcome: "forbidden" }], error: null });
    expect(await (await POST(request())).json()).toEqual({ data: { reviewId: null, outcome: "forbidden" } });
    mocks.rpc.mockResolvedValue({ data: [{ review_id: reviewId, outcome: "forbidden" }], error: null });
    expect((await POST(request())).status).toBe(500);
  });

  it("edits and withdraws only through the owner-scoped functions", async () => {
    mocks.rpc.mockResolvedValue({ data: "pending", error: null });
    const edit = await POST(request({ operation: "review.edit", subject: "synthetic-buyer", reviewId, expectedUpdatedAt: "2026-11-17T12:00:00.000000Z", submission, displayName: "Ryan L." }));
    expect(await edit.json()).toEqual({ data: "pending" });
    expect(mocks.rpc).toHaveBeenLastCalledWith("store_edit_buyer_review", expect.objectContaining({ p_review_id: reviewId, p_shop_id: "123456", p_subject: "synthetic-buyer" }));
    mocks.rpc.mockResolvedValue({ data: "withdrawn", error: null });
    expect(await (await POST(request({ operation: "review.withdraw", subject: "synthetic-buyer", reviewId, expectedUpdatedAt: "2026-11-17T12:00:00.000000Z" }))).json()).toEqual({ data: "withdrawn" });
  });

  it("returns a complete summary with a bounded page and an opaque cursor", async () => {
    const rows = [
      publicReview("00000000-0000-4000-8000-000000000003", "2026-11-17T12:00:03.000Z"),
      publicReview("00000000-0000-4000-8000-000000000002", "2026-11-17T12:00:02.000Z"),
      publicReview("00000000-0000-4000-8000-000000000001", "2026-11-17T12:00:01.000Z"),
    ];
    mocks.rpc.mockImplementation(async (name: string) => (name === "store_review_summary" ? { data: summary(3), error: null } : { data: rows, error: null }));
    const body = await (await POST(request({ operation: "reviews.page", productIds: ["100"], limit: 2, cursor: null }))).json();
    expect(publicReviewPageSchema(body.data)).not.toBeNull();
    expect(body.data.reviews).toHaveLength(2);
    expect(body.data.summary.count).toBe(3);
    expect(decodeReviewCursor(body.data.nextCursor)).toEqual({ publishedAt: rows[1].publishedAt, id: rows[1].id });
    expect(mocks.rpc).toHaveBeenCalledWith("store_public_reviews", expect.objectContaining({ p_limit: 3, p_after_published_at: null }));

    const cursor = encodeReviewCursor({ publishedAt: rows[1].publishedAt, id: rows[1].id });
    mocks.rpc.mockImplementation(async (name: string) => (name === "store_review_summary" ? { data: summary(3), error: null } : { data: [rows[2]], error: null }));
    const next = await (await POST(request({ operation: "reviews.page", productIds: ["100"], limit: 2, cursor }))).json();
    expect(next.data.nextCursor).toBeNull();
    expect(mocks.rpc).toHaveBeenLastCalledWith("store_public_reviews", expect.objectContaining({ p_after_published_at: rows[1].publishedAt, p_after_id: rows[1].id }));
  });

  it("refuses to send a page that breaks the public contract, even from its own database", async () => {
    const leaky = { ...publicReview("00000000-0000-4000-8000-000000000001", "2026-11-17T12:00:01.000Z"), orderId: "9000" };
    mocks.rpc.mockImplementation(async (name: string) => (name === "store_review_summary" ? { data: summary(1), error: null } : { data: [leaky], error: null }));
    const response = await POST(request({ operation: "reviews.page", productIds: ["100"], limit: 10, cursor: null }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("9000");
  });

  it("hides database error details", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "body contains private text" } });
    const response = await POST(request());
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(await response.json())).not.toContain("private text");
  });
  it("lists only the named buyer's own reviews and refuses anything beyond the buyer view", async () => {
    const mine = {
      id: reviewId, lineId: "1", item: { productId: "100", productTitle: "Name Tag Shirt", variantTitle: "Black / M" },
      status: "published", hasPendingEdit: true, publishedAt: "2026-11-17T12:00:00.000Z", createdAt: "2026-11-17T12:00:00.000000Z", updatedAt: "2026-11-17T13:00:00.000000Z",
      current: { rating: 4, title: "Update", body: "Second take.", nameStyle: "full", displayName: "Ryan Le" },
    };
    mocks.rpc.mockResolvedValue({ data: [mine], error: null });
    const response = await POST(request({ operation: "reviews.mine", subject: "synthetic-buyer", cursor: null }));
    expect(await response.json()).toEqual({ data: { reviews:[mine],nextCursor:null } });
    expect(mocks.rpc).toHaveBeenLastCalledWith("store_buyer_reviews", expect.objectContaining({ p_shop_id: "123456", p_subject: "synthetic-buyer", p_limit:21 }));
    expect((await POST(request({ operation: "reviews.mine", subject: "synthetic-buyer", cursor: null, shopId: "999" }))).status).toBe(400);
    for (const leak of [{ ...mine, note: "Private note" }, { ...mine, status: "pending", hasPendingEdit: true }, { ...mine, current: { ...mine.current, rating: 9 } }]) {
      mocks.rpc.mockResolvedValue({ data: [leak], error: null });
      expect((await POST(request({ operation: "reviews.mine", subject: "synthetic-buyer", cursor: null }))).status).toBe(500);
    }
  });

  it("pages buyer history with the exact creation version and validates the extra row", async () => {
    const rows = Array.from({length:21},(_,n)=>buyerReview(n+1));
    mocks.rpc.mockResolvedValue({data:rows,error:null});
    const first = await (await POST(request({operation:"reviews.mine",subject:"synthetic-buyer",cursor:null}))).json();
    expect(first.data.reviews).toHaveLength(20);
    expect(decodeBuyerReviewCursor(first.data.nextCursor)).toEqual({id:rows[19].id,createdAt:rows[19].createdAt});
    mocks.rpc.mockResolvedValue({data:[rows[20]],error:null});
    const next = await (await POST(request({operation:"reviews.mine",subject:"synthetic-buyer",cursor:first.data.nextCursor}))).json();
    expect(next.data).toEqual({reviews:[rows[20]],nextCursor:null});
    expect(mocks.rpc).toHaveBeenLastCalledWith("store_buyer_reviews",expect.objectContaining({p_after_id:rows[19].id,p_after_created_at:rows[19].createdAt}));
    mocks.rpc.mockResolvedValue({data:[...rows.slice(0,20),{...rows[20],privateNote:"Do not expose"}],error:null});
    expect((await POST(request({operation:"reviews.mine",subject:"synthetic-buyer",cursor:null}))).status).toBe(500);
  });

  it("scopes direct buyer reads and reviewed lines and rejects unrelated database rows", async () => {
    const row = buyerReview(1);
    mocks.rpc.mockResolvedValue({data:[row],error:null});
    expect(await (await POST(request({operation:"review.mine",subject:"synthetic-buyer",reviewId:row.id}))).json()).toEqual({data:row});
    expect(mocks.rpc).toHaveBeenLastCalledWith("store_buyer_reviews",{p_shop_id:"123456",p_subject:"synthetic-buyer",p_review_id:row.id,p_limit:1});
    expect((await POST(request({operation:"review.mine",subject:"synthetic-buyer",reviewId}))).status).toBe(500);
    mocks.rpc.mockResolvedValue({data:["1"],error:null});
    expect(await (await POST(request({operation:"reviews.reviewedLines",subject:"synthetic-buyer",lineIds:["1","2"]}))).json()).toEqual({data:["1"]});
    expect(mocks.rpc).toHaveBeenLastCalledWith("store_buyer_reviewed_lines",{p_shop_id:"123456",p_subject:"synthetic-buyer",p_line_ids:["1","2"]});
    mocks.rpc.mockResolvedValue({data:["3"],error:null});
    expect((await POST(request({operation:"reviews.reviewedLines",subject:"synthetic-buyer",lineIds:["1","2"]}))).status).toBe(500);
  });
});
