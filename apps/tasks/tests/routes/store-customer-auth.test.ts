import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), from: vi.fn(), insert: vi.fn(), rpc: vi.fn(), select: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/server/admin-client", () => ({ getAdminClient: mocks.admin }));
import { POST } from "@/app/api/store/customer-auth/route";

const token = "t".repeat(43);
const scope = { shopId: "123456", clientId: "test-client", issuer: "https://shopify.com/authentication/123456", redirectUri: "https://store.test/api/reviews/auth/callback" };
const hash = "a".repeat(64);
const binding = "b".repeat(64);
const envelope = `v1.test.${"a".repeat(16)}.${"b".repeat(48)}.${"c".repeat(22)}`;
const createdAt = Date.parse("2026-11-17T12:00:00.123Z");
const authorization = { stateHash: hash, browserBindingHash: binding, encryptedFlow: envelope, createdAt, expiresAt: createdAt + 600_000 };
const session = { sessionHash: hash, subject: "synthetic-buyer", encryptedTokens: envelope, createdAt, expiresAt: createdAt + 86400_000, accessExpiresAt: createdAt + 3600_000 };
const getCommand = { operation: "authorization.get", scope, stateHash: hash, browserBindingHash: binding };
function request(command: unknown = getCommand, headers: HeadersInit = {}) {
  return new Request("https://tasks.test/api/store/customer-auth", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...headers }, body: JSON.stringify(command) });
}

