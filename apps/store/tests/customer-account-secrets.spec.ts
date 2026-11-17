import { expect, test } from "@playwright/test";
import { getCustomerAccountEncryptionKeys, openCustomerAccountSecret, sealCustomerAccountSecret } from "../lib/customer-account/secrets";
import type { CustomerAccountEncryptionKeys, CustomerAccountSecretContext } from "../lib/customer-account/secrets";

const current = Buffer.alloc(32, 1).toString("base64url");
const previous = Buffer.alloc(32, 2).toString("base64url");
const env = { STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEY_ID: "current", STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEYS: JSON.stringify({ current, previous }) };

function keys(overrides: Record<string, string> = {}): CustomerAccountEncryptionKeys {
  const result = getCustomerAccountEncryptionKeys({ ...env, ...overrides });
  if (result.status !== "configured") throw new Error("Synthetic test keys unavailable");
  return result.keyring;
}

const createdAt = Date.parse("2026-11-17T15:00:00Z");
const session: CustomerAccountSecretContext = {
  kind: "session", recordHash: "a".repeat(64), shopId: "123", clientId: "client",
  issuer: "https://shopify.com/authentication/123", subject: "buyer-subject",
  createdAt, expiresAt: createdAt + 86400_000, accessExpiresAt: createdAt + 3600_000, revision: 0,
};
const authorization: CustomerAccountSecretContext = {
  kind: "authorization", recordHash: "b".repeat(64), browserBindingHash: "c".repeat(64),
  shopId: "123", clientId: "client", issuer: "https://shopify.com/authentication/123",
  createdAt, expiresAt: createdAt + 600_000, redirectUri: "https://store.test/api/reviews/auth/callback",
};
const plaintext = JSON.stringify({ accessToken: "private-access-token", refreshToken: "private-refresh-token", name: "Ryan ☀" });

test("key configuration has no borrowed credentials or implicit development key", () => {
  expect(getCustomerAccountEncryptionKeys({ SUPABASE_SECRET_KEY: "private-admin-key" })).toEqual({ status: "unavailable" });
  for (const encoded of ["{", "{}", "null", "[]", JSON.stringify({ current: "short" }), JSON.stringify({ "bad.key": current }), JSON.stringify({ current: `${current}=` })]) {
    const result = getCustomerAccountEncryptionKeys({ ...env, STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEYS: encoded });
    expect(result).toEqual({ status: "unavailable" });
    expect(JSON.stringify(result)).not.toContain(current);
  }
  expect(getCustomerAccountEncryptionKeys({ ...env, STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEY_ID: "missing" })).toEqual({ status: "unavailable" });
});

test("envelopes hide token values, use fresh IVs, and round-trip Unicode", () => {
  const first = sealCustomerAccountSecret(plaintext, session, keys());
  const second = sealCustomerAccountSecret(plaintext, session, keys());
  expect(first).toMatch(/^v1\.current\./);
  expect(first).not.toBe(second);
  expect(first).not.toContain("private-access-token");
  expect(first).not.toContain("private-refresh-token");
  expect(openCustomerAccountSecret(first, session, keys())).toBe(plaintext);
  expect(openCustomerAccountSecret(second, session, keys())).toBe(plaintext);
});

test("sessions cannot be moved across buyers, shops, clients, rows, revisions, or expiry", () => {
  const sealed = sealCustomerAccountSecret(plaintext, session, keys());
  for (const extra of [
    { subject: "another-buyer" }, { shopId: "999", issuer: "https://shopify.com/authentication/999" },
    { clientId: "another-client" }, { recordHash: "d".repeat(64) }, { revision: 1 },
    { expiresAt: session.expiresAt + 1 }, { accessExpiresAt: session.accessExpiresAt + 1 },
  ]) expect(openCustomerAccountSecret(sealed, { ...session, ...extra }, keys())).toBeNull();
  expect(openCustomerAccountSecret(sealed, authorization, keys())).toBeNull();
});

test("authorization envelopes are bound to the initiating browser and callback", () => {
  const sealed = sealCustomerAccountSecret("private-verifier-and-nonce", authorization, keys());
  expect(openCustomerAccountSecret(sealed, authorization, keys())).toBe("private-verifier-and-nonce");
  expect(openCustomerAccountSecret(sealed, { ...authorization, browserBindingHash: "d".repeat(64) }, keys())).toBeNull();
  expect(openCustomerAccountSecret(sealed, { ...authorization, redirectUri: "https://preview.test/api/reviews/auth/callback" }, keys())).toBeNull();
  expect(openCustomerAccountSecret(sealed, session, keys())).toBeNull();
});

test("ciphertext, IV, tag, version, and envelope tampering fail closed", () => {
  const sealed = sealCustomerAccountSecret(plaintext, session, keys());
  for (const index of [2, 3, 4]) {
    const parts = sealed.split(".");
    const bytes = Buffer.from(parts[index], "base64url");
    bytes[0] ^= 1;
    parts[index] = bytes.toString("base64url");
    expect(openCustomerAccountSecret(parts.join("."), session, keys())).toBeNull();
  }
  for (const malformed of ["", sealed.replace(/^v1/, "v2"), `${sealed}.extra`, sealed.slice(0, -5), sealed.replace(".current.", ".missing."), "a".repeat(65537)]) {
    expect(openCustomerAccountSecret(malformed, session, keys())).toBeNull();
  }
});

test("key rotation reads retained keys and refuses retired keys", () => {
  const old = sealCustomerAccountSecret(plaintext, session, keys({ STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEY_ID: "previous" }));
  expect(openCustomerAccountSecret(old, session, keys())).toBe(plaintext);
  const retired = keys({ STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEYS: JSON.stringify({ current }) });
  expect(openCustomerAccountSecret(old, session, retired)).toBeNull();
  expect(openCustomerAccountSecret(sealCustomerAccountSecret(plaintext, session, retired), session, retired)).toBe(plaintext);
});

test("oversized or invalid secret contexts cannot be sealed and errors reveal no payload", () => {
  for (const body of ["", "a".repeat(32769), "☀".repeat(16384)]) {
    expect(() => sealCustomerAccountSecret(body, session, keys())).toThrow("Customer account secrets could not be sealed.");
  }
  expect(() => sealCustomerAccountSecret(plaintext, { ...session, recordHash: "invalid" }, keys())).toThrow("Customer account secrets could not be sealed.");
  expect(() => sealCustomerAccountSecret(plaintext, { ...authorization, expiresAt: authorization.expiresAt + 1 }, keys())).toThrow("Customer account secrets could not be sealed.");
});
