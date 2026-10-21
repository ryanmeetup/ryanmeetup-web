import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRydOrderCsv, type RydImportSummary } from "@/lib/ryd/orders";

export async function importRydOrders(
  admin: SupabaseClient,
  actor: string,
  operationId: string,
  filename: string,
  text: string,
): Promise<({ ok: true } & RydImportSummary) | { ok: false; error: string }> {
  const parsed = parseRydOrderCsv(text);
  if (!parsed.ok) return parsed;
  if (!parsed.orders.length)
    return { ok: false, error: "That file has no orders in it." };
  const result = await admin.rpc("ryd_import_orders", {
    requested_actor: actor,
    requested_operation: operationId,
    requested_payload: {
      filename: filename.slice(0, 255) || "orders.csv",
      headers: parsed.headers,
      duplicateCount: parsed.duplicates.length,
      orders: parsed.orders.map((order) => ({
        orderId: order.orderId,
        salesOrder: order.salesOrder,
        orderedAt: order.orderedAt,
        firstName: order.firstName,
        lastName: order.lastName,
        email: order.email,
        verified: order.verified,
        raw: order.raw,
      })),
    },
  });
  if (result.error) throw result.error;
  return result.data as { ok: true } & RydImportSummary;
}