describe("store customer authentication backend", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(createdAt + 1000);
    vi.stubEnv("STORE_REVIEWS_CUSTOMER_AUTH_ENABLED", "true");
    vi.stubEnv("STORE_REVIEWS_SUPABASE_PROJECT_REF", "lvfaartgcpphuokoswcm");
    vi.stubEnv("STORE_REVIEWS_CUSTOMER_AUTH_SCOPE", JSON.stringify(scope));
    vi.stubEnv("STORE_REVIEWS_SERVICE_TOKEN_SHA256", createHash("sha256").update(token).digest("hex"));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://lvfaartgcpphuokoswcm.supabase.co");
    mocks.admin.mockReturnValue({ from: mocks.from, rpc: mocks.rpc });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockResolvedValue({ data: null, error: null });
    mocks.rpc.mockReturnValue({ select: mocks.select, data: true, error: null });
    mocks.select.mockReturnValue({ maybeSingle: mocks.single });
    mocks.single.mockResolvedValue({ data: null, error: null });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("requires explicit configuration and refuses the personal database before creating an admin client", async () => {
    for (const [key, value] of [
      ["STORE_REVIEWS_CUSTOMER_AUTH_ENABLED", "false"], ["STORE_REVIEWS_CUSTOMER_AUTH_SCOPE", "{}"],
      ["STORE_REVIEWS_SERVICE_TOKEN_SHA256", "bad-hash"], ["NEXT_PUBLIC_SUPABASE_URL", "https://vjsnobmfsfrsnwukfaoq.supabase.co"],
    ]) {
      const previous = process.env[key];
      vi.stubEnv(key, value);
      expect((await POST(request())).status).toBe(503);
      vi.stubEnv(key, previous);
    }
    expect(mocks.admin).not.toHaveBeenCalled();
    vi.stubEnv("STORE_REVIEWS_SUPABASE_PROJECT_REF", "vjsnobmfsfrsnwukfaoq");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://vjsnobmfsfrsnwukfaoq.supabase.co");
    expect((await POST(request())).status).toBe(503);
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("rejects missing/incorrect service credentials and browser requests before database access", async () => {
    for (const authorization of ["", `Bearer ${"x".repeat(43)}`, "Bearer malformed", `Basic ${token}`]) {
      const response = await POST(request(getCommand, { authorization }));
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("www-authenticate")).toContain("Bearer");
    }
    const browserHeaders: HeadersInit[] = [{ origin: "https://store.test" }, { origin: "null" }, { "sec-fetch-site": "same-origin" }];
    for (const headers of browserHeaders) {
      expect((await POST(request(getCommand, headers))).status).toBe(403);
    }
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects cross-shop/client/callback commands, arbitrary operations, and unknown keys", async () => {
    for (const extra of [{ shopId: "999", issuer: "https://shopify.com/authentication/999" }, { clientId: "other-client" }, { redirectUri: "https://preview.test/api/reviews/auth/callback" }]) {
      expect((await POST(request({ ...getCommand, scope: { ...scope, ...extra } }))).status).toBe(403);
    }
    for (const command of [{ ...getCommand, operation: "tasks.read" }, { ...getCommand, table: "profiles" }, { ...getCommand, stateHash: "not-a-hash" }, { ...getCommand, scope: { ...scope, admin: true } }]) {
      expect((await POST(request(command))).status).toBe(400);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("validates media type and actual UTF-8 size, and never treats bad JSON as a command", async () => {
    expect((await POST(request(getCommand, { "content-type": "text/plain" }))).status).toBe(415);
    expect((await POST(request({ ...getCommand, padding: "é".repeat(50_000) }))).status).toBe(413);
    const invalid = new Request("https://tasks.test/api/store/customer-auth", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{" });
    expect((await POST(invalid)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("creates encrypted records with pinned identity, exact timestamps, and initial revision only", async () => {
    for (const [operation, record] of [["authorization.create", authorization], ["session.create", session]]) {
      expect((await POST(request({ operation, scope, record }))).status).toBe(200);
    }
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["store_customer_authorizations", "store_customer_sessions"]);
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({ shop_id: scope.shopId, client_id: scope.clientId, issuer: scope.issuer, redirect_uri: scope.redirectUri,
      state_hash: hash, browser_binding_hash: binding, encrypted_flow: envelope, created_at: new Date(createdAt).toISOString(), expires_at: new Date(authorization.expiresAt).toISOString() });
    expect(mocks.insert.mock.calls[1][0]).toMatchObject({ revision: 0, subject: session.subject, encrypted_tokens: envelope });
    expect((await POST(request({ operation: "session.create", scope, record: { ...session, revision: 42 } }))).status).toBe(400);
  });

  it("rejects expired, future, plaintext, and oversized-lifetime records before insertion", async () => {
    for (const record of [
      { ...authorization, createdAt: createdAt + 7000, expiresAt: createdAt + 607000 },
      { ...authorization, createdAt: createdAt - 600000, expiresAt: createdAt },
      { ...authorization, encryptedFlow: "plain-code-verifier" },
    ]) expect((await POST(request({ operation: "authorization.create", scope, record }))).status).toBe(400);
    expect((await POST(request({ operation: "session.create", scope, record: { ...session, expiresAt: createdAt + 31 * 86400_000 } }))).status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns only the encrypted authorization contract, distinguishing missing records", async () => {
    mocks.single.mockResolvedValueOnce({ error: null, data: { state_hash: hash, browser_binding_hash: binding, encrypted_flow: envelope,
      created_at: new Date(createdAt).toISOString(), expires_at: new Date(authorization.expiresAt).toISOString(), unexpected_private_field: "must-not-leak" } });
    const response = await POST(request());
    expect(await response.json()).toEqual({ data: authorization });
    expect(mocks.rpc).toHaveBeenCalledWith("store_get_customer_authorization", {
      p_shop_id: scope.shopId, p_client_id: scope.clientId, p_issuer: scope.issuer, p_redirect_uri: scope.redirectUri,
      p_state_hash: hash, p_browser_binding_hash: binding,
    });
    expect(await (await POST(request())).json()).toEqual({ data: null });
  });

  it("returns session context needed for decryption while excluding backend metadata", async () => {
    mocks.single.mockResolvedValue({ error: null, data: { session_hash: hash, subject: session.subject, encrypted_tokens: envelope,
      created_at: new Date(createdAt).toISOString(), expires_at: new Date(session.expiresAt).toISOString(),
      access_expires_at: new Date(session.accessExpiresAt).toISOString(), revision: 3, shop_id: "must-not-leak" } });
    expect(await (await POST(request({ operation: "session.get", scope, sessionHash: hash }))).json()).toEqual({ data: { ...session, revision: 3 } });
  });

  it("uses the atomic consume/revoke/rotation RPCs and preserves lost-race results", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    for (const command of [
      { operation: "authorization.consume", scope, stateHash: hash, browserBindingHash: binding },
      { operation: "session.revoke", scope, sessionHash: hash },
      { operation: "session.rotate", scope, sessionHash: hash, expectedRevision: 4, encryptedTokens: envelope, accessExpiresAt: session.accessExpiresAt },
    ]) expect(await (await POST(request(command))).json()).toEqual({ data: false });
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["store_consume_customer_authorization", "store_revoke_customer_session", "store_rotate_customer_session"]);
    expect(mocks.rpc.mock.calls[2][1]).toMatchObject({ p_expected_revision: 4, p_encrypted_tokens: envelope, p_access_expires_at: new Date(session.accessExpiresAt).toISOString() });
  });

  it("propagates database errors safely and does not turn storage outages into missing sessions", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.single.mockResolvedValue({ data: null, error: { code: "42P01", message: "private-row-secret", details: token } });
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.text();
    expect(body).not.toContain("private-row-secret");
    expect(body).not.toContain(token);
    expect(JSON.stringify(logger.mock.calls)).not.toContain(token);
    expect(JSON.stringify(logger.mock.calls)).not.toContain("private-row-secret");
    mocks.insert.mockResolvedValue({ error: { code: "23505" }, data: null });
    expect((await POST(request({ operation: "authorization.create", scope, record: authorization }))).status).toBe(409);
  });
});
