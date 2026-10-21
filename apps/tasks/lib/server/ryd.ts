import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type {
  RydQueue,
  RydSettings,
  RydSheetState,
} from "@/lib/ryd/queue-types";
import {
  groupSubmissions,
  suggestMatches,
  type RydSubmission,
} from "@/lib/ryd/matching";
import type { RydProductionStage } from "@/lib/ryd/queue-view";
import {
  parseRydOrderCsv,
  rydOrderExportCsv,
  type RydOrderStatus,
} from "@/lib/ryd/orders";
import { getAdminClient } from "./admin-client";
import { apiError, notFound } from "./api-response";
import { authorize } from "./auth";
import { getInstanceSettings } from "./instance-settings";
import {
  loadRydGoogleIntegration,
  markRydSubmissionsVerified,
  readRydSubmissions,
  type RydGoogleIntegrationRow,
} from "./ryd-google";
import { isMissingRelation } from "./supabase-errors";

export type RydContext = {
  user: User;
  supabase: SupabaseClient;
  admin: SupabaseClient;
};

/**
 * The gate every RY-D route passes. An instance with RY-D off answers 404, as
 * if the page never existed; a member without the page answers 403. Data is
 * then read with the service role, because the tables carry no user policies.
 * Page access grants full RY-D control, including settings and Google setup.
 */
export async function rydContext(): Promise<
  RydContext | { response: Response }
> {
  if (!(await getInstanceSettings()).rydEnabled)
    return { response: notFound() };
  const authorization = await authorize({
    onboarded: true,
    area: "ryd",
  });
  if ("response" in authorization) return authorization;
  const admin = getAdminClient();
  if (!admin)
    return {
      response: apiError(
        503,
        "SERVICE_UNAVAILABLE",
        "RY-D Verification is unavailable.",
      ),
    };
  return { ...authorization, admin };
}

export type RydOrderRow = {
  order_id: string;
  sales_order: string;
  ordered_at: string;
  first_name: string;
  last_name: string;
  email: string;
  raw: Record<string, string>;
  status: RydOrderStatus;
  note: string | null;
  decided_at: string | null;
  decided_by: string | null;
  cleared_batch_id: string | null;
  last_emailed_at: string | null;
  /** Absent until the production migration is applied. */
  production_sent_at?: string | null;
  done_at?: string | null;
  created_at: string;
};

export async function loadRydSettings(
  admin: SupabaseClient,
): Promise<RydSettings> {
  const result = await admin
    .from("ryd_settings")
    .select("form_id, fulfillment_email")
    .maybeSingle();
  if (result.error) throw result.error;
  return {
    formId: result.data?.form_id ?? null,
    fulfillmentEmail: result.data?.fulfillment_email ?? null,
  };
}

async function loadSheet(
  integration: RydGoogleIntegrationRow | null,
  settings: RydSettings,
): Promise<{ sheet: RydSheetState; submissions: RydSubmission[] }> {
  if (!integration)
    return { sheet: { status: "disconnected" }, submissions: [] };
  if (!settings.formId)
    return {
      sheet: {
        status: "unconfigured",
        accountEmail: integration.account_email,
      },
      submissions: [],
    };
  try {
    const { submissions } = await readRydSubmissions(
      integration,
      settings.formId,
    );
    return {
      sheet: { status: "ok", accountEmail: integration.account_email },
      submissions,
    };
  } catch (error) {
    // The queue still works without the form: decisions, notes, and the
    // export only need the orders. The page says why the evidence is missing.
    console.error("RY-D form could not be read", error);
    return {
      sheet: {
        status: "error",
        accountEmail: integration.account_email,
        message:
          error instanceof Error && error.message.startsWith("The ")
            ? error.message
            : `Google wouldn't share the form's responses with ${integration.account_email}. Check the form link, and that this account owns or can edit the form.`,
      },
      submissions: [],
    };
  }
}

/**
 * Keys of the responses someone set aside. Until the migration that adds the
 * table is applied, nothing is.
 */
async function loadDismissedKeys(admin: SupabaseClient) {
  const result = await admin
    .from("ryd_dismissed_submissions")
    .select("submission_key");
  if (result.error) {
    if (isMissingRelation(result.error.code)) return new Set<string>();
    throw result.error;
  }
  return new Set((result.data ?? []).map((row) => row.submission_key));
}

