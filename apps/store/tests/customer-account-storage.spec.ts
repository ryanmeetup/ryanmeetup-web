import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prepareCustomerAuthorization } from "../lib/customer-account/authorization";
import { getCustomerAccountEncryptionKeys, openCustomerAccountSecret, sealCustomerAccountSecret } from "../lib/customer-account/secrets";
import type { CustomerAccountSecretContext } from "../lib/customer-account/secrets";
import { customerAccountConfig as config, customerAccountMetadata as metadata } from "./fixtures/customer-account";

const container = process.env.STORE_AUTH_TEST_CONTAINER ?? "";
const isolated = /^supabase_db_store-auth-test-[a-f0-9]{12}$/.test(container);
test.skip(!isolated, "Run only through Tasks' isolated store-auth database test runner.");

function sql(query: string) {
  if (!isolated) throw new Error("Refusing to touch a non-test database container");
  return execFileSync("docker", ["exec", "-i", container, "psql", "-U", "supabase_admin", "-d", "postgres", "-XqAt", "-v", "ON_ERROR_STOP=1"], {
    input: `set role service_role;\n${query}`, encoding: "utf8",
  }).trim();
}
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const iso = (value: number) => literal(new Date(value).toISOString());
const endpoints = {
  issuer: metadata.issuer, authorizationEndpoint: metadata.authorization_endpoint,
  tokenEndpoint: metadata.token_endpoint, logoutEndpoint: metadata.end_session_endpoint, jwksUri: metadata.jwks_uri,
};
const encryption = getCustomerAccountEncryptionKeys({
  STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEY_ID: "test",
  STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEYS: JSON.stringify({ test: Buffer.alloc(32, 7).toString("base64url") }),
});
if (encryption.status !== "configured") throw new Error("Synthetic storage test encryption unavailable");
const keyring = encryption.keyring;

test("an encrypted authorization survives database storage and is consumed only once", () => {
  const { attempt } = prepareCustomerAuthorization({ config, endpoints, returnTo: "/products/ryan-meetup-tee#reviews", now: Date.now() - 1000 });
  const context: CustomerAccountSecretContext = {
    kind: "authorization", recordHash: attempt.stateHash, browserBindingHash: attempt.browserBindingHash,
    shopId: attempt.shopId, clientId: attempt.clientId, issuer: attempt.issuer, redirectUri: attempt.redirectUri,
    createdAt: attempt.createdAt, expiresAt: attempt.expiresAt,
  };
  const privateFlow = JSON.stringify({ nonce: attempt.nonce, codeVerifier: attempt.codeVerifier, returnPath: attempt.returnPath });
  const envelope = sealCustomerAccountSecret(privateFlow, context, keyring);
  sql(`insert into public.store_customer_authorizations(state_hash,browser_binding_hash,shop_id,client_id,issuer,redirect_uri,encrypted_flow,created_at,expires_at)
    values(${[attempt.stateHash, attempt.browserBindingHash, attempt.shopId, attempt.clientId, attempt.issuer, attempt.redirectUri, envelope].map(literal).join(",")},${iso(attempt.createdAt)},${iso(attempt.expiresAt)});`);
  const args = [attempt.stateHash, attempt.browserBindingHash, attempt.shopId, attempt.clientId, attempt.issuer, attempt.redirectUri].map(literal).join(",");
  const row = JSON.parse(sql(`select row_to_json(a) from public.store_get_customer_authorization(${args}) a;`));
  expect(row.encrypted_flow).not.toContain(attempt.codeVerifier);
  expect(row.encrypted_flow).not.toContain(attempt.nonce);
  const storedContext = { ...context, createdAt: Date.parse(row.created_at), expiresAt: Date.parse(row.expires_at) };
  expect(openCustomerAccountSecret(row.encrypted_flow, storedContext, keyring)).toBe(privateFlow);
  expect(sql(`select public.store_consume_customer_authorization(${args});`)).toBe("t");
  expect(sql(`select public.store_consume_customer_authorization(${args});`)).toBe("f");
  expect(sql(`select encrypted_flow is null from public.store_customer_authorizations where state_hash=${literal(attempt.stateHash)};`)).toBe("t");
});

test("session refresh preserves encrypted context and revocation erases tokens", () => {
  const createdAt = Date.now() - 1000;
  const sessionHash = createHash("sha256").update(randomBytes(32)).digest("hex");
  const context: CustomerAccountSecretContext = {
    kind: "session", recordHash: sessionHash, shopId: config.shopId, clientId: config.clientId,
    issuer: endpoints.issuer, subject: "synthetic-buyer", createdAt,
    expiresAt: createdAt + 86400_000, accessExpiresAt: createdAt + 3600_000, revision: 0,
  };
  const tokens = JSON.stringify({ accessToken: "synthetic-private-access", refreshToken: "synthetic-private-refresh" });
  const envelope = sealCustomerAccountSecret(tokens, context, keyring);
  sql(`insert into public.store_customer_sessions(session_hash,shop_id,client_id,issuer,subject,encrypted_tokens,created_at,updated_at,access_expires_at,expires_at)
    values(${[sessionHash, context.shopId, context.clientId, context.issuer, context.subject, envelope].map(literal).join(",")},${iso(createdAt)},${iso(createdAt)},${iso(context.accessExpiresAt)},${iso(context.expiresAt)});`);
  const args = [sessionHash, context.shopId, context.clientId, context.issuer].map(literal).join(",");
  const first = JSON.parse(sql(`select row_to_json(s) from public.store_get_customer_session(${args}) s;`));
  expect(openCustomerAccountSecret(first.encrypted_tokens, context, keyring)).toBe(tokens);
  const nextContext = { ...context, revision: 1, accessExpiresAt: createdAt + 7200_000 };
  const renewed = JSON.stringify({ accessToken: "renewed-access", refreshToken: "renewed-refresh" });
  const nextEnvelope = sealCustomerAccountSecret(renewed, nextContext, keyring);
  expect(sql(`select public.store_rotate_customer_session(${args},0,${literal(nextEnvelope)},${iso(nextContext.accessExpiresAt)});`)).toBe("t");
  const next = JSON.parse(sql(`select row_to_json(s) from public.store_get_customer_session(${args}) s;`));
  const storedContext = { ...nextContext, createdAt: Date.parse(next.created_at), expiresAt: Date.parse(next.expires_at), accessExpiresAt: Date.parse(next.access_expires_at), revision: Number(next.revision) };
  expect(openCustomerAccountSecret(next.encrypted_tokens, storedContext, keyring)).toBe(renewed);
  expect(openCustomerAccountSecret(next.encrypted_tokens, context, keyring)).toBeNull();
  expect(sql(`select public.store_revoke_customer_session(${args});`)).toBe("t");
  expect(sql(`select count(*) from public.store_get_customer_session(${args});`)).toBe("0");
  expect(sql(`select encrypted_tokens is null from public.store_customer_sessions where session_hash=${literal(sessionHash)};`)).toBe("t");
});
