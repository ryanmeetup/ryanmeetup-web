import { expect, test } from "@playwright/test";
import { generateKeyPair, SignJWT } from "jose";
import { getCustomerAccountSession, getCustomerAccountStorageService } from "../lib/customer-account/runtime";
import { customerSessionCookie } from "../lib/customer-account/sign-in";
import { createCustomerAuthBackend } from "../lib/customer-account/backend";
import { getCustomerAccountEncryptionKeys } from "../lib/customer-account/secrets";
import { createCustomerAccountStorage } from "../lib/customer-account/storage";
import { customerAuthBackendFixture, fakeSupabase, fakeSupabaseUrl } from "./fixtures/customer-auth-backend";
import { customerAccountConfig as config, customerAccountMetadata as metadata, customerAccountEnvironment as configuration } from "./fixtures/customer-account";

const oldEnv = Object.fromEntries(Object.keys(configuration).map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
let transport: ReturnType<typeof customerAuthBackendFixture>;
let keypair: Awaited<ReturnType<typeof generateKeyPair>>;
let requests: string[];
let rejectGrant: boolean;
let failDiscovery: boolean;
let failStorage: boolean;
let refreshes: number;
test.beforeAll(async () => { keypair = await generateKeyPair("RS256"); });
test.beforeEach(() => {
  Object.assign(process.env, configuration);
  transport = customerAuthBackendFixture(); requests = []; rejectGrant = false; failDiscovery = false; failStorage = false; refreshes = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input); requests.push(url);
    if (url.startsWith(fakeSupabaseUrl)) return failStorage ? new Response("private-backend-error", { status: 500 }) : transport.fetcher(input, init);
    if (url === `https://${config.shopDomain}/.well-known/openid-configuration`) return failDiscovery ? new Response("provider down", { status: 503 }) : Response.json(metadata);
    expect(url).toBe(metadata.token_endpoint);
    expect((init?.body as URLSearchParams).get("grant_type")).toBe("refresh_token");
    expect((init?.body as URLSearchParams).get("refresh_token")).toBe("old-private-refresh");
    refreshes += 1;
    return rejectGrant ? Response.json({ error: "invalid_grant", error_description: "private-refresh-error" }, { status: 400 })
      : Response.json({ access_token: "renewed-private-access", refresh_token: "renewed-private-refresh", expires_in: 3600, token_type: "Bearer" });
  };
});
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
const request = (id = "") => new Request("https://store.test/api/reviews/eligibility", { headers: { cookie: `${customerSessionCookie}=${id}` } });
async function seed(expired = true) {
  const now = Date.now();
  const persistence = getCustomerAccountStorageService(request());
  if (!persistence) throw new Error("Synthetic storage unavailable");
  const idToken = await new SignJWT({ nonce: "n".repeat(43) }).setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuer(metadata.issuer).setAudience(config.clientId).setSubject("synthetic-buyer")
    .setIssuedAt(Math.floor(now / 1000) - 7200).setExpirationTime(Math.floor(now / 1000) - 3600).sign(keypair.privateKey);
  // Seed a historical encrypted row in the fake backend, simulating time that
  // has passed since sign-in. This does not test a live backend create request.
  const encryption = getCustomerAccountEncryptionKeys(configuration);
  if (encryption.status !== "configured") throw new Error("Synthetic keyring unavailable");
  const scope = { shopId: config.shopId, clientId: config.clientId, issuer: metadata.issuer, redirectUri: config.redirectUri };
  const backend = createCustomerAuthBackend({ database: fakeSupabase(transport.fetcher), scope, now: () => now - 7200_000 });
  const storage = createCustomerAccountStorage({ config: persistence.config, keyring: encryption.keyring, backend });
  const created = await storage.createSession({ subject: "synthetic-buyer", now: now - 7200_000,
    expiresAt: now + 86400_000, accessExpiresAt: now + (expired ? -3600_000 : 3600_000),
    tokens: { accessToken: "old-private-access", refreshToken: "old-private-refresh", idToken } });
  requests = []; transport.requests.length = 0;
  return created;
}

test("missing or malformed cookies need sign-in without storage or provider requests", async () => {
  for (const id of ["", "invalid", "x".repeat(10000)]) expect(await getCustomerAccountSession(request(id))).toEqual({ status: "sign_in_required" });
  expect(requests).toEqual([]);
});

test("a healthy encrypted session loads during a Shopify outage without discovery", async () => {
  const { id, session } = await seed(false);
  failDiscovery = true;
  expect(await getCustomerAccountSession(request(id))).toEqual({ status: "authenticated", session });
  expect(requests.map((url) => url.split("?")[0])).toEqual([`${fakeSupabaseUrl}/rest/v1/rpc/store_get_customer_session`]);
  expect(transport.requests.map(({ operation }) => operation)).toEqual(["session.get"]);
});

test("runtime renews encrypted tokens once and reloads their bound next revision", async () => {
  const { id, session } = await seed();
  const result = await getCustomerAccountSession(request(id));
  expect(result.status).toBe("authenticated");
  if (result.status !== "authenticated") throw new Error("Expected synthetic session");
  expect(result.session).toMatchObject({ subject: session.subject, createdAt: session.createdAt, expiresAt: session.expiresAt, revision: 1,
    tokens: { accessToken: "renewed-private-access", refreshToken: "renewed-private-refresh", idToken: session.tokens.idToken } });
  expect(transport.requests.map(({ operation }) => operation)).toEqual(["session.get", "session.get", "session.rotate", "session.get"]);
  const encrypted = JSON.stringify([...transport.sessions.values()]);
  expect(encrypted).not.toContain("renewed-private-access"); expect(encrypted).not.toContain("renewed-private-refresh");
  expect(refreshes).toBe(1);
});

test("definitive rejection needs sign-in while discovery and storage failures remain unavailable", async () => {
  const { id } = await seed();
  rejectGrant = true;
  expect(await getCustomerAccountSession(request(id))).toEqual({ status: "sign_in_required" });
  expect([...transport.sessions.values()][0]?.revision).toBe(0);
  expect(transport.requests.some(({ operation }) => operation === "session.revoke")).toBe(false);
  rejectGrant = false; failDiscovery = true;
  expect(await getCustomerAccountSession(request(id))).toEqual({ status: "unavailable" });
  failDiscovery = false; failStorage = true;
  expect(await getCustomerAccountSession(request(id))).toEqual({ status: "unavailable" });
});

test("Judge.me, disabled sign-in, and missing server configuration never load private sessions", async () => {
  const { id } = await seed();
  for (const [key, value] of [["REVIEWS_PROVIDER", "judgeme"], ["STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED", "false"], ["SUPABASE_SECRET_KEY", ""]]) {
    const previous = process.env[key]; process.env[key] = value;
    expect(await getCustomerAccountSession(request(id))).toEqual({ status: "unavailable" });
    process.env[key] = previous;
  }
  expect(requests).toEqual([]);
});
