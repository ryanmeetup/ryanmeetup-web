import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { customerAuthorizationProofHash } from "../lib/customer-account/authorization";
import { createCustomerSessionLoader } from "../lib/customer-account/session";
import { CustomerAccountRefreshRejected, CustomerAccountTokenError } from "../lib/customer-account/tokens";
import type { CustomerAccountSession, CustomerAccountStorage } from "../lib/customer-account/storage";
import type { CustomerAccountTokenClient } from "../lib/customer-account/tokens";
import { customerAccountConfig as config } from "./fixtures/customer-account";

const scope = { shopId: config.shopId, clientId: config.clientId, issuer: `https://shopify.com/authentication/${config.shopId}`, redirectUri: config.redirectUri };
const tokens = { accessToken: "old-access", refreshToken: "old-refresh", idToken: "original-identity-anchor" };
const nextTokens = { ...tokens, accessToken: "new-access", refreshToken: "new-refresh" };
const now = Date.now();
function fixture(accessExpiresAt = now - 1000) {
  const id = randomBytes(32).toString("base64url");
  let row: CustomerAccountSession | null = { sessionHash: customerAuthorizationProofHash(id)!, subject: "synthetic-buyer", revision: 0,
    createdAt: now - 7200_000, expiresAt: now + 86400_000, accessExpiresAt, tokens };
  let reads = 0; let rotations = 0; let refreshes = 0;
  const storage: Pick<CustomerAccountStorage, "loadSession" | "rotateSession"> = {
    async loadSession() { reads += 1; return row ? structuredClone(row) : null; },
    async rotateSession(previous, renewed, expiry) {
      rotations += 1;
      if (!row || row.revision !== previous.revision) return false;
      row = { ...row, revision: row.revision + 1, tokens: renewed, accessExpiresAt: expiry };
      return true;
    },
  };
  const refresh: CustomerAccountTokenClient["refresh"] = async () => { refreshes += 1; return { tokens: nextTokens, accessExpiresAt: now + 3600_000 }; };
  return { id, storage, refresh, load: createCustomerSessionLoader({ scope, backendOrigin: "https://backend.test", storage, refresh, now: () => now }),
    get row() { return row; }, set row(value) { row = value; }, get counts() { return { reads, rotations, refreshes }; } };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test("healthy sessions are read from storage each time and never request token renewal", async () => {
  const state = fixture(now + 3600_000);
  expect(await state.load(state.id)).toEqual({ status: "authenticated", session: state.row });
  state.row = null;
  expect(await state.load(state.id)).toEqual({ status: "sign_in_required" });
  expect(state.counts).toEqual({ reads: 2, rotations: 0, refreshes: 0 });
});

test("missing/expired/future sessions and malformed browser identifiers cannot trigger renewal", async () => {
  const state = fixture();
  for (const id of [undefined, null, "", "invalid", "x".repeat(10000)]) expect(await state.load(id)).toEqual({ status: "sign_in_required" });
  expect(state.counts.reads).toBe(0);
  state.row = { ...state.row!, expiresAt: now };
  expect(await state.load(state.id)).toEqual({ status: "sign_in_required" });
  state.row = { ...state.row!, expiresAt: now + 100000, createdAt: now + 1 };
  expect(await state.load(state.id)).toEqual({ status: "sign_in_required" });
  expect(state.counts.refreshes).toBe(0);
});

test("renewal preserves subject and absolute expiry, and returns only the reread committed revision", async () => {
  const state = fixture(now + 15000);
  const before = structuredClone(state.row!);
  const result = await state.load(state.id);
  expect(result).toEqual({ status: "authenticated", session: { ...before, revision: 1, accessExpiresAt: now + 3600_000, tokens: nextTokens } });
  expect(state.counts).toEqual({ reads: 3, rotations: 1, refreshes: 1 });
  expect(state.row?.subject).toBe(before.subject);
  expect(state.row?.expiresAt).toBe(before.expiresAt);
});

test("same-process callers share one pending refresh across independently composed loaders", async () => {
  const state = fixture();
  const entered = deferred(); const released = deferred();
  let refreshes = 0;
  const refresh: CustomerAccountTokenClient["refresh"] = async () => { refreshes += 1; entered.resolve(); await released.promise; return { tokens: nextTokens, accessExpiresAt: now + 3600_000 }; };
  const options = { scope, backendOrigin: "https://backend.test", storage: state.storage, refresh, now: () => now };
  const first = createCustomerSessionLoader(options)(state.id);
  await entered.promise;
  const second = createCustomerSessionLoader(options)(state.id);
  // Let the second initial read join the pending operation.
  await Promise.resolve();
  released.resolve();
  const results = await Promise.all([first, second]);
  expect(results[0]).toEqual(results[1]);
  expect(results[0].status).toBe("authenticated");
  expect(refreshes).toBe(1);
  expect(state.counts.rotations).toBe(1);
});

test("a winner between the initial read and refresh recheck avoids another provider exchange", async () => {
  const state = fixture();
  const read = state.storage.loadSession;
  let reads = 0;
  state.storage.loadSession = async (id) => {
    reads += 1;
    if (reads === 2) state.row = { ...state.row!, revision: 1, accessExpiresAt: now + 3600_000, tokens: nextTokens };
    return read(id);
  };
  expect(await state.load(state.id)).toEqual({ status: "authenticated", session: state.row });
  expect(state.counts.refreshes).toBe(0);
  expect(state.counts.rotations).toBe(0);
});

test("pending work is isolated by backend and client scope", async () => {
  const state = fixture();
  const entered = deferred(); const released = deferred();
  let refreshes = 0;
  const refresh: CustomerAccountTokenClient["refresh"] = async () => { refreshes += 1; if (refreshes === 3) entered.resolve(); await released.promise; return { tokens: nextTokens, accessExpiresAt: now + 3600_000 }; };
  const options = { scope, backendOrigin: "https://backend.test", storage: state.storage, refresh, now: () => now };
  const pending = [createCustomerSessionLoader(options)(state.id),
    createCustomerSessionLoader({ ...options, backendOrigin: "https://another-backend.test" })(state.id),
    createCustomerSessionLoader({ ...options, scope: { ...scope, clientId: "another-client" } })(state.id)];
  await entered.promise;
  released.resolve();
  await Promise.all(pending);
  expect(refreshes).toBe(3);
});

test("logout during refresh keeps the session missing and discards the newly issued tokens", async () => {
  const state = fixture();
  const refresh: CustomerAccountTokenClient["refresh"] = async () => { state.row = null; return { tokens: nextTokens, accessExpiresAt: now + 3600_000 }; };
  const load = createCustomerSessionLoader({ scope, backendOrigin: "https://backend.test", storage: state.storage, refresh, now: () => now });
  expect(await load(state.id)).toEqual({ status: "sign_in_required" });
  expect(state.row).toBeNull();
});

test("a cross-process CAS winner is authoritative and a losing refresh result is never returned", async () => {
  const state = fixture();
  const winningTokens = { ...tokens, accessToken: "committed-winner-access", refreshToken: "committed-winner-refresh" };
  const refresh: CustomerAccountTokenClient["refresh"] = async () => {
    state.row = { ...state.row!, revision: 1, tokens: winningTokens, accessExpiresAt: now + 7200_000 };
    return { tokens: nextTokens, accessExpiresAt: now + 3600_000 };
  };
  const load = createCustomerSessionLoader({ scope, backendOrigin: "https://backend.test", storage: state.storage, refresh, now: () => now });
  const result = await load(state.id);
  expect(result).toEqual({ status: "authenticated", session: state.row });
  expect(JSON.stringify(result)).not.toContain("new-access");
  expect(state.counts.rotations).toBe(1);
});

test("a competing refresh can win despite this request receiving invalid_grant or a timeout", async () => {
  for (const failure of [new CustomerAccountRefreshRejected(), new CustomerAccountTokenError()]) {
    const state = fixture();
    const refresh: CustomerAccountTokenClient["refresh"] = async () => {
      state.row = { ...state.row!, revision: 1, tokens: nextTokens, accessExpiresAt: now + 3600_000 };
      throw failure;
    };
    const load = createCustomerSessionLoader({ scope, backendOrigin: "https://backend.test", storage: state.storage, refresh, now: () => now });
    expect(await load(state.id)).toEqual({ status: "authenticated", session: state.row });
  }
});

test("provider rejection needs sign-in; provider/storage failures stay unavailable without retrying old tokens", async () => {
  for (const failure of [new CustomerAccountRefreshRejected(), new CustomerAccountTokenError(), new Error("private-storage-failure")]) {
    const state = fixture(); let calls = 0;
    const load = createCustomerSessionLoader({ scope, backendOrigin: "https://backend.test", storage: state.storage,
      refresh: async () => { calls += 1; throw failure; }, now: () => now });
    const expected = failure instanceof CustomerAccountRefreshRejected ? "sign_in_required" : "unavailable";
    expect(await load(state.id)).toEqual({ status: expected });
    expect(calls).toBe(1);
    expect(state.counts.rotations).toBe(0);
    expect(state.row?.tokens).toEqual(tokens);
  }
  const state = fixture();
  state.storage.loadSession = async () => { throw new Error("private-backend-response"); };
  expect(await state.load(state.id)).toEqual({ status: "unavailable" });
});

test("failed refresh work is evicted and a later request can recover", async () => {
  const state = fixture(); let calls = 0;
  const load = createCustomerSessionLoader({ scope, backendOrigin: "https://backend.test", storage: state.storage,
    refresh: async () => { calls += 1; if (calls === 1) throw new CustomerAccountTokenError(); return { tokens: nextTokens, accessExpiresAt: now + 3600_000 }; }, now: () => now });
  expect(await load(state.id)).toEqual({ status: "unavailable" });
  expect((await load(state.id)).status).toBe("authenticated");
  expect(calls).toBe(2);
});

test("an uncertain persistence response is resolved from storage without exchanging tokens again", async () => {
  const state = fixture();
  const rotate = state.storage.rotateSession;
  state.storage.rotateSession = async (...args) => { await rotate(...args); throw new Error("write response was lost"); };
  expect(await state.load(state.id)).toEqual({ status: "authenticated", session: state.row });
  expect(state.counts.refreshes).toBe(1);
});

test("a lost CAS without a usable winner cannot authenticate an expired session", async () => {
  const state = fixture();
  state.storage.rotateSession = async () => false;
  expect(await state.load(state.id)).toEqual({ status: "unavailable" });
  expect(state.row?.revision).toBe(0);
  expect(state.counts.refreshes).toBe(1);
});

test("absolute expiry during the provider exchange prevents persistence or authentication", async () => {
  const state = fixture();
  state.row = { ...state.row!, expiresAt: now + 1000 };
  let clock = now;
  const load = createCustomerSessionLoader({ scope, backendOrigin: "https://backend.test", storage: state.storage,
    now: () => clock, refresh: async () => { clock += 2000; return { tokens: nextTokens, accessExpiresAt: now + 3600_000 }; } });
  expect(await load(state.id)).toEqual({ status: "sign_in_required" });
  expect(state.counts.rotations).toBe(0);
});

test("identity/absolute-expiry changes and unusable refreshes fail closed", async () => {
  for (const change of [{ subject: "other-buyer" }, { expiresAt: now + 200000 }, { createdAt: now - 1000 }]) {
    const state = fixture();
    const refresh: CustomerAccountTokenClient["refresh"] = async () => {
      state.row = { ...state.row!, ...change, revision: 1, accessExpiresAt: now + 3600_000 };
      return { tokens: nextTokens, accessExpiresAt: now + 3600_000 };
    };
    const load = createCustomerSessionLoader({ scope, backendOrigin: "https://backend.test", storage: state.storage, refresh, now: () => now });
    expect(await load(state.id)).toEqual({ status: "unavailable" });
  }
  const state = fixture();
  const load = createCustomerSessionLoader({ scope, backendOrigin: "https://backend.test", storage: state.storage,
    refresh: async () => ({ tokens: nextTokens, accessExpiresAt: now }), now: () => now });
  expect(await load(state.id)).toEqual({ status: "unavailable" });
  expect(state.counts.rotations).toBe(0);
});
