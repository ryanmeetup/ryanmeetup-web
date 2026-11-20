import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ context: vi.fn(), rpc: vi.fn(), query: { calls: [] as unknown[][], result: {} as unknown } }));
vi.mock("@/lib/server/privileged-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server/privileged-api")>(), privilegedContext: mocks.context,
}));
import { GET } from "@/app/api/admin/reviews/pending-count/route";

const scope = { shopId: "123", clientId: "client", issuer: "https://shopify.com/authentication/123", redirectUri: "https://store.test/api/reviews/auth/callback" };
const get = () => new Request("https://tasks.test/api/admin/reviews/pending-count");

describe("pending store review count", () => {
  beforeEach(() => {
    vi.stubEnv("TASKS_APP_URL", "https://tasks.test");
    vi.stubEnv("STORE_REVIEWS_CUSTOMER_AUTH_ENABLED", "true");
    vi.stubEnv("STORE_REVIEWS_SUPABASE_PROJECT_REF", "lvfaartgcpphuokoswcm");
    vi.stubEnv("STORE_REVIEWS_CUSTOMER_AUTH_SCOPE", JSON.stringify(scope));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://lvfaartgcpphuokoswcm.supabase.co");
    mocks.query.calls = []; mocks.query.result = { data: 3, error: null };
    mocks.rpc.mockImplementation(async () => mocks.query.result);
    mocks.context.mockResolvedValue({ user: { id: "owner" }, admin: { rpc: mocks.rpc } });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("counts pending revisions on this shop's unwithdrawn reviews, privately", async () => {
    const response = await GET(get());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pending: 3 });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.context).toHaveBeenCalledWith({ owner: true });
    expect(mocks.rpc).toHaveBeenCalledWith("store_pending_review_count", { p_actor: "owner", p_shop_id: "123" });
  });

  it("requires a Tasks owner and refuses an instance without the store backend", async () => {
    mocks.context.mockResolvedValueOnce({ response: NextResponse.json({ error: "Denied" }, { status: 403 }) });
    expect((await GET(get())).status).toBe(403);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://vjsnobmfsfrsnwukfaoq.supabase.co");
    expect((await GET(get())).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("reports a failure instead of a zero when the count cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.query.result = { data: null, error: { code: "P0001", message: "private detail" } };
    const failed = await GET(get());
    expect(failed.status).toBe(500);
    expect(JSON.stringify(await failed.json())).not.toContain("private detail");
    mocks.query.result = { data: null, error: null };
    expect((await GET(get())).status).toBe(500);
  });
});
