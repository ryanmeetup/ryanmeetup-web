import { expect, test } from "@playwright/test";
import { customerAuthorizationChallenge, customerAuthorizationCookie, customerAuthorizationLifetime, customerAuthorizationProofHash, prepareCustomerAuthorization, reviewReturnPath, validateCustomerAuthorizationCallback } from "../lib/customer-account/authorization";
import { customerAccountConfig as config, customerAccountMetadata as metadata } from "./fixtures/customer-account";

const endpoints = {
  issuer: metadata.issuer,
  authorizationEndpoint: metadata.authorization_endpoint,
  tokenEndpoint: metadata.token_endpoint,
  logoutEndpoint: metadata.end_session_endpoint,
  jwksUri: metadata.jwks_uri,
};
const now = Date.parse("2026-11-17T15:00:00Z");
const returnTo = "/products/name-tag-shirt?design=ryans-dad-name-tag-shirt&color=white#reviews";

function flow() {
  const prepared = prepareCustomerAuthorization({ config, endpoints, returnTo, now });
  const url = new URL(config.redirectUri);
  url.searchParams.set("state", new URL(prepared.authorizationUrl).searchParams.get("state")!);
  url.searchParams.set("code", "test-authorization-code");
  return { config, endpoints, attempt: prepared.attempt, callbackUrl: url.href, browserBinding: prepared.cookie.value, now: now + 1000 };
}

test("authorization preserves a product's design, color and anchor without permitting external redirects", () => {
  expect(reviewReturnPath(returnTo)).toBe(returnTo);
  expect(reviewReturnPath("/reviews/mine")).toBe("/reviews/mine");
  expect(reviewReturnPath("/products/ryan-shirt/")).toBe("/products/ryan-shirt/");
  for (const unsafe of [undefined, null, "https://other.test", "//other.test", "/\\other.test", "/products/a\nLocation: bad", "/api/reviews", "/products/../api", "/products/%2f%2fevil.test", "/products/%252f%252fevil.test", "/products/%5cevil", "/products/%00", "/products/%ZZ", " ", `/${"a".repeat(2048)}`]) {
    expect(reviewReturnPath(unsafe)).toBe("/");
  }
});

