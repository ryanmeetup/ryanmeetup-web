import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import type { JWK } from "jose";
import { createCustomerAccountTokenClient } from "../lib/customer-account/tokens";
import { customerAccountConfig as config, customerAccountMetadata as metadata } from "./fixtures/customer-account";

const endpoints = { issuer: metadata.issuer, authorizationEndpoint: metadata.authorization_endpoint, tokenEndpoint: metadata.token_endpoint, logoutEndpoint: metadata.end_session_endpoint, jwksUri: metadata.jwks_uri };
const now = Date.now();
const nonce = "n".repeat(43);
const proofs = { code: "synthetic-code", codeVerifier: "v".repeat(64), nonce, now };
let keypair: Awaited<ReturnType<typeof generateKeyPair>>;
let jwk: JWK;
test.beforeAll(async () => {
  keypair = await generateKeyPair("RS256");
  jwk = { ...await exportJWK(keypair.publicKey), alg: "RS256", use: "sig", kid: "test" };
});
const claims = { iss: endpoints.issuer, sub: "synthetic-buyer", aud: config.clientId, nonce, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 3600 };
const sign = (extra: Record<string, unknown> = {}, kid = "test") => new SignJWT({ ...claims, ...extra }).setProtectedHeader({ alg: "RS256", kid }).sign(keypair.privateKey);

async function fixture(extra: Record<string, unknown> = {}, tokenOverrides: Record<string, unknown> = {}) {
  const requests: { url: string; init: RequestInit | undefined }[] = [];
  const idToken = await sign(extra);
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    if (url === endpoints.jwksUri) return Response.json({ keys: [jwk] });
    expect(url).toBe(endpoints.tokenEndpoint);
    return Response.json({ access_token: "private-access-token", refresh_token: "private-refresh-token", id_token: idToken, token_type: "Bearer", expires_in: 3600, ...tokenOverrides });
  };
  return { client: createCustomerAccountTokenClient({ config, endpoints, fetcher }), requests, idToken };
}

test("confidential code exchange uses PKCE and verifies signed identity with public JWKS", async () => {
  const { client, requests, idToken } = await fixture();
  expect(await client.exchange(proofs)).toEqual({ subject: claims.sub, accessExpiresAt: now + 3600_000,
    tokens: { accessToken: "private-access-token", refreshToken: "private-refresh-token", idToken } });
  const tokenRequest = requests.find(({ url }) => url === endpoints.tokenEndpoint)!;
  const headers = new Headers(tokenRequest.init?.headers);
  expect(headers.get("authorization")).toBe(`Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`);
  expect(headers.get("origin")).toBe("https://store.test");
  expect(tokenRequest.init?.redirect).toBe("error");
  expect(tokenRequest.init?.cache).toBe("no-store");
  const body = tokenRequest.init?.body as URLSearchParams;
  expect(Object.fromEntries(body.entries())).toEqual({ grant_type: "authorization_code", client_id: config.clientId, redirect_uri: config.redirectUri, code: proofs.code, code_verifier: proofs.codeVerifier });
  const jwksRequest = requests.find(({ url }) => url === endpoints.jwksUri)!;
  expect(new Headers(jwksRequest.init?.headers).has("authorization")).toBe(false);
  expect(jwksRequest.init?.redirect).toBe("error");
});

test("wrong issuer, audience, nonce, subject, authorized party, and expired or future claims cannot sign in", async () => {
  for (const extra of [
    { iss: "https://shopify.com/authentication/other-shop" }, { aud: "other-client" }, { nonce: "other-nonce" },
    { nonce: undefined }, { sub: "" }, { sub: undefined }, { sub: 123 }, { sub: [] }, { azp: "other-client" }, { aud: [config.clientId, "other-client"] },
    { exp: Math.floor(now / 1000) - 60 }, { exp: undefined }, { iat: Math.floor(now / 1000) + 120 },
    { iat: undefined }, { iat: Math.floor(now / 1000) - 1000 },
  ]) {
    const { client } = await fixture(extra);
    await expect(client.exchange(proofs)).rejects.toThrow("Shopify sign-in could not be verified.");
  }
});

test("a valid access-token hash is accepted and a token substituted into the response is rejected", async () => {
  const at_hash = createHash("sha256").update("private-access-token").digest().subarray(0, 16).toString("base64url");
  expect((await (await fixture({ at_hash })).client.exchange(proofs)).subject).toBe(claims.sub);
  await expect((await fixture({ at_hash }, { access_token: "substituted-token" })).client.exchange(proofs)).rejects.toThrow("Shopify sign-in could not be verified.");
});

test("unknown signing keys and altered signatures are rejected", async () => {
  const valid = await sign();
  const [header, payload, encodedSignature] = valid.split(".");
  const signature = Buffer.from(encodedSignature, "base64url");
  signature[0] ^= 1;
  for (const id_token of [await sign({}, "unknown-key"), `${header}.${payload}.${signature.toString("base64url")}`, "eyJhbGciOiJub25lIn0.e30."]) {
    await expect((await fixture({}, { id_token })).client.exchange(proofs)).rejects.toThrow("Shopify sign-in could not be verified.");
  }
});

test("malformed token responses, incorrect client types, and provider failures yield safe errors", async () => {
  for (const extra of [{ refresh_token: undefined }, { access_token: "" }, { id_token: "" }, { expires_in: 0 }, { expires_in: "3600" }, { token_type: "mac" }]) {
    await expect((await fixture({}, extra)).client.exchange(proofs)).rejects.toThrow("Shopify sign-in could not be verified.");
  }
  const client = createCustomerAccountTokenClient({ config, endpoints, fetcher: async () => new Response(`error containing ${config.clientSecret}`, { status: 401 }) });
  await expect(client.exchange(proofs)).rejects.toThrow("Shopify sign-in could not be verified. Please try again.");
});

test("invalid endpoint scope or malformed verifier never sends a secret", async () => {
  expect(() => createCustomerAccountTokenClient({ config, endpoints: { ...endpoints, issuer: "https://shopify.com/authentication/999" } })).toThrow();
  expect(() => createCustomerAccountTokenClient({ config, endpoints: { ...endpoints, tokenEndpoint: "http://unsafe.test/token" } })).toThrow();
  let called = false;
  const client = createCustomerAccountTokenClient({ config, endpoints, fetcher: async () => { called = true; throw new Error("Must not run"); } });
  await expect(client.exchange({ ...proofs, codeVerifier: "invalid" })).rejects.toThrow("Shopify sign-in could not be verified.");
  expect(called).toBe(false);
});
