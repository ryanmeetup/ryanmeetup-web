import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { rydFulfillmentEmail } from "@/lib/ryd/emails";
import type {
  RydFulfillmentResult,
  RydFulfillmentSnapshot,
} from "@/lib/ryd/fulfillment";
import { rydOrderExportCsv, type RydOrderStatus } from "@/lib/ryd/orders";
import { rydUncheckedSheet } from "@/lib/ryd/sheet-reconciliation";
import {
  loadRydGoogleIntegration,
  markRydSubmissionsVerified,
  readRydSubmissions,
} from "./ryd-google";

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

export async function prepareRydFulfillment(
  admin: SupabaseClient,
  actor: string,
  selection: { orderIds?: string[]; replaceSnapshotId?: string } = {},
): Promise<RydFulfillmentSnapshot> {
  const result = await admin.rpc("ryd_prepare_selected_fulfillment", {
    requested_actor: actor,
    requested_orders: selection.orderIds ?? null,
    requested_replace: selection.replaceSnapshotId ?? null,
  });
  if (result.error) throw result.error;
  const snapshot = result.data as SnapshotRow;
  const ready = new Set(snapshot.verified_ids);
  const draft = rydFulfillmentEmail(
    snapshot.order_rows
      .filter((row) => ready.has(row.order_id))
      .map((row) => ({
        orderId: row.order_id,
        firstName: row.first_name,
        lastName: row.last_name,
      })),
    snapshot.order_rows.length,
  );
  return {
    id: snapshot.id,
    recipient: snapshot.recipient,
    preparedAt: snapshot.prepared_at,
    orderCount: snapshot.order_rows.length,
    verifiedCount: ready.size,
    requiresRebuild: snapshot.requires_rebuild === true,
    selectionConflict: snapshot.selection_conflict === true,
    draft: { ...draft, body: `${draft.body}\n\nBatch: ${snapshot.id}` },
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

export async function finishRydFulfillment(
  admin: SupabaseClient,
  actor: string,
  id: string,
  action: "confirm" | "cancel",
): Promise<RydFulfillmentResult> {
  const result = await admin.rpc("ryd_finish_fulfillment", {
    requested_actor: actor,
    requested_snapshot: id,
    requested_action: action,
  });
  if (result.error) throw result.error;
  const { snapshot, changed } = result.data as {
    changed: boolean;
    snapshot: SnapshotRow;
  };
  const keys = snapshot.response_keys ?? [];
  let sheet = rydUncheckedSheet(
    keys,
    [],
    !keys.length || action === "cancel"
      ? "not-required"
      : !changed
        ? "already-confirmed"
        : "no-linked-sheet",
  );
  // A retry does not re-read Google or repeat the external side effect. The
  // manifest pins both the form and response IDs, independently of settings.
  if (action === "confirm" && changed && snapshot.form_id && keys.length) {
    try {
      const integration = await loadRydGoogleIntegration();
      if (integration) {
        const form = await readRydSubmissions(integration, snapshot.form_id, {
          fresh: true,
        });
        sheet = await markRydSubmissionsVerified(integration, form, keys);
      } else {
        sheet = rydUncheckedSheet(keys, [], "disconnected");
      }
    } catch (error) {
      console.error("RY-D response sheet could not be checked", error);
      sheet = rydUncheckedSheet(keys, [], "google-unavailable");
    }
  }
  return {
    changed,
    orderIds: snapshot.verified_ids,
    verifiedCount: snapshot.verified_ids.length,
    orderCount: snapshot.order_rows.length,
    sheet,
  };
}