test("S256 matches the RFC 7636 challenge and browser proofs are bounded", () => {
  expect(customerAuthorizationChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  for (const invalid of [undefined, null, "", "short", "!".repeat(43), "a".repeat(100_000)]) expect(customerAuthorizationProofHash(invalid)).toBeNull();
});

test("each request has independent state, nonce, verifier, and an opaque secure cookie", () => {
  const first = prepareCustomerAuthorization({ config, endpoints, returnTo, now });
  const second = prepareCustomerAuthorization({ config, endpoints, returnTo, now });
  const url = new URL(first.authorizationUrl);
  expect(url.origin + url.pathname).toBe(endpoints.authorizationEndpoint);
  expect(url.searchParams.get("scope")).toBe("openid email customer-account-api:full");
  expect(url.searchParams.get("client_id")).toBe(config.clientId);
  expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);
  expect(url.searchParams.get("response_type")).toBe("code");
  expect(url.searchParams.get("nonce")).toBe(first.attempt.nonce);
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("code_challenge")).toBe(customerAuthorizationChallenge(first.attempt.codeVerifier));
  expect(customerAuthorizationProofHash(url.searchParams.get("state"))).toBe(first.attempt.stateHash);
  expect(customerAuthorizationProofHash(first.cookie.value)).toBe(first.attempt.browserBindingHash);
  expect(first.cookie).toMatchObject({ name: customerAuthorizationCookie, httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  expect(first.attempt.expiresAt).toBe(now + customerAuthorizationLifetime * 1000);
  expect(first.attempt.returnPath).toBe(returnTo);
  expect(first.cookie.value).not.toBe(second.cookie.value);
  for (const key of ["stateHash", "browserBindingHash", "nonce", "codeVerifier"] as const) expect(first.attempt[key]).not.toBe(second.attempt[key]);
  expect(JSON.stringify(first.cookie)).not.toContain(first.attempt.codeVerifier);
  expect(first.authorizationUrl).not.toContain(first.attempt.codeVerifier);
  expect(JSON.stringify(first)).not.toContain(config.clientSecret);
});

test("a correct callback yields only a code to exchange, not an authenticated session", () => {
  expect(validateCustomerAuthorizationCallback(flow())).toEqual({ status: "code_received", code: "test-authorization-code", returnPath: returnTo });
});

test("a callback is rejected for the wrong browser or a different sign-in attempt", () => {
  const first = flow();
  const second = flow();
  expect(validateCustomerAuthorizationCallback({ ...first, browserBinding: second.browserBinding })).toEqual({ status: "invalid", reason: "browser" });
  expect(validateCustomerAuthorizationCallback({ ...first, browserBinding: undefined })).toEqual({ status: "invalid", reason: "browser" });
  expect(validateCustomerAuthorizationCallback({ ...first, callbackUrl: second.callbackUrl })).toEqual({ status: "invalid", reason: "state" });
  expect(validateCustomerAuthorizationCallback({ ...first, attempt: null })).toEqual({ status: "invalid", reason: "transaction" });
});

test("expired, future, and malformed authorization records cannot be used", () => {
  const pending = flow();
  for (const timestamp of [pending.attempt.expiresAt, pending.attempt.expiresAt + 1, now - 1, NaN]) {
    expect(validateCustomerAuthorizationCallback({ ...pending, now: timestamp })).toEqual({ status: "invalid", reason: "expired" });
  }
  for (const extra of [{ expiresAt: pending.attempt.expiresAt + 1 }, { createdAt: NaN }, { codeVerifier: "invalid" }, { nonce: "invalid" }, { returnPath: "https://other.test" }]) {
    expect(validateCustomerAuthorizationCallback({ ...pending, attempt: { ...pending.attempt, ...extra } })).toEqual({ status: "invalid", reason: "transaction" });
  }
});

test("changing shop, client, issuer, or registered callback invalidates the request", () => {
  const pending = flow();
  for (const extra of [{ shopId: "999" }, { clientId: "another-client" }, { redirectUri: "https://preview.test/api/reviews/auth/callback" }, { issuer: "https://shopify.com/authentication/999" }]) {
    expect(validateCustomerAuthorizationCallback({ ...pending, attempt: { ...pending.attempt, ...extra } })).toEqual({ status: "invalid", reason: "configuration_changed" });
  }
});

test("callbacks must use the registered endpoint with unambiguous code and state", () => {
  const pending = flow();
  for (const callbackUrl of [pending.callbackUrl.replace("store.test", "other.test"), pending.callbackUrl.replace("/callback?", "/other?"), pending.callbackUrl.replace("https:", "http:"), `${pending.callbackUrl}#fragment`, "invalid-url", `${pending.callbackUrl}&code=another-code`, pending.callbackUrl.replace("code=test-authorization-code", "code="), `${pending.callbackUrl}&error=access_denied`]) {
    expect(validateCustomerAuthorizationCallback({ ...pending, callbackUrl })).toEqual({ status: "invalid", reason: "callback" });
  }
  for (const suffix of ["&state=another-state", "&state=", "&state=" + "a".repeat(100_000)]) {
    expect(validateCustomerAuthorizationCallback({ ...pending, callbackUrl: pending.callbackUrl + suffix })).toEqual({ status: "invalid", reason: "state" });
  }
});

test("provider denial still requires the initiating browser and matching state", () => {
  const pending = flow();
  const url = new URL(pending.callbackUrl);
  url.searchParams.delete("code");
  url.searchParams.set("error", "access_denied");
  url.searchParams.set("error_description", "Private provider details");
  const input = { ...pending, callbackUrl: url.href };
  expect(validateCustomerAuthorizationCallback(input)).toEqual({ status: "denied", returnPath: returnTo });
  expect(validateCustomerAuthorizationCallback({ ...input, browserBinding: undefined })).toEqual({ status: "invalid", reason: "browser" });
  expect(JSON.stringify(validateCustomerAuthorizationCallback(input))).not.toContain("Private provider details");
});

test("authorization cannot be prepared for mismatched discovery or an invalid clock", () => {
  expect(() => prepareCustomerAuthorization({ config, endpoints: { ...endpoints, issuer: "https://shopify.com/authentication/999" }, returnTo, now })).toThrow("do not match");
  expect(() => prepareCustomerAuthorization({ config, endpoints, returnTo, now: NaN })).toThrow("valid creation time");
});
