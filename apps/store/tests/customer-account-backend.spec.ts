import { expect, test } from "@playwright/test";
import { customerAuthBackendFixture } from "./fixtures/customer-auth-backend";
import { createCustomerAuthBackend, CustomerAuthBackendError } from "../lib/customer-account/backend";
import { createCustomerAccountStorage } from "../lib/customer-account/storage";
import { prepareCustomerAuthorization } from "../lib/customer-account/authorization";
import { getCustomerAccountEncryptionKeys } from "../lib/customer-account/secrets";
import { customerAccountConfig as config, customerAccountMetadata as metadata } from "./fixtures/customer-account";

const token = "t".repeat(43);
const encryption = getCustomerAccountEncryptionKeys({ STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEY_ID: "test", STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEYS: JSON.stringify({ test: Buffer.alloc(32, 7).toString("base64url") }) });
if (encryption.status !== "configured") throw new Error("Synthetic keyring unavailable");
const keyring = encryption.keyring;
const tokens = { accessToken: "private-access", refreshToken: "private-refresh", idToken: "private-id-token" };
const endpoints = { issuer: metadata.issuer, authorizationEndpoint: metadata.authorization_endpoint, tokenEndpoint: metadata.token_endpoint, logoutEndpoint: metadata.end_session_endpoint, jwksUri: metadata.jwks_uri };

function fixture() {
  const transport = customerAuthBackendFixture();
  const backend = createCustomerAuthBackend({ origin: "https://backend.test", token, fetcher: transport.fetcher });
  return { ...transport, storage: createCustomerAccountStorage({ config, keyring, backend }) };
}

test("authorization persistence sends only hashes and ciphertext, survives reload, and consumes once", async () => {
  const { storage, flows, requests } = fixture();
  const prepared = prepareCustomerAuthorization({ config, endpoints, returnTo: "/products/tee?color=blue#reviews", now: Date.now() - 1000 });
  await storage.saveAuthorization(prepared.attempt);
  const serialized = JSON.stringify(requests);
  for (const secret of [prepared.attempt.nonce, prepared.attempt.codeVerifier, prepared.cookie.value, new URL(prepared.authorizationUrl).searchParams.get("state")!]) expect(serialized).not.toContain(secret);
  const state = new URL(prepared.authorizationUrl).searchParams.get("state");
  expect(await storage.loadAuthorization(state, prepared.cookie.value)).toEqual(prepared.attempt);
  expect(await storage.loadAuthorization(state, "x".repeat(43))).toBeNull();
  expect(await Promise.all([storage.consumeAuthorization(prepared.attempt), storage.consumeAuthorization(prepared.attempt)])).toEqual([true, false]);
  expect(await storage.loadAuthorization(state, prepared.cookie.value)).toBeNull();
  await expect(storage.saveAuthorization(prepared.attempt)).rejects.toBeInstanceOf(CustomerAuthBackendError);
  expect(flows.has(prepared.attempt.stateHash)).toBe(true);
});

test("session persistence uses an opaque identifier, encrypts tokens, and handles refresh/logout conflicts", async () => {
  const { storage, sessions, requests } = fixture();
  const now = Date.now() - 1000;
  const { id, session } = await storage.createSession({ subject: "synthetic-buyer", tokens, now, expiresAt: now + 86400_000, accessExpiresAt: now + 3600_000 });
  expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(JSON.stringify(requests)).not.toContain(id);
  for (const secret of Object.values(tokens)) expect(JSON.stringify(requests)).not.toContain(secret);
  expect(await storage.loadSession(id)).toEqual(session);
  const renewed = { ...tokens, accessToken: "renewed-private-access" };
  expect(await storage.rotateSession(session, renewed, now + 7200_000)).toBe(true);
  expect(await storage.rotateSession(session, tokens, now + 7200_000)).toBe(false);
  const current = await storage.loadSession(id);
  expect(current?.revision).toBe(1);
  expect(current?.tokens).toEqual(renewed);
  expect(await storage.revokeSession(id)).toBe(true);
  expect(await storage.rotateSession(current!, tokens, now + 10800_000)).toBe(false);
  expect(await storage.loadSession(id)).toBeNull();
  expect(sessions.get(session.sessionHash)).toBeNull();
});

