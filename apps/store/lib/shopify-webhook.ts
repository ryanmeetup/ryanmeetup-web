import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const catalogTopics = new Set([
  "products/create", "products/update", "products/delete",
  "collections/create", "collections/update", "collections/delete",
  "inventory_levels/connect", "inventory_levels/update", "inventory_levels/disconnect",
  "product_listings/add", "product_listings/update", "product_listings/remove",
  "collection_listings/add", "collection_listings/update", "collection_listings/remove",
]);

/** Order topics that feed anonymous sales activity; see `lib/product-activity`. */
export type OrderActivityHandlers = {
  record: (order: unknown) => Promise<{ recorded: boolean }>;
  forget: (order: unknown) => Promise<{ recorded: boolean }>;
};

function respond(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** The callback keeps cache mutation behind authentication and permits direct route tests. */
export async function handleCatalogWebhook(request: Request, invalidateCatalog: () => void, orders?: OrderActivityHandlers) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return respond({ error: "Shopify webhooks are not configured." }, 503);

  const signature = request.headers.get("x-shopify-hmac-sha256");
  // Require a canonical SHA-256 base64 digest before decoding: Buffer otherwise
  // tolerates malformed input, and timingSafeEqual requires equal byte lengths.
  if (!signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) {
    return respond({ error: "Invalid webhook signature." }, 401);
  }

  const body = Buffer.from(await request.arrayBuffer());
  const expected = createHmac("sha256", secret).update(body).digest();
  const supplied = Buffer.from(signature, "base64");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return respond({ error: "Invalid webhook signature." }, 401);
  }

  const topic = request.headers.get("x-shopify-topic");
  if (!topic) return respond({ error: "Missing webhook topic." }, 400);
  if (orders && (topic === "orders/create" || topic === "orders/cancelled")) {
    let order: unknown;
    try {
      order = JSON.parse(body.toString("utf8"));
    } catch {
      return respond({ error: "Unreadable order payload." }, 400);
    }
    // Storage failures propagate as 500s so Shopify retries; a redelivery is recorded once.
    const result = await (topic === "orders/create" ? orders.record(order) : orders.forget(order));
    return respond(result);
  }
  if (!catalogTopics.has(topic)) return respond({ revalidated: false });

  // Repeated or out-of-order deliveries are harmless: fetch the current catalog
  // on the next visit instead of applying the event payload to local state.
  // Let cache failures propagate as 500s so Shopify can retry the delivery.
  invalidateCatalog();
  return respond({ revalidated: true });
}
