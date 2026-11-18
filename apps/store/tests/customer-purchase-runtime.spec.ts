import { expect, test } from "@playwright/test";
import { getReviewPurchaseEligibility } from "../lib/customer-account/review-purchase";
import { getCustomerAccountStorageService } from "../lib/customer-account/runtime";
import { customerSessionCookie } from "../lib/customer-account/sign-in";
import { customerAccountEnvironment as configuration, customerAccountConfig as config } from "./fixtures/customer-account";
import { customerAuthBackendFixture } from "./fixtures/customer-auth-backend";
import { customerPurchasePage, purchaseOrderId, purchaseLineId, purchaseProductId } from "./fixtures/customer-purchase";

const oldEnv = Object.fromEntries(Object.keys(configuration).map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const endpoint = `https://shopify.com/${config.shopId}/account/customer/api/2026-10/graphql`;
const references = { orderId: purchaseOrderId, lineId: purchaseLineId, productId: purchaseProductId };
let transport: ReturnType<typeof customerAuthBackendFixture>;
let requests: string[];
let apiReply: unknown;
let discoveredUrl: string;
let failStorage: boolean;
let revokeDuringQuery: boolean;
test.beforeEach(() => {
  Object.assign(process.env, configuration);
  transport = customerAuthBackendFixture(); requests = []; apiReply = { data: customerPurchasePage() }; discoveredUrl = endpoint; failStorage = false; revokeDuringQuery = false;
  globalThis.fetch = async (input, init) => {
    const url = String(input); requests.push(url);
    if (url === "https://backend.test/api/store/customer-auth") return failStorage ? new Response("private-storage-error", { status: 500 }) : transport.fetcher(input, init);
    if (url === `https://${config.shopDomain}/.well-known/customer-account-api`) return Response.json({ graphql_api: discoveredUrl });
    expect(url).toBe(endpoint);
    expect(new Headers(init?.headers).get("authorization")).toBe("private-customer-access");
    expect(JSON.parse(String(init?.body)).variables.orderId).toBe(purchaseOrderId);
    if (revokeDuringQuery) for (const hash of transport.sessions.keys()) transport.sessions.set(hash, null);
    return Response.json(apiReply, { headers: { "x-shopify-api-version": "2026-10" } });
  };
});
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(oldEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
const request = (id = "") => new Request("https://store.test/api/reviews", { method: "POST", headers: { cookie: `${customerSessionCookie}=${id}` } });
async function seed() {
  const storage = getCustomerAccountStorageService(request())?.storage;
  if (!storage) throw new Error("Synthetic storage unavailable");
  const now = Date.now() - 1000;
  const created = await storage.createSession({ now, subject: "opaque-oidc-subject-distinct-from-customer-id", expiresAt: now + 86400_000, accessExpiresAt: now + 3600_000,
    tokens: { accessToken: "private-customer-access", refreshToken: "private-refresh", idToken: "synthetic-identity-anchor" } });
  requests = []; transport.requests.length = 0;
  return created.id;
}

test("missing sessions stop before purchase discovery or Shopify queries", async () => {
  expect(await getReviewPurchaseEligibility(request(), references)).toEqual({ status: "sign_in_required" });
  expect(requests).toEqual([]);
});

test("runtime binds buyer ownership to customer API identity and returns only verified purchased attribution", async () => {
  const id = await seed();
  const result = await getReviewPurchaseEligibility(request(id), references);
  expect(result.status).toBe("eligible");
  if (result.status === "eligible") expect(result.purchase).toMatchObject({ shopId: config.shopId, orderId: purchaseOrderId, lineId: purchaseLineId, productId: purchaseProductId });
  expect(JSON.stringify(result)).not.toContain("private-customer-access");
  expect(JSON.stringify(result)).not.toContain("opaque-oidc-subject");
  expect(requests).toEqual(["https://backend.test/api/store/customer-auth", `https://${config.shopDomain}/.well-known/customer-account-api`, endpoint, "https://backend.test/api/store/customer-auth"]);
});

test("other-account orders, unknown lines, and wrong product hints cannot qualify", async () => {
  const id = await seed();
  const other = customerPurchasePage(); other.order.customer.id = "another-buyer"; apiReply = { data: other };
  expect(await getReviewPurchaseEligibility(request(id), references)).toEqual({ status: "ineligible", reason: "not_owned" });
  apiReply = { data: customerPurchasePage() };
  expect(await getReviewPurchaseEligibility(request(id), { ...references, lineId: "unknown-line" })).toEqual({ status: "ineligible", reason: "not_found" });
  expect(await getReviewPurchaseEligibility(request(id), { ...references, productId: "another-product" })).toEqual({ status: "ineligible", reason: "wrong_product" });
});

test("provider partial failures and wrong-shop discovery remain unavailable, never an eligible or empty purchase", async () => {
  const id = await seed();
  apiReply = { data: customerPurchasePage(), errors: [{ message: "private-provider-error" }] };
  expect(await getReviewPurchaseEligibility(request(id), references)).toEqual({ status: "unavailable" });
  requests = []; discoveredUrl = endpoint.replace(config.shopId, "999");
  expect(await getReviewPurchaseEligibility(request(id), references)).toEqual({ status: "unavailable" });
  expect(requests).not.toContain(endpoint);
  failStorage = true;
  expect(await getReviewPurchaseEligibility(request(id), references)).toEqual({ status: "unavailable" });
});

test("Judge.me mode and invalid references cannot open the custom lookup", async () => {
  const id = await seed(); process.env.REVIEWS_PROVIDER = "judgeme";
  expect(await getReviewPurchaseEligibility(request(id), references)).toEqual({ status: "unavailable" });
  expect(await getReviewPurchaseEligibility(request(id), { ...references, orderId: "x".repeat(10000) })).toEqual({ status: "ineligible", reason: "not_found" });
  expect(requests).toEqual([]);
});

test("signing out during a purchase lookup prevents returning an eligible authorization", async () => {
  const id = await seed(); revokeDuringQuery = true;
  expect(await getReviewPurchaseEligibility(request(id), references)).toEqual({ status: "sign_in_required" });
});
