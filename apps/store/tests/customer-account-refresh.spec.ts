import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import type { JWK } from "jose";
import { createCustomerAccountTokenClient, CustomerAccountRefreshRejected, CustomerAccountTokenError } from "../lib/customer-account/tokens";
import type { CustomerAccountSession } from "../lib/customer-account/storage";
import { customerAccountConfig as config, customerAccountMetadata as metadata } from "./fixtures/customer-account";

const now = Date.now();
const second = Math.floor(now / 1000);
const nonce = "n".repeat(43);
const endpoints = { issuer: metadata.issuer, authorizationEndpoint: metadata.authorization_endpoint, tokenEndpoint: metadata.token_endpoint, logoutEndpoint: metadata.end_session_endpoint, jwksUri: metadata.jwks_uri };
let keypair: Awaited<ReturnType<typeof generateKeyPair>>;
let jwk: JWK;
test.beforeAll(async () => {
  keypair = await generateKeyPair("RS256");
  jwk = { ...await exportJWK(keypair.publicKey), kid: "test", alg: "RS256", use: "sig" };
});
function sign(extra: Record<string, unknown>) {
  return new SignJWT({ iss: endpoints.issuer, sub: "synthetic-buyer", aud: config.clientId, iat: second, exp: second + 3600, ...extra })
    .setProtectedHeader({ kid: "test", alg: "RS256" }).sign(keypair.privateKey);
}
async function fixture(extra: Record<string, unknown> = {}) {
  const original = await sign({ nonce, auth_time: second - 7200, iat: second - 7200, exp: second - 3600 });
  const session: CustomerAccountSession = { sessionHash: "a".repeat(64), subject: "synthetic-buyer", revision: 0,
    createdAt: now - 7200_000, expiresAt: now + 86400_000, accessExpiresAt: now - 3600_000,
    tokens: { accessToken: "old-private-access", refreshToken: "old-private-refresh", idToken: original } };
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input); requests.push({ url, init });
    if (url === endpoints.jwksUri) return Response.json({ keys: [jwk] });
    expect(url).toBe(endpoints.tokenEndpoint);
    return Response.json({ access_token: "new-private-access", refresh_token: "new-private-refresh", token_type: "Bearer", expires_in: 3600, ...extra });
  };
  return { session, requests, client: createCustomerAccountTokenClient({ config, endpoints, fetcher }) };
}

test("refresh works without an ID token and retains the original identity after its token expiry", async () => {
  const { session, client, requests } = await fixture();
  const result = await client.refresh(session, now);
  expect(result).toEqual({ accessExpiresAt: now + 3600_000, tokens: { accessToken: "new-private-access", refreshToken: "new-private-refresh", idToken: session.tokens.idToken } });
  expect(requests).toHaveLength(1);
  const request = requests[0];
  expect(Object.fromEntries((request.init!.body as URLSearchParams).entries())).toEqual({ grant_type: "refresh_token", client_id: config.clientId, refresh_token: "old-private-refresh" });
  expect(new Headers(request.init?.headers).get("authorization")).toBe(`Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`);
  expect(request.init?.redirect).toBe("error"); expect(request.init?.cache).toBe("no-store");
});

test("a refresh can retain its refresh token when Shopify omits a replacement", async () => {
  const { client, session } = await fixture({ refresh_token: undefined });
  expect((await client.refresh(session, now)).tokens.refreshToken).toBe(session.tokens.refreshToken);
});

test("optional refreshed ID tokens are verified without requiring a new nonce", async () => {
  for (const extra of [{}, { nonce }, { nonce, auth_time: second - 7200 }]) {
    const id_token = await sign(extra);
    const { client, session, requests } = await fixture({ id_token });
    const result = await client.refresh(session, now);
    expect(result.tokens.idToken).toBe(session.tokens.idToken);
    expect(result.tokens.idToken).not.toBe(id_token);
    expect(requests.some(({ url }) => url === endpoints.jwksUri)).toBe(true);
    // The original nonce/auth_time anchor survives multiple token renewals.
    expect((await client.refresh({ ...session, tokens: result.tokens, revision: 1 }, now)).tokens.idToken).toBe(session.tokens.idToken);
  }
});

test("refresh cannot change buyer, shop, audience, nonce, authorized party, or original authentication time", async () => {
  for (const extra of [{ sub: "other-buyer" }, { iss: "https://shopify.com/authentication/999" }, { aud: "other-client" },
    { aud: [config.clientId, "extra-client"], azp: config.clientId }, { nonce: "different-nonce" }, { nonce: 123 },
    { azp: "other-client" }, { auth_time: second }, { iat: second + 100 }, { exp: second - 60 }, { sub: 123 }]) {
    const { client, session } = await fixture({ id_token: await sign(extra) });
    await expect(client.refresh(session, now)).rejects.toBeInstanceOf(CustomerAccountTokenError);
  }
});

test("refreshed ID token signatures and optional access hashes remain mandatory checks", async () => {
  const at_hash = createHash("sha256").update("new-private-access").digest().subarray(0, 16).toString("base64url");
  const valid = await sign({ at_hash });
  const good = await fixture({ id_token: valid });
  expect((await good.client.refresh(good.session, now)).tokens.accessToken).toBe("new-private-access");
  const parts = valid.split(".");
  const signature = Buffer.from(parts[2], "base64url"); signature[0] ^= 1; parts[2] = signature.toString("base64url");
  for (const extra of [{ id_token: parts.join(".") }, { id_token: valid, access_token: "substituted-token" }]) {
    const { client, session } = await fixture(extra);
    await expect(client.refresh(session, now)).rejects.toBeInstanceOf(CustomerAccountTokenError);
  }
});

test("expired or mismatched stored identity never sends the refresh token", async () => {
  const { client, session, requests } = await fixture();
  for (const extra of [{ expiresAt: now }, { subject: "other-buyer" }, { createdAt: now + 1 },
    { tokens: { ...session.tokens, idToken: "not-a-jwt" } }, { tokens: { ...session.tokens, refreshToken: "" } }]) {
    await expect(client.refresh({ ...session, ...extra }, now)).rejects.toBeInstanceOf(CustomerAccountTokenError);
  }
  expect(requests).toEqual([]);
});

test("invalid_grant is distinct from a provider, client-configuration, or malformed-response failure", async () => {
  const { session } = await fixture();
  for (const [status, body] of [[400, { error: "invalid_grant", error_description: "private-refresh-token" }],
    [401, { error: "invalid_client" }], [503, { error: "invalid_grant" }], [400, { error: "other_error" }]] as const) {
    const client = createCustomerAccountTokenClient({ config, endpoints, fetcher: async () => Response.json(body, { status }) });
    let error: unknown;
    try { await client.refresh(session, now); } catch (failure) { error = failure; }
    expect(error).toBeInstanceOf(CustomerAccountTokenError);
    expect(error instanceof CustomerAccountRefreshRejected).toBe(status === 400 && body.error === "invalid_grant");
    expect(String(error)).not.toContain("private-refresh-token");
  }
  for (const extra of [{ id_token: null }, { refresh_token: "" }, { expires_in: 0 }, { token_type: "MAC" }]) {
    const { client, session } = await fixture(extra);
    await expect(client.refresh(session, now)).rejects.toBeInstanceOf(CustomerAccountTokenError);
  }
});