test("tampered, expired, moved, or unreadable records cannot become a buyer session", async () => {
  const { storage, sessions } = fixture();
  const now = Date.now() - 1000;
  const { id, session } = await storage.createSession({ subject: "buyer", tokens, now, expiresAt: now + 86400_000, accessExpiresAt: now + 3600_000 });
  const row = sessions.get(session.sessionHash)!;
  for (const extra of [{ subject: "other-buyer" }, { revision: 1 }, { expiresAt: now + 500 }, { accessExpiresAt: now + 7200_000 }]) {
    sessions.set(session.sessionHash, { ...row, ...extra });
    expect(await storage.loadSession(id)).toBeNull();
  }
  sessions.set(session.sessionHash, row);
  const otherKey = { activeKeyId: "new", keys: new Map([["new", Buffer.alloc(32, 8)]]) };
  const storageWithNewKey = createCustomerAccountStorage({ config, keyring: otherKey, backend: createCustomerAuthBackend({ origin: "https://backend.test", token, fetcher: async () => Response.json({ data: row }) }) });
  expect(await storageWithNewKey.loadSession(id)).toBeNull();
  const anotherScope = createCustomerAccountStorage({ config: { ...config, clientId: "other-client" }, keyring,
    backend: createCustomerAuthBackend({ origin: "https://backend.test", token, fetcher: async () => Response.json({ data: row }) }) });
  expect(await anotherScope.loadSession(id)).toBeNull();
});

test("invalid browser proofs never trigger storage access", async () => {
  const { storage, requests } = fixture();
  for (const proof of [null, undefined, "", "bad", "x".repeat(10000)]) {
    expect(await storage.loadAuthorization(proof, proof)).toBeNull();
    expect(await storage.loadSession(proof)).toBeNull();
    expect(await storage.revokeSession(proof)).toBe(false);
  }
  expect(requests).toEqual([]);
});

test("server continuations reread only the matching encrypted session hash", async () => {
  const { storage, requests, sessions } = fixture();
  const now = Date.now() - 1000;
  const { id, session } = await storage.createSession({ subject: "buyer", tokens, now, expiresAt: now + 86400_000, accessExpiresAt: now + 3600_000 });
  requests.length = 0;
  for (const hash of [undefined, "", id, "bad", "x".repeat(10000)]) expect(await storage.loadSessionByHash(hash)).toBeNull();
  expect(requests).toEqual([]);
  expect(await storage.loadSessionByHash(session.sessionHash)).toEqual(session);
  const row = sessions.get(session.sessionHash)!;
  sessions.set(session.sessionHash, { ...row, subject: "another-buyer" });
  expect(await storage.loadSessionByHash(session.sessionHash)).toBeNull();
  sessions.set(session.sessionHash, null);
  expect(await storage.loadSessionByHash(session.sessionHash)).toBeNull();
});

test("backend failures and malformed responses remain unavailable, with no upstream secret in errors", async () => {
  const request = { operation: "session.get", scope: { shopId: config.shopId, clientId: config.clientId, issuer: metadata.issuer, redirectUri: config.redirectUri }, sessionHash: "a".repeat(64) } as const;
  const fetchers: (typeof fetch)[] = [
    async () => new Response("private-upstream-error", { status: 500 }),
    async () => Response.json({ data: null, secret: "must-not-leak" }),
    async () => Response.json({ data: true }),
    async () => new Response("not-json"),
    async () => { throw new Error(token); },
  ];
  for (const fetcher of fetchers) {
    const backend = createCustomerAuthBackend({ origin: "https://backend.test", token, fetcher });
    await expect(backend(request)).rejects.toThrow("Customer sign-in storage is temporarily unavailable.");
  }
  const backend = createCustomerAuthBackend({ origin: "https://backend.test", token, fetcher: async () => Response.json({ data: null }) });
  expect(await backend(request)).toBeNull();
});

test("unsafe backend locations and borrowed database secrets cannot configure the transport", () => {
  for (const origin of ["http://backend.test", "https://user:pass@backend.test", "https://backend.test/other", "https://backend.test/?token=secret", "https://127.0.0.1", "https://localhost"]) {
    expect(() => createCustomerAuthBackend({ origin, token })).toThrow(CustomerAuthBackendError);
  }
  expect(() => createCustomerAuthBackend({ origin: "https://backend.test", token: "supabase-service-key" })).toThrow(CustomerAuthBackendError);
});