/**
 * Contact attempts per submitter email, folded from one row per attempt.
 * Until the migration that adds the table is applied, nobody has any.
 */
async function loadSubmitterContacts(admin: SupabaseClient) {
  const result = await admin
    .from("ryd_submitter_contacts")
    .select("email, contacted_at");
  if (result.error) {
    if (isMissingRelation(result.error.code)) return {};
    throw result.error;
  }
  const contacts: RydQueue["contacts"] = {};
  for (const row of (result.data ?? []) as {
    email: string;
    contacted_at: string;
  }[]) {
    const contact = contacts[row.email];
    contacts[row.email] = {
      attempts: (contact?.attempts ?? 0) + 1,
      lastContactedAt:
        contact && contact.lastContactedAt > row.contacted_at
          ? contact.lastContactedAt
          : row.contacted_at,
    };
  }
  return contacts;
}

const emptyQueue = (installed: boolean): RydQueue => ({
  orders: [],
  submissions: [],
  dismissed: [],
  contacts: {},
  sheet: { status: "disconnected" },
  settings: { formId: null, fulfillmentEmail: null },
  clearedCount: 0,
  lastBatch: null,
  installed,
});

/**
 * Everything still open, every verified order (sent to fulfillment or not, so
 * its production can be tracked), the live form responses, and a suggested
 * pairing for every order nobody has paired yet.
 */
