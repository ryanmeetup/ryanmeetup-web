import type { CustomerAccountApi } from "./api";
import { reviewBuyerQuery, reviewOrderCandidatesQuery } from "./buyer-queries";
import { customerPurchaseId } from "./purchase-reader";

export type CustomerBuyer = { id: string; firstName: string | null; lastName: string | null };
export type ReviewOrderCandidate = {
  id: string; updatedAt: string; completeLines: boolean;
  lines: { id: string; productId: string | null }[];
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid customer data.");
  return value as Record<string, unknown>;
}
function reference(value: unknown) { if (!customerPurchaseId(value)) throw new Error("Invalid customer reference."); return value; }
function name(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 512) throw new Error("Invalid customer name.");
  const normalized = value.normalize("NFC").replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim();
  return normalized || null;
}
function buyer(value: unknown): CustomerBuyer {
  const data = object(value);
  return { id: reference(data.id), firstName: name(data.firstName), lastName: name(data.lastName) };
}
function pageInfo(value: unknown) {
  const info = object(value);
  if (typeof info.hasNextPage !== "boolean" || (info.endCursor !== null && (typeof info.endCursor !== "string" || !info.endCursor || info.endCursor.length > 2048))) throw new Error("Invalid customer page.");
  if (info.hasNextPage && !info.endCursor) throw new Error("Incomplete customer page.");
  return { more: info.hasNextPage, cursor: info.endCursor as string | null };
}

export async function readReviewBuyer(query: CustomerAccountApi): Promise<CustomerBuyer | null> {
  try { return buyer(object(await query(reviewBuyerQuery, {})).customer); }
  catch { return null; }
}

/** Complete bounded discovery, never an empty success after an omitted page. */
export async function readReviewOrderCandidates(query: CustomerAccountApi): Promise<{ buyer: CustomerBuyer; orders: ReviewOrderCandidate[] } | null> {
  let identity: CustomerBuyer | undefined;
  let after: string | null = null;
  const seenOrders = new Set<string>(); const seenCursors = new Set<string>();
  const orders: ReviewOrderCandidate[] = [];
  try {
    for (let page = 0; page < 10; page++) {
      const customer = object(object(await query(reviewOrderCandidatesQuery, { after })).customer);
      const current = buyer(customer);
      if (identity && JSON.stringify(current) !== JSON.stringify(identity)) return null;
      identity = current;
      const connection = object(customer.orders); const info = pageInfo(connection.pageInfo);
      if (!Array.isArray(connection.nodes) || connection.nodes.length > 10 || (info.more && !connection.nodes.length)) return null;
      for (const value of connection.nodes) {
        const order = object(value); const id = reference(order.id);
        if (seenOrders.has(id) || typeof order.updatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(order.updatedAt) || !Number.isFinite(Date.parse(order.updatedAt))) return null;
        seenOrders.add(id);
        const lineItems = object(order.lineItems); const linesPage = pageInfo(lineItems.pageInfo);
        if (!Array.isArray(lineItems.nodes) || lineItems.nodes.length > 50 || (linesPage.more && !lineItems.nodes.length)) return null;
        const seenLines = new Set<string>();
        const lines = lineItems.nodes.map((value) => {
          const entry = object(value); const lineId = reference(entry.id);
          if (seenLines.has(lineId)) throw new Error("Duplicate customer line.");
          seenLines.add(lineId);
          return { id: lineId, productId: entry.productId === null ? null : reference(entry.productId) };
        });
        orders.push({ id, updatedAt: new Date(order.updatedAt).toISOString(), completeLines: !linesPage.more, lines });
      }
      if (!info.more) return { buyer: identity, orders };
      after = info.cursor;
      if (seenCursors.has(after!)) return null;
      seenCursors.add(after!);
    }
  } catch { /* Provider data and customer names never enter diagnostics. */ }
  return null;
}
