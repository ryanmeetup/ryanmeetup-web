import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { rydFulfillmentEmail } from "@/lib/ryd/emails";
import type { RydFulfillmentPreview } from "@/lib/ryd/fulfillment";
import { rydOrderExportCsv, type RydOrderStatus } from "@/lib/ryd/orders";
import { readRydLinks } from "./ryd-queries";
import { loadRydGoogleIntegration, readRydSubmissions } from "./ryd-google";
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
  const selected = new Set(data.order_rows.map((row) => row.order_id));
  const linksResult = await readRydLinks(admin);
  if (linksResult.error) throw linksResult.error;
  const links = linksResult.data.filter((link) => selected.has(link.order_id));
  const names = new Map<string, string[]>();
  if (links.length) {
    const [settings, connection] = await Promise.all([
      admin.from("ryd_settings").select("form_id").maybeSingle(),
      loadRydGoogleIntegration(),
    ]);
    if (settings.error) throw settings.error;
    if (!settings.data?.form_id || !connection)
      throw {
        code: "RY409",
        message:
          "Reconnect the verification form before generating an email with linked recipient names.",
      };
    const form = await readRydSubmissions(connection, settings.data.form_id, {
      fresh: true,
    });
    const submissions = new Map(
      form.submissions.map((submission) => [submission.key, submission]),
    );
    for (const link of links) {
      const submission = submissions.get(link.submission_key);
      if (!submission)
        throw {
          code: "RY409",
          message: `The linked response for order ${link.order_id} is unavailable. Review its recipient before generating the email again.`,
        };
      const linked = names.get(link.order_id) ?? [];
      if (submission.legalName.trim()) linked.push(submission.legalName);
      names.set(link.order_id, linked);
    }
    for (const [orderId, linked] of names)
      if (!linked.length)
        throw {
          code: "RY409",
          message: `The linked form has no recipient name for order ${orderId}. Review it before generating the email again.`,
        };
  }
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
        recipientNames: names.get(row.order_id),
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
