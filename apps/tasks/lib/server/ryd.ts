import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  groupSubmissions,
  suggestMatches,
  type RydMatchSuggestion,
  type RydSubmission,
} from "@/lib/ryd/matching";
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

/** Where buyers send their evidence. The page on ryanmeetup.com redirects to the form. */
export const RYD_FORM_URL = "https://ryanmeetup.com/cards/verify";

export type RydContext = {
  user: User;
  supabase: SupabaseClient;
  admin: SupabaseClient;
};

/**
 * The gate every RY-D route passes. An instance with RY-D off answers 404, as
 * if the page never existed; a member without the page answers 403. Data is
 * then read with the service role, because the tables carry no user policies.
 */
export async function rydContext({ owner = false } = {}): Promise<
  RydContext | { response: Response }
> {
  if (!(await getInstanceSettings()).rydEnabled)
    return { response: notFound() };
  const authorization = await authorize({
    onboarded: true,
    area: "ryd",
    owner,
  });
  if ("response" in authorization) return authorization;
  const admin = getAdminClient();
  if (!admin)
    return {
      response: apiError(
        503,
        "SERVICE_UNAVAILABLE",
        "RY-D verification is unavailable.",
      ),
    };
  return { ...authorization, admin };
}

export type RydSettings = {
  formSheetId: string | null;
  fulfillmentEmail: string | null;
};

export type RydOrderRow = {
  order_id: string;
  sales_order: string;
  ordered_at: string;
  first_name: string;
  last_name: string;
  email: string;
  contact_method: string;
  raw: Record<string, string>;
  status: RydOrderStatus;
  note: string | null;
  decided_at: string | null;
  decided_by: string | null;
  cleared_batch_id: string | null;
  last_emailed_at: string | null;
  created_at: string;
};

export type RydQueueOrder = {
  orderId: string;
  salesOrder: string;
  orderedAt: string;
  firstName: string;
  lastName: string;
  /** As fulfillment typed it, for display; matching uses the normalized one. */
  displayEmail: string;
  email: string;
  contactMethod: string;
  total: string;
  status: RydOrderStatus;
  note: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  lastEmailedAt: string | null;
  linkedKeys: string[];
  suggestion: RydMatchSuggestion | null;
};

export type RydSheetState =
  | { status: "unconfigured" }
  | { status: "disconnected" }
  | { status: "error"; message: string; accountEmail: string }
  | { status: "ok"; accountEmail: string };

export type RydQueue = {
  orders: RydQueueOrder[];
  submissions: RydSubmission[];
  sheet: RydSheetState;
  settings: RydSettings;
  clearedCount: number;
  lastBatch: {
    sentAt: string;
    recipient: string | null;
    orderCount: number;
    verifiedCount: number;
  } | null;
  /** False until the migration that creates the RY-D tables is applied. */
  installed: boolean;
};

export async function loadRydSettings(
  admin: SupabaseClient,
): Promise<RydSettings> {
  const result = await admin
    .from("ryd_settings")
    .select("form_sheet_id, fulfillment_email")
    .maybeSingle();
  if (result.error) throw result.error;
  return {
    formSheetId: result.data?.form_sheet_id ?? null,
    fulfillmentEmail: result.data?.fulfillment_email ?? null,
  };
}

async function loadSheet(
  integration: RydGoogleIntegrationRow | null,
  settings: RydSettings,
): Promise<{ sheet: RydSheetState; submissions: RydSubmission[] }> {
  if (!integration)
    return { sheet: { status: "disconnected" }, submissions: [] };
  if (!settings.formSheetId)
    return { sheet: { status: "unconfigured" }, submissions: [] };
  try {
    const { submissions } = await readRydSubmissions(
      integration,
      settings.formSheetId,
    );
    return {
      sheet: { status: "ok", accountEmail: integration.account_email },
      submissions,
    };
  } catch (error) {
    // The queue still works without the sheet: decisions, notes, and the
    // export only need the orders. The page says why the evidence is missing.
    console.error("RY-D form sheet could not be read", error);
    return {
      sheet: {
        status: "error",
        accountEmail: integration.account_email,
        message:
          error instanceof Error && error.message.startsWith("The ")
            ? error.message
            : `Google wouldn't share the sheet with ${integration.account_email}. Check the sheet link and that this account can open it.`,
      },
      submissions: [],
    };
  }
}

