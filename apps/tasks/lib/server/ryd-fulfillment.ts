import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { rydFulfillmentEmail } from "@/lib/ryd/emails";
import type { RydFulfillmentPreview } from "@/lib/ryd/fulfillment";
import { rydOrderExportCsv, type RydOrderStatus } from "@/lib/ryd/orders";
type SnapshotRow = {
  id: string;
  state: "prepared" | "sent" | "cancelled";
  recipient: string;
  headers: string[];
  order_rows: {
    order_id: string;
    raw: Record<string, string>;
    status: RydOrderStatus;
    first_name: string;
    last_name: string;
    updated_at: string;
  }[];
  verified_ids: string[];
  response_keys: string[];
  form_id: string | null;
  prepared_at: string;
  requires_rebuild?: boolean;
  selection_conflict?: boolean;
};

/** One read-only database snapshot; generation never advances order stages. */
export async function generateRydFulfillment(
  admin: SupabaseClient,
  actor: string,
  orderIds: string[],
): Promise<RydFulfillmentPreview> {
  const result = await admin.rpc("ryd_generate_fulfillment", {
    requested_actor: actor,
    requested_orders: orderIds,
  });
  if (result.error) throw result.error;
  const data = result.data as Pick<
    SnapshotRow,
    "recipient" | "headers" | "order_rows"
  > & { generated_at: string };
  return {
    recipient: data.recipient,
    generatedAt: data.generated_at,
    orderCount: data.order_rows.length,
    filename: `ry-d-orders-${data.generated_at.replace(/:/g, "-")}.csv`,
    csv: rydOrderExportCsv(data.headers, data.order_rows),
    draft: rydFulfillmentEmail(
      data.order_rows.map((row) => ({
        orderId: row.order_id,
        firstName: row.first_name,
        lastName: row.last_name,
      })),
      data.order_rows.length,
    ),
  };
}

/** GET never creates a fresh batch or falls back to a moving queue export. */
export async function rydFulfillmentCsv(admin: SupabaseClient, id: string) {
  const result = await admin
    .from("ryd_fulfillment_snapshots")
    .select("state, headers, order_rows")
    .eq("id", id)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data)
    throw {
      code: "RY404",
      message: "That fulfillment batch no longer exists.",
    };
  const snapshot = result.data as SnapshotRow;
  if (snapshot.state === "cancelled")
    throw {
      code: "RY409",
      message:
        "That batch was cancelled. Prepare or resume a batch before downloading.",
    };
  if (snapshot.state === "prepared") {
    const ready = await admin.rpc("ryd_fulfillment_is_ready", {
      requested_snapshot: id,
    });
    if (ready.error) throw ready.error;
    if (ready.data !== true)
      throw {
        code: "RY409",
        message:
          "This batch includes orders still being checked or already sent for production. Cancel the unsent batch and prepare a new one.",
      };
  }
  return rydOrderExportCsv(snapshot.headers, snapshot.order_rows);
}
