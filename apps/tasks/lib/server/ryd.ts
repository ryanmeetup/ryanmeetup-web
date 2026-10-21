import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type {
  RydQueue,
  RydSettings,
  RydSheetState,
} from "@/lib/ryd/queue-types";
import { type RydSubmission } from "@/lib/ryd/matching";
import type { RydProductionStage } from "@/lib/ryd/queue-view";
import { type RydOrderStatus } from "@/lib/ryd/orders";
import { withRydQueueMatches } from "@/lib/ryd/queue-reconciliation";
import { getAdminClient } from "./admin-client";
import { apiError, notFound } from "./api-response";
import { authorize } from "./auth";
import { getInstanceSettings } from "./instance-settings";
import {
  loadRydGoogleIntegration,
  readRydSubmissions,
  type RydGoogleReadOptions,
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
  return rydSettingsFrom(result.data);
}

export function rydSettingsFrom(
  row: Record<string, unknown> | null,
): RydSettings {
  return {
    formId: (row?.form_id as string | null) ?? null,
    fulfillmentEmail: (row?.fulfillment_email as string | null) ?? null,
  };
}

async function loadSheet(
  integration: RydGoogleIntegrationRow | null,
  settings: RydSettings,
  options: RydGoogleReadOptions,
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
      options,
    );
    return {
      sheet: { status: "ok", accountEmail: integration.account_email },
      submissions,
    };
  } catch (error) {
    options.signal?.throwIfAborted();
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
export async function loadRydQueue(
  admin: SupabaseClient,
  options: RydGoogleReadOptions = {},
): Promise<RydQueue> {
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
    options,
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
  const rows = (ordersResult.data ?? []) as RydOrderRow[];

  return withRydQueueMatches({
    submissionClaims: Object.fromEntries(
      (linksResult.data ?? []).map((link) => [
        link.submission_key,
        link.order_id,
      ]),
    ),
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
      suggestion: null,
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
  });
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
