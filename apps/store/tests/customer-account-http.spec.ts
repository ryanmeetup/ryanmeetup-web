import { expect, test } from "@playwright/test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import type { JWK } from "jose";
import { GET as start } from "../app/api/reviews/auth/start/route";
import { GET as callback } from "../app/api/reviews/auth/callback/route";
import { POST as logout } from "../app/api/reviews/auth/logout/route";
import { customerAuthorizationCookie } from "../lib/customer-account/authorization";
import { customerSessionCookie } from "../lib/customer-account/sign-in";
import { customerAuthBackendFixture, fakeSupabaseUrl } from "./fixtures/customer-auth-backend";
import { customerAccountConfig as config, customerAccountMetadata as metadata, customerAccountEnvironment as configuration } from "./fixtures/customer-account";
const oldEnv = Object.fromEntries(Object.keys(configuration).map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
let transport: ReturnType<typeof customerAuthBackendFixture>;
let keypair: Awaited<ReturnType<typeof generateKeyPair>>;
let jwk: JWK;
let nonce: string;
let tokenExchanges: number;
let refuseTokens: boolean;
let refuseStorage: boolean;
let refuseDiscovery: boolean;
let requests: string[];

test.beforeAll(async () => {
  keypair = await generateKeyPair("RS256");
  jwk = { ...await exportJWK(keypair.publicKey), alg: "RS256", use: "sig", kid: "test" };
});
test.beforeEach(() => {
  Object.assign(process.env, configuration);
  transport = customerAuthBackendFixture();
  nonce = ""; tokenExchanges = 0; refuseTokens = false; refuseStorage = false; refuseDiscovery = false; requests = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push(url);
    if (url.startsWith(fakeSupabaseUrl)) return refuseStorage ? new Response("private-storage-error", { status: 500 }) : transport.fetcher(input, init);
    if (url === `https://${config.shopDomain}/.well-known/openid-configuration`) return refuseDiscovery ? new Response("provider down", { status: 503 }) : Response.json(metadata);
    if (url === metadata.jwks_uri) return Response.json({ keys: [jwk] });
    expect(url).toBe(metadata.token_endpoint);
    tokenExchanges += 1;
    expect(transport.requests.some(({ operation }) => operation === "authorization.consume")).toBe(true);
    if (refuseTokens) return new Response("private-oauth-error", { status: 401 });
    const id_token = await new SignJWT({ nonce }).setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer(metadata.issuer).setAudience(config.clientId).setSubject("synthetic-buyer").setIssuedAt().setExpirationTime("1 hour").sign(keypair.privateKey);
    return Response.json({ access_token: "private-access", refresh_token: "private-refresh", id_token, token_type: "Bearer", expires_in: 3600 });
  };
});
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

async function begin(headers: HeadersInit = {}) {
  const response = await start(new Request("https://store.test/api/reviews/auth/start?returnTo=%2Fproducts%2Ftee%3Fcolor%3Dblue%23reviews", { headers }));
  expect(response.status).toBe(303);
  const authorization = new URL(response.headers.get("location")!);
  nonce = authorization.searchParams.get("nonce")!;
  const binding = response.cookies.get(customerAuthorizationCookie)!.value;
  const state = authorization.searchParams.get("state")!;
  return { response, authorization, binding, state };
}
const callbackRequest = (state: string, binding: string, query = "code=synthetic-code") => new Request(`${config.redirectUri}?${query}&state=${state}`, {
  headers: { cookie: `${customerAuthorizationCookie}=${binding}` },
});

test("start persists encrypted state before redirecting and sets only an opaque secure cookie", async () => {
  const { response, authorization, binding } = await begin();
  expect(transport.requests.map(({ operation }) => operation)).toEqual(["authorization.create"]);
  expect(authorization.origin).toBe("https://shopify.com");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  const cookie = response.headers.get("set-cookie")!;
  expect(cookie).toContain("HttpOnly"); expect(cookie).toContain("Secure"); expect(cookie).toContain("SameSite=lax"); expect(cookie).toContain("Path=/");
  expect(binding).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(cookie).not.toContain(nonce);
  expect(cookie).not.toContain("code_verifier");
});

