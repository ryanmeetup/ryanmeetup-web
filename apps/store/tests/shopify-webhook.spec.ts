import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { POST } from "../app/api/webhooks/shopify/route";
import { handleCatalogWebhook } from "../lib/shopify-webhook";

const originalSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
const secret = "test-only-webhook-secret";
const body = '{\n  "id": 123, "title": "Ryan’s shirt 👕"\n}\n';
let invalidations = 0;

function sign(payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64");
}

function delivery(topic = "products/update", payload = body, signature = sign(payload)) {
  return new Request("https://store.test/api/webhooks/shopify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Topic": topic,
      "X-Shopify-Hmac-Sha256": signature,
    },
    body: payload,
  });
}

function receive(request: Request) {
  return handleCatalogWebhook(request, () => { invalidations++; });
}

test.beforeEach(() => {
  process.env.SHOPIFY_WEBHOOK_SECRET = secret;
  invalidations = 0;
});

test.afterEach(() => {
  if (originalSecret === undefined) delete process.env.SHOPIFY_WEBHOOK_SECRET;
  else process.env.SHOPIFY_WEBHOOK_SECRET = originalSecret;
});

for (const topic of [
  "products/create", "products/update", "products/delete",
  "collections/create", "collections/update", "collections/delete",
  "inventory_levels/connect", "inventory_levels/update", "inventory_levels/disconnect",
  "product_listings/add", "product_listings/update", "product_listings/remove",
  "collection_listings/add", "collection_listings/update", "collection_listings/remove",
]) {
  test(`signed ${topic} invalidates the catalog`, async () => {
    const response = await receive(delivery(topic));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revalidated: true });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(invalidations).toBe(1);
  });
}

test("the route refuses requests when its signing secret is missing", async () => {
  delete process.env.SHOPIFY_WEBHOOK_SECRET;
  expect((await POST(delivery())).status).toBe(503);
  expect(invalidations).toBe(0);
});

test("missing, malformed, truncated and forged signatures cannot invalidate", async () => {
  for (const signature of ["", "not-base64", "a".repeat(44), "a".repeat(43) + "=", sign(body).slice(0, -1), sign(body) + "extra"]) {
    expect((await receive(delivery("products/update", body, signature))).status).toBe(401);
  }
  const unsigned = delivery();
  unsigned.headers.delete("X-Shopify-Hmac-Sha256");
  expect((await POST(unsigned)).status).toBe(401);
  expect(invalidations).toBe(0);
});

test("authentication uses exact raw bytes, including whitespace and Unicode", async () => {
  const altered = JSON.stringify(JSON.parse(body));
  expect((await receive(delivery("products/update", altered, sign(body)))).status).toBe(401);
  expect((await receive(delivery("products/update", body + " ", sign(body)))).status).toBe(401);
  expect(invalidations).toBe(0);
  expect((await receive(delivery())).status).toBe(200);
  expect(invalidations).toBe(1);
});

test("a different subscription secret cannot authorize a delivery", async () => {
  process.env.SHOPIFY_WEBHOOK_SECRET = "different-secret";
  expect((await receive(delivery())).status).toBe(401);
  expect(invalidations).toBe(0);
});

test("unrelated signed events are acknowledged without invalidating", async () => {
  const response = await receive(delivery("orders/create"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ revalidated: false });
  expect((await receive(delivery("orders/create", body, "invalid"))).status).toBe(401);
  expect(invalidations).toBe(0);
});

test("a signed delivery still needs a topic", async () => {
  const request = delivery();
  request.headers.delete("X-Shopify-Topic");
  expect((await receive(request)).status).toBe(400);
  expect(invalidations).toBe(0);
});

test("duplicate and out-of-order deliveries can safely invalidate again", async () => {
  for (const request of [delivery(), delivery(), delivery("products/delete"), delivery("products/create")]) {
    expect((await receive(request)).status).toBe(200);
  }
  expect(invalidations).toBe(4);
});

test("cache failures are not acknowledged as successful deliveries", async () => {
  await expect(handleCatalogWebhook(delivery(), () => {
    throw new Error("Cache unavailable");
  })).rejects.toThrow("Cache unavailable");
});