export async function loadRydQueue(admin: SupabaseClient): Promise<RydQueue> {
  const [ordersResult, linksResult, clearedResult, batchResult] =
    await Promise.all([
      admin
        .from("ryd_orders")
        .select("*")
        .or("cleared_batch_id.is.null,status.eq.verified")
        .order("created_at", { ascending: false })
        .order("order_id"),
      admin.from("ryd_order_submissions").select("order_id, submission_key"),
      admin
        .from("ryd_orders")
        .select("order_id", { count: "exact", head: true })
        .not("cleared_batch_id", "is", null),
      admin
        .from("ryd_fulfillment_batches")
        .select("sent_at, recipient, order_count, verified_count")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  const failure =
    ordersResult.error ??
    linksResult.error ??
    clearedResult.error ??
    batchResult.error;
  if (failure) {
    if (isMissingRelation(failure.code)) return emptyQueue(false);
    throw failure;
  }
  const settings = await loadRydSettings(admin);
  const integration = await loadRydGoogleIntegration();
  const dismissedKeys = await loadDismissedKeys(admin);
  const contacts = await loadSubmitterContacts(admin);
  const { sheet, submissions: answered } = await loadSheet(
    integration,
    settings,
  );
  // A set-aside response drops out of matching and every list. One linked
  // since keeps its place on the order.
  const linkedKeys = new Set(
    (linksResult.data ?? []).map((link) => link.submission_key),
  );
  const isDismissed = (key: string) =>
    dismissedKeys.has(key) && !linkedKeys.has(key);
  const submissions = answered.filter((s) => !isDismissed(s.key));
  const dismissed = answered.filter((s) => isDismissed(s.key));

  const linkedByOrder = new Map<string, string[]>();
  for (const link of linksResult.data ?? []) {
    const keys = linkedByOrder.get(link.order_id) ?? [];
    keys.push(link.submission_key);
    linkedByOrder.set(link.order_id, keys);
  }
  const keyToEmail = new Map(submissions.map((s) => [s.key, s.email]));
  const claimedEmails = new Set(
    (linksResult.data ?? [])
      .map((link) => keyToEmail.get(link.submission_key))
      .filter((email): email is string => Boolean(email)),
  );

  const rows = (ordersResult.data ?? []) as RydOrderRow[];
  // Every unpaired order is offered a suggestion, decided or not. An order
  // ticked in the fulfillment file arrives verified with nothing linked, and
  // without one it would read as having no form submission at all.
  const suggestions = suggestMatches(
    rows
      .filter((row) => !linkedByOrder.has(row.order_id))
      .map((row) => ({
        orderId: row.order_id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
      })),
    groupSubmissions(submissions),
    claimedEmails,
  );

  return {
    orders: rows.map((row) => ({
      orderId: row.order_id,
      salesOrder: row.sales_order,
      orderedAt: row.ordered_at,
      firstName: row.first_name,
      lastName: row.last_name,
      displayEmail: row.raw.BillEmail?.trim() || row.email,
      email: row.email,
      total: row.raw.OrderTotal ?? "",
      status: row.status,
      note: row.note,
      decidedAt: row.decided_at,
      decidedBy: row.decided_by,
      updatedAt: (row as RydOrderRow & { updated_at?: string }).updated_at,
      lastEmailedAt: row.last_emailed_at,
      sentToFulfillment: Boolean(row.cleared_batch_id),
      productionSentAt: row.production_sent_at ?? null,
      doneAt: row.done_at ?? null,
      linkedKeys: linkedByOrder.get(row.order_id) ?? [],
      suggestion: suggestions.get(row.order_id) ?? null,
    })),
    submissions,
    dismissed,
    contacts,
    sheet,
    settings,
    clearedCount: clearedResult.count ?? 0,
    lastBatch: batchResult.data
      ? {
          sentAt: batchResult.data.sent_at,
          recipient: batchResult.data.recipient,
          orderCount: batchResult.data.order_count,
          verifiedCount: batchResult.data.verified_count,
        }
      : null,
    installed: true,
  };
}

export async function recordRydEvent(
  admin: SupabaseClient,
  user: User,
  orderIds: string[],
  action:
    | "imported"
    | "status"
    | "note"
    | "linked"
    | "unlinked"
    | "emailed"
    | "sent"
    | "production",
  detail: Record<string, unknown> = {},
) {
  if (!orderIds.length) return;
  const result = await admin.from("ryd_order_events").insert(
    orderIds.map((orderId) => ({
      order_id: orderId,
      action,
      detail,
      actor_id: user.id,
    })),
  );
  // The history is for people reading back, never a reason to undo the work.
  if (result.error)
    console.error("RY-D event could not be recorded", result.error);
}

export type RydImportResult =
  | {
      ok: true;
      rowCount: number;
      newCount: number;
      existingCount: number;
      duplicateCount: number;
      preverifiedCount: number;
    }
  | { ok: false; error: string };

/**
 * Add a week's file to the queue. Orders already in the queue keep their
 * decision; the file only ever adds. A tick fulfillment already put in the
 * file is taken as verified, with a note saying so.
 */
export async function importRydOrders(
  admin: SupabaseClient,
  user: User,
  filename: string,
  text: string,
): Promise<RydImportResult> {
  const parsed = parseRydOrderCsv(text);
  if (!parsed.ok) return parsed;
  if (!parsed.orders.length)
    return { ok: false, error: "That file has no orders in it." };

  const ids = parsed.orders.map((order) => order.orderId);
  const existing = await admin
    .from("ryd_orders")
    .select("order_id")
    .in("order_id", ids);
  if (existing.error) throw existing.error;
  const known = new Set((existing.data ?? []).map((row) => row.order_id));
  const fresh = parsed.orders.filter((order) => !known.has(order.orderId));

  const batch = await admin
    .from("ryd_imports")
    .insert({
      filename: filename.slice(0, 255) || "orders.csv",
      headers: parsed.headers,
      row_count: parsed.orders.length,
      new_count: fresh.length,
      uploaded_by: user.id,
    })
    .select("id")
    .single();
  if (batch.error) throw batch.error;

  const now = new Date().toISOString();
  if (fresh.length) {
    const inserted = await admin.from("ryd_orders").upsert(
      fresh.map((order) => ({
        order_id: order.orderId,
        import_position: parsed.orders.indexOf(order),
        sales_order: order.salesOrder,
        ordered_at: order.orderedAt,
        first_name: order.firstName,
        last_name: order.lastName,
        email: order.email,
        raw: order.raw,
        first_import_id: batch.data.id,
        status: order.verified ? "verified" : "pending",
        note: order.verified ? "Already ticked in the fulfillment file." : null,
        decided_at: order.verified ? now : null,
        decided_by: order.verified ? user.id : null,
      })),
      { onConflict: "order_id", ignoreDuplicates: true },
    );
    if (inserted.error) throw inserted.error;
    await recordRydEvent(
      admin,
      user,
      fresh.map((order) => order.orderId),
      "imported",
      {
        filename,
      },
    );
  }
  return {
    ok: true,
    rowCount: parsed.orders.length,
    newCount: fresh.length,
    existingCount: parsed.orders.length - fresh.length,
    duplicateCount: parsed.duplicates.length,
    preverifiedCount: fresh.filter((order) => order.verified).length,
  };
}

/** The headers of the newest file, which is the shape fulfillment expects back. */
async function exportHeaders(admin: SupabaseClient) {
  const result = await admin
    .from("ryd_imports")
    .select("headers")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw result.error;
  return (result.data?.headers as string[] | undefined) ?? [];
}

/**
 * Every order fulfillment hasn't yet been told is cleared, in the order they
 * arrived, with `Verified?` reflecting the decision.
 */
export async function buildRydExport(admin: SupabaseClient) {
  const [headers, orders] = await Promise.all([
    exportHeaders(admin),
    admin
      .from("ryd_orders")
      .select("order_id, raw, status, created_at")
      .is("cleared_batch_id", null)
      .order("created_at")
      .order("import_position"),
  ]);
  if (orders.error) throw orders.error;
  const rows = (orders.data ?? []) as Pick<
    RydOrderRow,
    "order_id" | "raw" | "status"
  >[];
  return {
    csv: rydOrderExportCsv(headers, rows),
    orderIds: rows.map((row) => row.order_id),
    verifiedIds: rows
      .filter((row) => row.status === "verified")
      .map((row) => row.order_id),
  };
}

export function rydExportFilename(date = new Date()) {
  return `ry-d-verified-${date.toISOString().slice(0, 10)}.csv`;
}

/**
 * Record that fulfillment was sent the file, and clear the orders it told them
 * could start. The reviewer sends the email themselves, so only the orders
 * they saw as verified are cleared: one verified since stays in the queue for
 * the next file. Ticking the form sheet comes last and is best effort, because
 * the order is already cleared whether or not Google answers.
 */
export async function markRydBatchSent(
  admin: SupabaseClient,
  user: User,
  readyIds: string[],
) {
  const settings = await loadRydSettings(admin);
  const exported = await buildRydExport(admin);
  if (!exported.orderIds.length)
    return { ok: false as const, error: "There are no orders to send." };
  const ready = new Set(readyIds);
  const verifiedIds = exported.verifiedIds.filter((id) => ready.has(id));

  const batchId = crypto.randomUUID();
  const batch = await admin.from("ryd_fulfillment_batches").insert({
    id: batchId,
    recipient: settings.fulfillmentEmail,
    order_count: exported.orderIds.length,
    verified_count: verifiedIds.length,
    sent_by: user.id,
  });
  if (batch.error) throw batch.error;
  if (verifiedIds.length) {
    const cleared = await admin
      .from("ryd_orders")
      .update({
        cleared_batch_id: batchId,
        updated_at: new Date().toISOString(),
      })
      .in("order_id", verifiedIds)
      .eq("status", "verified");
    if (cleared.error) throw cleared.error;
  }
  await recordRydEvent(admin, user, exported.orderIds, "sent", {
    batch_id: batchId,
    recipient: settings.fulfillmentEmail,
  });

  let sheetTicks: number | null = null;
  const integration = await loadRydGoogleIntegration().catch(() => null);
  if (integration && settings.formId && verifiedIds.length) {
    const links = await admin
      .from("ryd_order_submissions")
      .select("submission_key")
      .in("order_id", verifiedIds);
    if (!links.error) {
      try {
        const keys = new Set(links.data.map((link) => link.submission_key));
        const form = await readRydSubmissions(integration, settings.formId);
        sheetTicks = await markRydSubmissionsVerified(
          integration,
          form.linkedSheetId,
          form.submissions.filter((submission) => keys.has(submission.key)),
        );
      } catch (error) {
        console.error("RY-D response sheet could not be ticked", error);
      }
    }
  }
  return {
    ok: true as const,
    orderCount: exported.orderIds.length,
    verifiedCount: verifiedIds.length,
    sheetTicks,
  };
}

/**
 * Move verified orders to a production stage. Each step only stamps what is
 * missing, so re-marking keeps the first date: done fills in a sent date the
 * order skipped, back to in production clears only done, and not started
 * clears both. Returns how many orders actually moved.
 */
export async function setRydProductionStage(
  admin: SupabaseClient,
  user: User,
  orderIds: string[],
  stage: RydProductionStage,
) {
  const result = await admin.rpc("ryd_set_production", {
    requested_actor: user.id,
    requested_orders: orderIds,
    requested_stage: stage,
  });
  if (result.error) throw result.error;
  return result.data as { movedCount: number; orderIds: string[] };
}