const emptyQueue = (installed: boolean): RydQueue => ({
  orders: [],
  submissions: [],
  sheet: { status: "disconnected" },
  settings: { formSheetId: null, fulfillmentEmail: null },
  clearedCount: 0,
  lastBatch: null,
  installed,
});

/**
 * Everything still open, the live form responses, and a suggested pairing for
 * every order nobody has paired yet. Orders already sent to fulfillment as
 * verified are counted, not listed.
 */
export async function loadRydQueue(admin: SupabaseClient): Promise<RydQueue> {
  const [ordersResult, linksResult, clearedResult, batchResult] =
    await Promise.all([
      admin
        .from("ryd_orders")
        .select("*")
        .is("cleared_batch_id", null)
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
  const { sheet, submissions } = await loadSheet(integration, settings);

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
  // Only undecided, unpaired orders are offered a suggestion; a decided order
  // has had a human look at it already.
  const suggestions = suggestMatches(
    rows
      .filter(
        (row) => !linkedByOrder.has(row.order_id) && row.status !== "verified",
      )
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
      contactMethod: row.contact_method,
      total: row.raw.OrderTotal ?? "",
      status: row.status,
      note: row.note,
      decidedAt: row.decided_at,
      decidedBy: row.decided_by,
      lastEmailedAt: row.last_emailed_at,
      linkedKeys: linkedByOrder.get(row.order_id) ?? [],
      suggestion: suggestions.get(row.order_id) ?? null,
    })),
    submissions,
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
    "imported" | "status" | "note" | "linked" | "unlinked" | "emailed" | "sent",
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
        contact_method: order.contactMethod,
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

function resendConfiguration() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RYD_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL;
  return apiKey && from ? { apiKey, from } : null;
}

export const isRydEmailConfigured = () => Boolean(resendConfiguration());

async function sendEmail(
  body: Record<string, unknown>,
  idempotencyKey: string,
) {
  const config = resendConfiguration();
  if (!config) throw new Error("Email is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({ from: config.from, ...body }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(
      `Resend rejected the email (${response.status})${detail ? `: ${detail}` : "."}`,
    );
  }
}

export function rydCustomerEmail(order: {
  firstName: string;
  hasSubmission: boolean;
}) {
  const greeting = `Hi ${order.firstName.trim() || "there"},`;
  const ask = order.hasSubmission
    ? "Thanks for sending your ry-dentification. We couldn't quite confirm it from what came through, so could you add a little more? A social profile with your name and photo, a work or school page, or anything else that shows you're a Ryan works. No government ID needed, ever."
    : "Thanks for ordering a RY-D! Before we can start making it, we need to confirm you're a Ryan. It takes a minute: share a social profile, a work or school page, or anything else that shows your name. No government ID needed, ever.";
  const text = `${greeting}\n\n${ask}\n\nSend it here: ${RYD_FORM_URL}\n\nUse the same email you ordered with so we can match it to your order.\n\nThanks, Ryan\nRyan Meetup`;
  const html = `<p>${greeting}</p><p>${ask}</p><p><a href="${RYD_FORM_URL}">Send your ry-dentification</a></p><p>Use the same email you ordered with so we can match it to your order.</p><p>Thanks, Ryan<br>Ryan Meetup</p>`;
  return {
    subject: order.hasSubmission
      ? "Your RY-D needs a little more ry-dentification"
      : "One quick step before we make your RY-D",
    text,
    html,
  };
}

