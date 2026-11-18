import type { CustomerAccountApi } from "./api";
import { reviewPurchaseQuery } from "./purchase-query";

export type CustomerPurchaseLine = {
  id: string; productId: string | null; variantId: string | null; name: string; variantTitle: string | null;
  quantity: number; refundableQuantity: number; requiresShipping: boolean; giftCard: boolean;
};
export type CustomerPurchaseFulfillment = {
  id: string; status: string | null; createdAt: string;
  lines: { id: string; quantity: number | null; lineId: string }[];
};
export type CustomerPurchase = {
  buyerId: string; orderId: string; orderLabel: string; updatedAt: string; cancelledAt: string | null;
  financialStatus: string | null; edited: boolean; lines: CustomerPurchaseLine[]; fulfillments: CustomerPurchaseFulfillment[];
};
export type CustomerPurchaseRead =
  | { status: "found"; purchase: CustomerPurchase }
  | { status: "not_found" | "not_owned" | "unavailable" };

/** IDs/cursors are opaque server references, never display text or query source. */
export const customerPurchaseId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 256 && /^[\x21-\x7e]+$/u.test(value);
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid purchase data.");
  return value as Record<string, unknown>;
}
function id(value: unknown) { if (!customerPurchaseId(value)) throw new Error("Invalid purchase reference."); return value; }
function text(value: unknown, max = 500) { if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error("Invalid purchase label."); return value; }
function nullableId(value: unknown) { return value === null ? null : id(value); }
function nullableText(value: unknown, max = 500) { return value === null ? null : text(value, max); }
function boolean(value: unknown) { if (typeof value !== "boolean") throw new Error("Invalid purchase flag."); return value; }
function quantity(value: unknown) { if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 2147483647) throw new Error("Invalid purchase quantity."); return value; }
function date(value: unknown) {
  if (typeof value !== "string" || value.length > 40 || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error("Invalid purchase date.");
  return new Date(value).toISOString();
}
function connection(value: unknown, max: number) {
  const data = object(value); const info = object(data.pageInfo);
  if (!Array.isArray(data.nodes) || data.nodes.length > max) throw new Error("Invalid purchase page.");
  const more = boolean(info.hasNextPage);
  const cursor = nullableText(info.endCursor, 2048);
  if (more && (!cursor || !data.nodes.length)) throw new Error("Incomplete purchase page.");
  return { nodes: data.nodes, more, cursor };
}
function line(value: unknown): CustomerPurchaseLine {
  const data = object(value);
  const ordered = quantity(data.quantity); const refundable = quantity(data.refundableQuantity);
  if (refundable > ordered) throw new Error("Inconsistent purchase quantity.");
  return { id: id(data.id), productId: nullableId(data.productId), variantId: nullableId(data.variantId), name: text(data.name),
    variantTitle: nullableText(data.variantTitle), quantity: ordered, refundableQuantity: refundable,
    requiresShipping: boolean(data.requiresShipping), giftCard: boolean(data.giftCard) };
}
function fulfillment(value: unknown): CustomerPurchaseFulfillment {
  const data = object(value); const page = connection(data.fulfillmentLineItems, 50);
  // Bounded reads must never silently treat a partial fulfillment as complete.
  if (page.more) throw new Error("Fulfillment line pagination is required.");
  const seen = new Set<string>();
  const lines = page.nodes.map((value) => {
    const entry = object(value); const reference = id(entry.id);
    if (seen.has(reference)) throw new Error("Duplicate fulfillment line.");
    seen.add(reference);
    return { id: reference, lineId: id(object(entry.lineItem).id), quantity: entry.quantity === null ? null : quantity(entry.quantity) };
  });
  return { id: id(data.id), status: nullableText(data.status, 32), createdAt: date(data.createdAt), lines };
}

/** Customer-token lookup; no browser ownership assertion or Admin API fallback. */
export async function readCustomerPurchase(query: CustomerAccountApi, orderId: string): Promise<CustomerPurchaseRead> {
  if (!customerPurchaseId(orderId)) return { status: "unavailable" };
  let purchase: CustomerPurchase | undefined;
  let snapshot: string | undefined;
  let readLines = true; let readFulfillments = true;
  let linesAfter: string | null = null; let fulfillmentsAfter: string | null = null;
  const lineIds = new Set<string>(); const fulfillmentIds = new Set<string>();
  const lineCursors = new Set<string>(); const fulfillmentCursors = new Set<string>();
  try {
    for (let page = 0; page < 10; page++) {
      const data = object(await query(reviewPurchaseQuery, { orderId, linesAfter, fulfillmentsAfter, readLines, readFulfillments }));
      const buyerId = id(object(data.customer).id);
      if (data.order === null) return { status: purchase ? "unavailable" : "not_found" };
      const order = object(data.order);
      if (id(order.id) !== orderId) return { status: "unavailable" };
      if (order.customer === null) return { status: "unavailable" };
      if (id(object(order.customer).id) !== buyerId) return { status: purchase ? "unavailable" : "not_owned" };
      const core = { buyerId, orderId, orderLabel: text(order.name, 100), updatedAt: date(order.updatedAt),
        cancelledAt: order.cancelledAt === null ? null : date(order.cancelledAt),
        financialStatus: nullableText(order.financialStatus, 32), edited: boolean(order.edited) };
      const current = JSON.stringify(core);
      if (snapshot !== undefined && current !== snapshot) return { status: "unavailable" };
      snapshot = current;
      purchase ??= { ...core, lines: [], fulfillments: [] };
      if (readLines) {
        const lines = connection(order.lineItems, 50);
        for (const node of lines.nodes) {
          const item = line(node);
          if (lineIds.has(item.id)) return { status: "unavailable" };
          lineIds.add(item.id); purchase.lines.push(item);
        }
        readLines = lines.more; linesAfter = lines.cursor;
        if (readLines) {
          if (lineCursors.has(linesAfter!)) return { status: "unavailable" };
          lineCursors.add(linesAfter!);
        }
      }
      if (readFulfillments) {
        const fulfillments = connection(order.fulfillments, 10);
        for (const node of fulfillments.nodes) {
          const entry = fulfillment(node);
          if (fulfillmentIds.has(entry.id)) return { status: "unavailable" };
          fulfillmentIds.add(entry.id); purchase.fulfillments.push(entry);
        }
        readFulfillments = fulfillments.more; fulfillmentsAfter = fulfillments.cursor;
        if (readFulfillments) {
          if (fulfillmentCursors.has(fulfillmentsAfter!)) return { status: "unavailable" };
          fulfillmentCursors.add(fulfillmentsAfter!);
        }
      }
      if (!readLines && !readFulfillments) {
        if (purchase.fulfillments.some((entry) => entry.lines.some((item) => !lineIds.has(item.lineId)))) return { status: "unavailable" };
        return { status: "found", purchase };
      }
    }
  } catch { /* No private provider payload or error is returned or logged. */ }
  return { status: "unavailable" };
}
