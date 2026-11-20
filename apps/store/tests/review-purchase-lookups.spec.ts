import { expect, test } from "@playwright/test";
import { POST } from "../app/api/reviews/route";
import { findBuyerName, findRecentReviewablePurchases, findReviewablePurchases } from "../lib/review-purchases";
import { reviewBackendPurchase } from "../lib/customer-account/review-lookups";
import { getCustomerAccountStorageService } from "../lib/customer-account/runtime";
import { customerAuthBackendFixture, fakeSupabaseUrl, supabaseCall } from "./fixtures/customer-auth-backend";
import { customerAccountConfig as config, customerAccountEnvironment as configuration } from "./fixtures/customer-account";
import { customerPurchasePage, purchaseBuyerId, purchaseOrderId, purchaseLineId, purchaseProductId } from "./fixtures/customer-purchase";

const oldEnv = Object.fromEntries(Object.keys(configuration).map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const endpoint = `https://shopify.com/${config.shopId}/account/customer/api/2026-10/graphql`;
let transport: ReturnType<typeof customerAuthBackendFixture>;
let requests: string[];
let purchase: ReturnType<typeof customerPurchasePage>;
let orderReferences: { id: string; updatedAt: string; lineItems: { nodes: { id: string; productId: string | null }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }[];
let buyer: { id: string; firstName: string | null; lastName: string | null };
let rejectQuery: boolean; let revokeOnQuery: boolean; let incomplete: boolean; let failStorage: boolean;
let expectedAccess: string;
let reviewCalls: Record<string, unknown>[];
let manyOrders: boolean;
test.beforeEach(() => {
  Object.assign(process.env, configuration);
  transport = customerAuthBackendFixture(); requests = []; purchase = customerPurchasePage(); reviewCalls = []; manyOrders = false;
  buyer = { id: purchaseBuyerId, firstName: "Ryan", lastName: "Le" };
  orderReferences = [{ id: purchaseOrderId, updatedAt: purchase.order.updatedAt, lineItems: {
    nodes: [{ id: purchaseLineId, productId: purchaseProductId }], pageInfo: { hasNextPage: false, endCursor: null },
  } }];
  rejectQuery = false; revokeOnQuery = false; incomplete = false; failStorage = false; expectedAccess = "stored-private-access";
  globalThis.fetch = async (input, init) => {
    const url = String(input); requests.push(url);
    const call = supabaseCall(input, init);
    if (call?.name === "store_submit_review") {
      reviewCalls.push(call.args);
      return Response.json([{ review_id: "3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b", outcome: "created" }]);
    }
    if (call) return failStorage ? Response.json({ code: "XX000", message: "private-storage-error" }, { status: 500 }) : transport.fetcher(input, init);
    if (url === `https://${config.shopDomain}/.well-known/customer-account-api`) return Response.json({ graphql_api: endpoint });
    expect(url).toBe(endpoint);
    expect(new Headers(init?.headers).get("authorization")).toBe(expectedAccess);
    if (revokeOnQuery) for (const hash of transport.sessions.keys()) transport.sessions.set(hash, null);
    if (rejectQuery) return Response.json({ errors: [{ message: "private-provider-error" }] });
    const body = JSON.parse(String(init?.body)) as { query: string; variables: { after?: string | null; orderId?: string } };
    const query = body.query;
    if (query.includes("query ReviewBuyer")) return Response.json({ data: { customer: buyer } });
    if (manyOrders && query.includes("query ReviewOrderCandidates")) {
      const page = body.variables.after ? Number(body.variables.after) : 0;
      const nodes = Array.from({ length: 10 }, (_, index) => ({
        id: `gid://shopify/Order/${1000 + page * 10 + index}`, updatedAt: purchase.order.updatedAt,
        lineItems: { nodes: [{ id: `gid://shopify/LineItem/${10000 + page * 10 + index}`, productId: purchaseProductId }], pageInfo: { hasNextPage: false, endCursor: null } },
      }));
      return Response.json({ data: { customer: { ...buyer, orders: { nodes, pageInfo: { hasNextPage: page < 9, endCursor: page < 9 ? String(page + 1) : null } } } } });
    }
    if (query.includes("query ReviewOrderCandidates")) return Response.json({ data: { customer: { ...buyer, orders: {
      nodes: orderReferences, pageInfo: { hasNextPage: incomplete, endCursor: incomplete ? "repeated-cursor" : null },
    } } } });
    expect(query).toContain("query ReviewPurchase");
    if (manyOrders) {
      const value = customerPurchasePage();
      const orderId = body.variables.orderId!;
      const lineId = `gid://shopify/LineItem/${Number(orderId.split("/").at(-1)) + 9000}`;
      value.order.id = orderId; value.order.lineItems.nodes[0].id = lineId;
      value.order.fulfillments.nodes[0].fulfillmentLineItems.nodes[0].lineItem.id = lineId;
      return Response.json({ data: value });
    }
    return Response.json({ data: purchase });
  };
});
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(oldEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
async function seed() {
  const persistence = getCustomerAccountStorageService();
  if (!persistence) throw new Error("Synthetic persistence unavailable");
  const now = Date.now() - 1000;
  const created = await persistence.storage.createSession({ now, subject: "opaque-buyer-subject", expiresAt: now + 86400_000, accessExpiresAt: now + 3600_000,
    tokens: { accessToken: expectedAccess, refreshToken: "private-refresh", idToken: "synthetic-verified-anchor" } });
  requests = []; transport.requests.length = 0;
  return { ...created, storage: persistence.storage };
}
function submit(id: string, lineId = "101") {
  return POST(new Request("https://store.test/api/reviews", { method: "POST", headers: {
    "content-type": "application/json", origin: "https://store.test", cookie: `__Host-store-customer-session=${id}`,
  }, body: JSON.stringify({ productId: purchaseProductId, lineId, rating: 5, title: "Ryan approved", body: "Great tee.", nameStyle: "first-initial" }) }));
}

test("the picker returns only owned qualifying lines and exact normalized backend references", async () => {
  const { session } = await seed();
  const result = await findReviewablePurchases(session, "102");
  expect(result).toEqual({ status: "eligible", buyer: { firstName: "Ryan", lastName: "Le" }, purchases: [{
    orderId: "100", lineId: "101", productId: "102", variantId: "104", productTitle: "Ryan tee", variantTitle: "Blue / M", label: "Order #100 · Blue / M",
  }] });
  expect(JSON.stringify(result)).not.toContain("stored-private-access");
  expect(JSON.stringify(result)).not.toContain("opaque-buyer-subject");
  expect(transport.requests.map(({ operation }) => operation)).toEqual(["session.get", "session.get"]);
});

test("recent purchases across every product are verified the same way, for review suggestions", async () => {
  const { session } = await seed();
  expect(await findRecentReviewablePurchases(session)).toEqual({ status: "found", buyer: { firstName: "Ryan", lastName: "Le" }, purchases: [{
    orderId: "100", lineId: "101", productId: "102", variantId: "104", productTitle: "Ryan tee", variantTitle: "Blue / M", label: "Order #100 · Blue / M",
  }] });
  // A line that fails the rules is left out of suggestions rather than closing them.
  purchase.order.fulfillments.nodes[0].status = "PENDING";
  expect(await findRecentReviewablePurchases(session)).toEqual({ status: "found", buyer: { firstName: "Ryan", lastName: "Le" }, purchases: [] });
  rejectQuery = true;
  expect(await findRecentReviewablePurchases(session)).toEqual({ status: "unavailable" });
});

test("a forged caller identity is rejected and caller token fields are never used as authority", async () => {
  const { session } = await seed();
  expect(await findReviewablePurchases({ ...session, subject: "another-buyer" }, "102")).toEqual({ status: "unavailable" });
  expect(requests).not.toContain(endpoint);
  expect((await findReviewablePurchases({ ...session, tokens: { accessToken: "forged-caller-access", refreshToken: "forged", idToken: "forged" } }, "102")).status).toBe("eligible");
});

test("a newer stored session revision supplies its current access token", async () => {
  const { session, storage } = await seed();
  expectedAccess = "renewed-stored-access";
  await storage.rotateSession(session, { ...session.tokens, accessToken: expectedAccess }, session.accessExpiresAt + 3600_000);
  expect((await findReviewablePurchases(session, "102")).status).toBe("eligible");
});

test("complete empty/unrelated histories and known unfulfilled purchases produce none", async () => {
  const { session } = await seed();
  orderReferences = [];
  expect(await findReviewablePurchases(session, "102")).toEqual({ status: "none", reason: "not_purchased" });
  orderReferences = [{ id: purchaseOrderId, updatedAt: purchase.order.updatedAt, lineItems: {
    nodes: [{ id: purchaseLineId, productId: "gid://shopify/Product/999" }], pageInfo: { hasNextPage: false, endCursor: null },
  } }];
  expect(await findReviewablePurchases(session, "102")).toEqual({ status: "none", reason: "not_purchased" });
  orderReferences[0].lineItems.nodes[0].productId = purchaseProductId;
  purchase.order.fulfillments.nodes[0].status = "PENDING";
  expect(await findReviewablePurchases(session, "102")).toEqual({ status: "none", reason: "not_shipped" });
});

test("matching lines beyond the candidate page are verified through the complete owned-order reader", async () => {
  const { session } = await seed();
  orderReferences[0].lineItems.nodes[0].productId = "gid://shopify/Product/999";
  orderReferences[0].lineItems.pageInfo = { hasNextPage: true, endCursor: "more-lines" };
  expect((await findReviewablePurchases(session, "102")).status).toBe("eligible");
});

test("refunded and edited purchases need a person and log only reason codes", async () => {
  const { session } = await seed();
  const logged: unknown[][] = [];
  const info = console.info;
  console.info = (...args: unknown[]) => { logged.push(args); };
  try {
    purchase.order.financialStatus = "REFUNDED";
    expect(await findReviewablePurchases(session, "102")).toEqual({ status: "none", reason: "needs_help" });
    purchase = customerPurchasePage(); purchase.order.edited = true;
    expect(await findReviewablePurchases(session, "102")).toEqual({ status: "none", reason: "needs_help" });
  } finally { console.info = info; }
  expect(logged).toEqual([
    ["Review purchase lines need a person to check.", { reasons: ["refunded"] }],
    ["Review purchase lines need a person to check.", { reasons: ["edited"] }],
  ]);
});

test("a deleted product's line no longer blocks the rest of its order", async () => {
  const { session } = await seed();
  const deleted = structuredClone(purchase.order.lineItems.nodes[0]);
  deleted.id = "gid://shopify/LineItem/909"; deleted.productId = null;
  purchase.order.lineItems.nodes.push(deleted);
  orderReferences[0].lineItems.nodes.push({ id: deleted.id, productId: null });
  expect((await findReviewablePurchases(session, "102")).status).toBe("eligible");
});

test("changed orders, customer mismatches, and incomplete histories remain unavailable", async () => {
  const { session } = await seed();
  purchase.order.updatedAt = "2026-11-17T13:00:00Z";
  expect(await findReviewablePurchases(session, "102")).toEqual({ status: "unavailable" });
  purchase = customerPurchasePage(); purchase.customer.id = "other-buyer"; purchase.order.customer.id = "other-buyer";
  expect(await findReviewablePurchases(session, "102")).toEqual({ status: "unavailable" });
  purchase = customerPurchasePage(); incomplete = true;
  expect(await findReviewablePurchases(session, "102")).toEqual({ status: "unavailable" });
});

test("buyer-name lookup returns verified names and legitimate missing names without fabricating them", async () => {
  const { session } = await seed();
  expect(await findBuyerName(session)).toEqual({ firstName: "Ryan", lastName: "Le" });
  buyer.firstName = null; buyer.lastName = null;
  expect(await findBuyerName(session)).toEqual({ firstName: null, lastName: null });
  rejectQuery = true;
  expect(await findBuyerName(session)).toBeNull();
});

test("revocation during a lookup cannot return purchases or buyer names", async () => {
  const { session } = await seed(); revokeOnQuery = true;
  expect(await findReviewablePurchases(session, "102")).toEqual({ status: "unavailable" });
  expect(await findBuyerName(session)).toBeNull();
  const next = await seed();
  expect(await findBuyerName(next.session)).toBeNull();
});

test("the real custom submission route rechecks Shopify and saves verified IDs and the chosen public name", async () => {
  const { id } = await seed();
  const response = await submit(id);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "pending" });
  expect(reviewCalls).toEqual([{ p_shop_id: config.shopId, p_subject: "opaque-buyer-subject",
    p_order_id: "100", p_line_id: "101", p_product_id: "102", p_variant_id: "104", p_product_title: "Ryan tee", p_variant_title: "Blue / M",
    p_rating: 5, p_title: "Ryan approved", p_body: "Great tee.", p_name_style: "first-initial", p_display_name: "Ryan L.",
  }]);
  expect(requests).toContain(endpoint);
  expect(requests.at(-1)).toBe(`${fakeSupabaseUrl}/rest/v1/rpc/store_submit_review`);
});

test("the real submission route cannot save an unowned line or a failed/revoked lookup", async () => {
  const { id } = await seed();
  expect((await submit(id, "999")).status).toBe(403);
  rejectQuery = true;
  expect((await submit(id)).status).toBe(503);
  rejectQuery = false; revokeOnQuery = true;
  expect((await submit(id)).status).toBe(503);
  expect(reviewCalls).toEqual([]);
});

test("a large matching history stops at the query budget and keeps the newest verified lines", async () => {
  const { session } = await seed(); manyOrders = true;
  const result = await findReviewablePurchases(session, "102");
  expect(result.status).toBe("eligible");
  // Ten discovery pages leave twenty order reads, each fully verified.
  if (result.status === "eligible") expect(result.purchases).toHaveLength(20);
  expect(requests.filter((url) => url === endpoint)).toHaveLength(30);
});

test("expired sessions, missing configuration, and storage/provider failures cannot become empty histories", async () => {
  const { session } = await seed();
  failStorage = true;
  expect(await findReviewablePurchases(session, "102")).toEqual({ status: "unavailable" });
  failStorage = false; rejectQuery = true;
  expect(await findReviewablePurchases(session, "102")).toEqual({ status: "unavailable" });
  rejectQuery = false;
  for (const [key, value] of [["STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED", "false"], ["SUPABASE_SECRET_KEY", ""]]) {
    const old = process.env[key]; process.env[key] = value;
    expect(await findReviewablePurchases(session, "102")).toEqual({ status: "unavailable" });
    expect(await findBuyerName(session)).toBeNull();
    process.env[key] = old;
  }
  expect(await findReviewablePurchases({ ...session, expiresAt: Date.now() - 1 }, "102")).toEqual({ status: "unavailable" });
});

test("reference normalization preserves full numeric precision and rejects wrong resource kinds", async () => {
  const { session } = await seed();
  const result = await findReviewablePurchases(session, "102");
  expect(result.status).toBe("eligible");
  const input = { shopId: config.shopId, customerId: purchaseBuyerId, orderId: purchaseOrderId, lineId: purchaseLineId, productId: purchaseProductId,
    variantId: null, productName: "Ryan   tee", variantTitle: null, orderLabel: "#100", quantity: 1, fulfilledQuantity: 1 };
  expect(reviewBackendPurchase({ ...input, lineId: "gid://shopify/LineItem/18446744073709551615" })).toMatchObject({ lineId: "18446744073709551615", productTitle: "Ryan tee" });
  expect(reviewBackendPurchase({ ...input, lineId: "gid://shopify/Order/101" })).toBeNull();
  expect(reviewBackendPurchase({ ...input, productName: "x".repeat(256) })).toBeNull();
  expect(reviewBackendPurchase({ ...input, variantId: "gid://shopify/Product/104" })).toBeNull();
});
