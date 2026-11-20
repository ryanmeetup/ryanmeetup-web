import { expect, test } from "@playwright/test";
import { customerAccountEnvironmentKeys, getCustomerAccountConfiguration } from "../lib/customer-account/config";
import { discoverCustomerAccountEndpoints } from "../lib/customer-account/discovery";
import { customerAccountConfig as config, customerAccountMetadata as metadata } from "./fixtures/customer-account";

const env = {
  SHOPIFY_STORE_DOMAIN: config.shopDomain,
  SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID: config.shopId,
  SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: config.clientId,
  SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET: config.clientSecret,
  SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI: config.redirectUri,
};

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

test("missing buyer configuration never borrows Admin credentials", () => {
  const result = getCustomerAccountConfiguration({ SHOPIFY_ADMIN_CLIENT_ID: "admin", SHOPIFY_ADMIN_CLIENT_SECRET: "private-admin-secret" });
  expect(result).toEqual({ status: "unavailable", missing: customerAccountEnvironmentKeys, invalid: [] });
  expect(JSON.stringify(result)).not.toContain("private-admin-secret");
});

test("a confidential client requires every explicit setting and a registered HTTPS callback", () => {
  expect(getCustomerAccountConfiguration(env)).toEqual({ status: "configured", config });
  for (const key of customerAccountEnvironmentKeys) {
    const result = getCustomerAccountConfiguration({ ...env, [key]: "  " });
    expect(result).toEqual({ status: "unavailable", missing: [key], invalid: [] });
  }
});

test("invalid callback and domain settings are named without echoing their values", () => {
  for (const uri of ["http://store.test/api/reviews/auth/callback", "https://localhost/api/reviews/auth/callback", "https://127.0.0.1/api/reviews/auth/callback", "https://[::1]/api/reviews/auth/callback", "https://user:secret@store.test/api/reviews/auth/callback", "https://store.test/other", `${config.redirectUri}?next=bad`, `${config.redirectUri}#bad`]) {
    expect(getCustomerAccountConfiguration({ ...env, SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI: uri })).toEqual({ status: "unavailable", missing: [], invalid: ["SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI"] });
  }
  for (const shopDomain of ["https://review-test.myshopify.com", "review-test.myshopify.com.attacker.test", "localhost", "review-test.myshopify.com/path"]) {
    expect(getCustomerAccountConfiguration({ ...env, SHOPIFY_STORE_DOMAIN: shopDomain })).toEqual({ status: "unavailable", missing: [], invalid: ["SHOPIFY_STORE_DOMAIN"] });
  }
  const result = getCustomerAccountConfiguration({ ...env, SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET: "private\nsecret", SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID: "gid://shopify/Shop/123" });
  expect(result).toEqual({ status: "unavailable", missing: [], invalid: ["SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID", "SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET"] });
  expect(JSON.stringify(result)).not.toContain("private");
});

test("discovery uses only the configured shop and sends no client credentials", async () => {
  const requests: { input: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => { requests.push({ input: String(input), init }); return Response.json(metadata); };
  expect(await discoverCustomerAccountEndpoints(config)).toEqual({
    status: "available",
    endpoints: { issuer: metadata.issuer, authorizationEndpoint: metadata.authorization_endpoint, tokenEndpoint: metadata.token_endpoint, logoutEndpoint: metadata.end_session_endpoint, jwksUri: metadata.jwks_uri },
  });
  expect(requests).toHaveLength(1);
  expect(requests[0].input).toBe(`https://${config.shopDomain}/.well-known/openid-configuration`);
  expect(requests[0].init).toMatchObject({ headers: { Accept: "application/json" }, redirect: "error", cache: "no-store" });
  expect(requests[0].init?.signal).toBeInstanceOf(AbortSignal);
  expect(JSON.stringify(requests)).not.toContain(config.clientSecret);
  expect(JSON.stringify(requests)).not.toContain(config.clientId);
});

test("a discovery response from another shop cannot select authentication endpoints", async () => {
  globalThis.fetch = async () => Response.json({ ...metadata, issuer: "https://shopify.com/authentication/999" });
  expect(await discoverCustomerAccountEndpoints(config)).toEqual({ status: "unavailable", reason: "wrong_shop" });
});

test("discovery rejects invalid endpoints and unsupported authentication", async () => {
  for (const data of [null, [], { ...metadata, token_endpoint: "http://unsafe.test/token" }, { ...metadata, jwks_uri: "https://user:password@unsafe.test/keys" }, { ...metadata, authorization_endpoint: "https://127.0.0.1/authorize" }]) {
    globalThis.fetch = async () => Response.json(data);
    expect(await discoverCustomerAccountEndpoints(config)).toEqual({ status: "unavailable", reason: "invalid_metadata" });
  }
  for (const extra of [{ code_challenge_methods_supported: ["plain"] }, { token_endpoint_auth_methods_supported: ["none"] }]) {
    globalThis.fetch = async () => Response.json({ ...metadata, ...extra });
    expect(await discoverCustomerAccountEndpoints(config)).toEqual({ status: "unavailable", reason: "unsupported_authentication" });
  }
});

test("unreachable or malformed discovery fails without exposing provider errors", async () => {
  for (const fetcher of [
    async () => new Response("unavailable", { status: 503 }),
    async () => new Response("invalid json"),
    async () => { throw new Error("private provider details"); },
  ]) {
    globalThis.fetch = fetcher;
    expect(await discoverCustomerAccountEndpoints(config)).toEqual({ status: "unavailable", reason: "provider_failure" });
  }
  let called = false;
  globalThis.fetch = async () => { called = true; return Response.json(metadata); };
  expect(await discoverCustomerAccountEndpoints({ ...config, shopDomain: "127.0.0.1" })).toEqual({ status: "unavailable", reason: "invalid_metadata" });
  expect(called).toBe(false);
});