test("callback verifies identity, persists an encrypted session, and restores the exact product link", async () => {
  const { state, binding } = await begin();
  const response = await callback(callbackRequest(state, binding));
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("https://store.test/products/tee?color=blue#reviews");
  expect(response.cookies.get(customerSessionCookie)?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(response.cookies.get(customerAuthorizationCookie)?.value).toBe("");
  expect(transport.requests.map(({ operation }) => operation)).toEqual(["authorization.create", "authorization.get", "authorization.consume", "session.create"]);
  expect(JSON.stringify(transport.requests)).not.toContain("private-access");
  expect(JSON.stringify(transport.requests)).not.toContain("private-refresh");
  expect(response.headers.get("set-cookie")).not.toContain("private-access");
  expect(tokenExchanges).toBe(1);
});

test("a reused or concurrently returned callback cannot exchange the code twice", async () => {
  const { state, binding } = await begin();
  const responses = await Promise.all([callback(callbackRequest(state, binding)), callback(callbackRequest(state, binding))]);
  expect(responses.map(({ status }) => status).sort()).toEqual([303, 400]);
  expect(tokenExchanges).toBe(1);
  expect((await callback(callbackRequest(state, binding))).status).toBe(400);
  expect(tokenExchanges).toBe(1);
});

test("the wrong browser and duplicate callback fields never exchange or consume an attempt", async () => {
  const { state, binding } = await begin();
  for (const request of [callbackRequest(state, "x".repeat(43)), callbackRequest(state, binding, "code=a&code=b"), callbackRequest(state, binding, `code=a&state=${state}`)]) {
    const response = await callback(request);
    expect(response.status).toBe(400);
    expect(response.cookies.get(customerSessionCookie)).toBeUndefined();
  }
  expect(tokenExchanges).toBe(0);
  expect(transport.requests.some(({ operation }) => operation === "authorization.consume")).toBe(false);
});

test("Shopify denial retires the valid attempt without a token exchange or buyer session", async () => {
  const { state, binding } = await begin();
  const response = await callback(callbackRequest(state, binding, "error=access_denied"));
  expect(response.status).toBe(303);
  expect(response.cookies.get(customerSessionCookie)).toBeUndefined();
  expect(tokenExchanges).toBe(0);
  expect(transport.requests.map(({ operation }) => operation)).toEqual(["authorization.create", "authorization.get", "authorization.consume"]);
  expect((await callback(callbackRequest(state, binding))).status).toBe(400);
});

test("storage and token failures cannot set a session, redirect to Shopify, or leak upstream bodies", async () => {
  refuseStorage = true;
  const failedStart = await start(new Request("https://store.test/api/reviews/auth/start"));
  expect(failedStart.status).toBe(503);
  expect(failedStart.headers.get("location")).toBeNull();
  expect(failedStart.cookies.get(customerAuthorizationCookie)).toBeUndefined();
  refuseStorage = false;
  const { state, binding } = await begin();
  refuseTokens = true;
  const failedCallback = await callback(callbackRequest(state, binding));
  expect(failedCallback.status).toBe(503);
  expect(failedCallback.cookies.get(customerSessionCookie)).toBeUndefined();
  expect(await failedCallback.text()).not.toContain("private-oauth-error");
  expect((await callback(callbackRequest(state, binding))).status).toBe(400);
  expect(tokenExchanges).toBe(1);
});

test("disabled sign-in and missing configuration keep sign-in closed before any network calls", async () => {
  for (const [key, value] of [["STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED", "false"],
    ["SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET", ""], ["SUPABASE_SECRET_KEY", ""], ["STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEYS", "{}"]]) {
    const previous = process.env[key]; process.env[key] = value;
    expect((await start(new Request("https://store.test/api/reviews/auth/start"))).status).toBe(503);
    process.env[key] = previous;
  }
  expect(requests).toEqual([]);
});

test("shoppers can sign in from the header whatever the review provider", async () => {
  process.env.REVIEWS_PROVIDER = "judgeme";
  const response = await start(new Request("https://store.test/api/reviews/auth/start?returnTo=%2Fapparel%2Fhats"));
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toMatch(/^https:\/\/shopify\.com\/authentication\/123456\/oauth\/authorize\?/);
  expect(transport.requests.map(({ operation }) => operation)).toEqual(["authorization.create"]);
});

test("in development, sign-in started on localhost hops to the registered address; production refuses it", async () => {
  const env = process.env as Record<string, string | undefined>;
  const previous = env.NODE_ENV;
  const local = () => new Request("http://localhost:3002/api/reviews/auth/start?returnTo=%2Fapparel", { headers: { host: "localhost:3002" } });
  try {
    env.NODE_ENV = "development";
    const hop = await start(local());
    expect(hop.status).toBe(303);
    expect(hop.headers.get("location")).toBe("https://store.test/api/reviews/auth/start?returnTo=%2Fapparel");
    // A non-loopback host is still refused, even in development.
    expect((await start(new Request("https://store.test/api/reviews/auth/start", { headers: { host: "attacker.test" } }))).status).toBe(403);
    // Production never hops (here the synthetic loopback database is refused first, so it's a 503).
    env.NODE_ENV = "production";
    const refused = await start(local());
    expect(refused.status).not.toBe(303);
    expect(refused.headers.get("location")).toBeNull();
  } finally {
    env.NODE_ENV = previous;
  }
  expect(transport.requests).toEqual([]);
});

test("start rejects cross-site navigation, wrong public hosts, and ambiguous return paths", async () => {
  const rejectedHeaders: HeadersInit[] = [{ "sec-fetch-site": "cross-site" }, { host: "attacker.test" }, { origin: "https://attacker.test" }];
  for (const headers of rejectedHeaders) {
    expect((await start(new Request("https://store.test/api/reviews/auth/start", { headers }))).status).toBe(403);
  }
  expect((await start(new Request("https://store.test/api/reviews/auth/start?returnTo=/&returnTo=/products/tee"))).status).toBe(400);
  expect(transport.requests).toEqual([]);
  const safe = await start(new Request("https://store.test/api/reviews/auth/start?returnTo=https://attacker.test"));
  expect(safe.status).toBe(303);
});

test("callbacks accept the configured public host behind a proxy and reject another host", async () => {
  const { state, binding } = await begin();
  const query = `?code=synthetic-code&state=${state}`;
  const rejected = await callback(new Request(`http://internal:3002/api/reviews/auth/callback${query}`, { headers: { host: "attacker.test", "x-forwarded-proto": "https", cookie: `${customerAuthorizationCookie}=${binding}` } }));
  expect(rejected.status).toBe(400);
  expect(tokenExchanges).toBe(0);
  const response = await callback(new Request(`http://internal:3002/api/reviews/auth/callback${query}`, { headers: { host: "store.test", "x-forwarded-proto": "https", cookie: `${customerAuthorizationCookie}=${binding}` } }));
  expect(response.status).toBe(303);
});

test("review-session logout works after switching to Judge.me and when Shopify discovery is down", async () => {
  const { state, binding } = await begin();
  const signedIn = await callback(callbackRequest(state, binding));
  const id = signedIn.cookies.get(customerSessionCookie)!.value;
  process.env.REVIEWS_PROVIDER = "judgeme"; process.env.STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED = "false"; refuseDiscovery = true;
  requests = [];
  const response = await logout(new Request("https://store.test/api/reviews/auth/logout", { method: "POST", headers: { origin: "https://store.test", cookie: `${customerSessionCookie}=${id}` } }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ signedOut: true });
  expect(response.cookies.get(customerSessionCookie)?.value).toBe("");
  expect([...transport.sessions.values()]).toEqual([null]);
  expect(requests.map((url) => url.split("?")[0])).toEqual([`${fakeSupabaseUrl}/rest/v1/rpc/store_revoke_customer_session`]);
});

test("logout rejects cross-origin requests and preserves retry capability during storage failure", async () => {
  expect((await logout(new Request("https://store.test/api/reviews/auth/logout", { method: "POST", headers: { origin: "https://attacker.test" } }))).status).toBe(403);
  expect(transport.requests).toEqual([]);
  refuseStorage = true;
  const response = await logout(new Request("https://store.test/api/reviews/auth/logout", { method: "POST", headers: { origin: "https://store.test", cookie: `${customerSessionCookie}=${"s".repeat(43)}` } }));
  expect(response.status).toBe(503);
  expect(response.cookies.get(customerSessionCookie)).toBeUndefined();
});

test("failed sign-in navigations land on an explanation page instead of raw JSON", async () => {
  const html = { accept: "text/html,application/xhtml+xml" };
  const blocked = await start(new Request("https://store.test/api/reviews/auth/start", { headers: { ...html, "sec-fetch-site": "cross-site" } }));
  expect(blocked.status).toBe(303);
  expect(blocked.headers.get("location")).toBe("/reviews/sign-in?problem=blocked");
  const { state, binding } = await begin();
  await callback(callbackRequest(state, binding));
  const replayed = callbackRequest(state, binding);
  replayed.headers.set("accept", html.accept);
  const expired = await callback(replayed);
  expect(expired.headers.get("location")).toBe("/reviews/sign-in?problem=expired");
  expect(expired.cookies.get(customerAuthorizationCookie)?.value).toBe("");
  process.env.STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED = "false";
  const unavailable = await start(new Request("https://store.test/api/reviews/auth/start", { headers: html }));
  expect(unavailable.headers.get("location")).toBe("/reviews/sign-in?problem=unavailable");
});