export async function emailRydCustomer(
  order: Pick<RydOrderRow, "order_id" | "first_name" | "email">,
  hasSubmission: boolean,
) {
  const message = rydCustomerEmail({
    firstName: order.first_name,
    hasSubmission,
  });
  // One reminder per order per day, however many times the button is pressed.
  const day = new Date().toISOString().slice(0, 10);
  await sendEmail(
    { to: [order.email], ...message },
    `ryd-customer/${order.order_id}/${day}`,
  );
}

export async function emailRydFulfillment(
  recipient: string,
  csv: string,
  filename: string,
  counts: { orderCount: number; verifiedCount: number },
  batchKey: string,
) {
  const summary = `${counts.verifiedCount} of ${counts.orderCount} RY-D order${counts.orderCount === 1 ? "" : "s"} ${counts.verifiedCount === 1 ? "is" : "are"} verified and ready to start. They're marked ✅ in the Verified? column of the attached file; the rest are still being checked and will come round again.`;
  await sendEmail(
    {
      to: [recipient],
      subject: `RY-D orders cleared to start: ${counts.verifiedCount}`,
      text: `Hi,\n\n${summary}\n\nThanks,\nRyan Meetup`,
      html: `<p>Hi,</p><p>${summary}</p><p>Thanks,<br>Ryan Meetup</p>`,
      attachments: [
        { filename, content: Buffer.from(csv, "utf8").toString("base64") },
      ],
    },
    `ryd-batch/${batchKey}`,
  );
}

/**
 * Send the export to fulfillment, then mark what it cleared. The email goes
 * first: if it fails nothing has changed and the button can simply be pressed
 * again. Ticking the form sheet comes last and is best effort, because the
 * order is already cleared whether or not Google answers.
 */
export async function sendRydBatch(admin: SupabaseClient, user: User) {
  const settings = await loadRydSettings(admin);
  if (!settings.fulfillmentEmail)
    return {
      ok: false as const,
      error: "Add fulfillment's email address in RY-D settings first.",
    };
  const exported = await buildRydExport(admin);
  if (!exported.orderIds.length)
    return { ok: false as const, error: "There are no orders to send." };

  const batchId = crypto.randomUUID();
  const filename = rydExportFilename();
  await emailRydFulfillment(
    settings.fulfillmentEmail,
    exported.csv,
    filename,
    {
      orderCount: exported.orderIds.length,
      verifiedCount: exported.verifiedIds.length,
    },
    batchId,
  );

  const batch = await admin.from("ryd_fulfillment_batches").insert({
    id: batchId,
    recipient: settings.fulfillmentEmail,
    order_count: exported.orderIds.length,
    verified_count: exported.verifiedIds.length,
    sent_by: user.id,
  });
  if (batch.error) throw batch.error;
  if (exported.verifiedIds.length) {
    const cleared = await admin
      .from("ryd_orders")
      .update({
        cleared_batch_id: batchId,
        updated_at: new Date().toISOString(),
      })
      .in("order_id", exported.verifiedIds)
      .eq("status", "verified");
    if (cleared.error) throw cleared.error;
  }
  await recordRydEvent(admin, user, exported.orderIds, "sent", {
    batch_id: batchId,
    recipient: settings.fulfillmentEmail,
  });

  let sheetTicks: number | null = null;
  const integration = await loadRydGoogleIntegration().catch(() => null);
  if (integration && settings.formSheetId && exported.verifiedIds.length) {
    const links = await admin
      .from("ryd_order_submissions")
      .select("submission_key")
      .in("order_id", exported.verifiedIds);
    if (!links.error) {
      try {
        sheetTicks = await markRydSubmissionsVerified(
          integration,
          settings.formSheetId,
          new Set(links.data.map((link) => link.submission_key)),
        );
      } catch (error) {
        console.error("RY-D form sheet could not be ticked", error);
      }
    }
  }
  return {
    ok: true as const,
    orderCount: exported.orderIds.length,
    verifiedCount: exported.verifiedIds.length,
    recipient: settings.fulfillmentEmail,
    sheetTicks,
  };
}
