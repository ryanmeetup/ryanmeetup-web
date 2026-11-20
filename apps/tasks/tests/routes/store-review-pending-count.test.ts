import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ context: vi.fn(), from: vi.fn(), query: { calls: [] as unknown[][], result: {} as unknown } }));
vi.mock("@/lib/server/privileged-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server/privileged-api")>(), privilegedContext: mocks.context,
}));
import { GET } from "@/app/api/admin/reviews/pending-count/route";

const scope = { shopId: "123", clientId: "client", issuer: "https://shopify.com/authentication/123", redirectUri: "https://store.test/api/reviews/auth/callback" };
const get = () => new Request("https://tasks.test/api/admin/reviews/pending-count");

// Records the PostgREST chain and resolves to the configured result.
function builder() {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq"]) chain[method] = (...args: unknown[]) => { mocks.query.calls.push([method, ...args]); return chain; };
  chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(mocks.query.result).then(resolve, reject);
  return chain;
}

describe("pending store review count", () => {
  beforeEach(() => {
    vi.stubEnv("TASKS_APP_URL", "https://tasks.test");
    vi.stubEnv("STORE_REVIEWS_CUSTOMER_AUTH_ENABLED", "true");
    vi.stubEnv("STORE_REVIEWS_SUPABASE_PROJECT_REF", "lvfaartgcpphuokoswcm");
    vi.stubEnv("STORE_REVIEWS_CUSTOMER_AUTH_SCOPE", JSON.stringify(scope));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://lvfaartgcpphuokoswcm.supabase.co");
    mocks.query.calls = []; mocks.query.result = { count: 3, error: null };
    mocks.from.mockImplementation(() => builder());
    mocks.context.mockResolvedValue({ user: { id: "owner" }, admin: { from: mocks.from } });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("counts pending revisions on this shop's unwithdrawn reviews, privately", async () => {
    const response = await GET(get());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pending: 3 });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.context).toHaveBeenCalledWith({ owner: true });
    expect(mocks.from).toHaveBeenCalledWith("store_review_revisions");
    expect(mocks.query.calls).toEqual([
      ["select", "id, review:store_reviews!store_review_revisions_review_id_fkey!inner(id)", { count: "exact", head: true }],
      ["eq", "status", "pending"], ["eq", "review.shop_id", "123"], ["neq", "review.state", "withdrawn"],
    ]);
  });

  it("requires a Tasks owner and refuses an instance without the store backend", async () => {
    mocks.context.mockResolvedValueOnce({ response: NextResponse.json({ error: "Denied" }, { status: 403 }) });
    expect((await GET(get())).status).toBe(403);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://vjsnobmfsfrsnwukfaoq.supabase.co");
    expect((await GET(get())).status).toBe(503);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("reports a failure instead of a zero when the count cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.query.result = { count: null, error: { code: "P0001", message: "private detail" } };
    const failed = await GET(get());
    expect(failed.status).toBe(500);
    expect(JSON.stringify(await failed.json())).not.toContain("private detail");
    mocks.query.result = { count: null, error: null };
    expect((await GET(get())).status).toBe(500);
  });
});
