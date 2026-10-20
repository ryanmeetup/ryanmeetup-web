import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RydSubmission } from "@/lib/ryd/matching";
import { RYD_ORDER_STATUSES, type RydOrderStatus } from "@/lib/ryd/orders";
import {
  profileRydOrder,
  summarizeRydSales,
  type RydInsightOrder,
  type RydOrderProfile,
} from "@/lib/ryd/sales-insights";
import { loadRydSettings } from "@/lib/server/ryd";
import {
  loadRydGoogleIntegration,
  readRydSubmissions,
} from "@/lib/server/ryd-google";
import {
  isMissingColumn,
  isMissingRelation,
} from "@/lib/server/supabase-errors";

/**
 * RY-D sales for the MCP connector: every order, ever, with the form answers
 * of whoever it was linked to. The page only shows what is still open; this
 * keeps orders already sent to fulfillment, because they are most of the
 * history.
 */

const MAX_ORDERS = 5000;
const ORDER_COLUMNS =
  "order_id,ordered_at,first_name,last_name,email,contact_method,raw,status,note,decided_at,cleared_batch_id,created_at";

export type RydProfiles =
  | { available: false; reason: string; warnings: string[] }
  | {
      available: true;
      profiles: RydOrderProfile[];
      unlinkedSubmissions: number | null;
      capped: boolean;
      warnings: string[];
    };

async function rydEnabled(admin: SupabaseClient) {
  const result = await admin
    .from("instance_settings")
    .select("ryd_enabled")
    .maybeSingle();
  if (result.error) {
    if (isMissingColumn(result.error.code)) return false;
    throw result.error;
  }
  return result.data?.ryd_enabled === true;
}

/**
 * The form is read live, as the page reads it. When Google won't answer the
 * orders are still worth returning, so the failure becomes a warning.
 */
async function formSubmissions(admin: SupabaseClient, warnings: string[]) {
  try {
    const settings = await loadRydSettings(admin);
    const integration = await loadRydGoogleIntegration();
    if (!integration || !settings.formId) {
      warnings.push(
        "Google isn't connected to the RY-dentification form, so form answers are missing.",
      );
      return null;
    }
    return (await readRydSubmissions(integration, settings.formId)).submissions;
  } catch (error) {
    console.error("RY-D form could not be read for MCP", error);
    warnings.push(
      "The RY-dentification form couldn't be read, so form answers are missing. Order data is complete.",
    );
    return null;
  }
}

export async function loadRydProfiles(
  admin: SupabaseClient,
): Promise<RydProfiles> {
  const warnings: string[] = [];
  if (!(await rydEnabled(admin)))
    return {
      available: false,
      reason: "RY-D Verification is turned off on this instance.",
      warnings,
    };

  const [orders, links] = await Promise.all([
    admin
      .from("ryd_orders")
      .select(ORDER_COLUMNS)
      .order("created_at", { ascending: false })
      .order("order_id")
      .limit(MAX_ORDERS),
    admin.from("ryd_order_submissions").select("order_id, submission_key"),
  ]);
  const failure = orders.error ?? links.error;
  if (failure) {
    if (isMissingRelation(failure.code))
      return {
        available: false,
        reason: "The RY-D tables haven't been created on this instance yet.",
        warnings,
      };
    throw failure;
  }

  const submissions = await formSubmissions(admin, warnings);
  const byKey = new Map<string, RydSubmission>(
    (submissions ?? []).map((submission) => [submission.key, submission]),
  );
  const keysByOrder = new Map<string, string[]>();
  for (const link of links.data ?? [])
    keysByOrder.set(link.order_id, [
      ...(keysByOrder.get(link.order_id) ?? []),
      link.submission_key,
    ]);
  const linkedKeys = new Set((links.data ?? []).map((l) => l.submission_key));

  const rows = (orders.data ?? []) as RydInsightOrder[];
  return {
    available: true,
    profiles: rows.map((order) =>
      profileRydOrder(
        order,
        (keysByOrder.get(order.order_id) ?? [])
          .map((key) => byKey.get(key))
          .filter((s): s is RydSubmission => Boolean(s)),
      ),
    ),
    unlinkedSubmissions: submissions
      ? submissions.filter((s) => !linkedKeys.has(s.key)).length
      : null,
    capped: rows.length === MAX_ORDERS,
    warnings,
  };
}

export type RydOrderFilters = {
  from: string | null;
  to: string | null;
  statuses: RydOrderStatus[];
  query: string | null;
};

export function rydOrderFilters(params: Record<string, unknown>) {
  const day = (value: unknown) =>
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value
      : null;
  const statuses = Array.isArray(params.statuses)
    ? params.statuses.filter((s): s is RydOrderStatus =>
        RYD_ORDER_STATUSES.includes(s as RydOrderStatus),
      )
    : [];
  const query =
    typeof params.query === "string" && params.query.trim()
      ? params.query.trim().toLowerCase().slice(0, 200)
      : null;
  return { from: day(params.from), to: day(params.to), statuses, query };
}

export function filterRydProfiles(
  profiles: RydOrderProfile[],
  { from, to, statuses, query }: RydOrderFilters,
) {
  return profiles.filter((profile) => {
    if (from && (!profile.orderDate || profile.orderDate < from)) return false;
    if (to && (!profile.orderDate || profile.orderDate > to)) return false;
    if (statuses.length && !statuses.includes(profile.status)) return false;
    if (!query) return true;
    return [
      profile.orderId,
      profile.buyerFirstName,
      profile.buyerLastName,
      profile.formFirstName,
      profile.emailDomain,
      profile.items,
      profile.note,
      ...profile.submissions.flatMap((s) => [
        s.legalName,
        ...s.otherAnswers.map((a) => a.answer),
      ]),
    ].some((value) => value?.toLowerCase().includes(query));
  });
}

export async function rydSalesInsights(
  admin: SupabaseClient,
  params: Record<string, unknown>,
) {
  const loaded = await loadRydProfiles(admin);
  if (!loaded.available) return { data: loaded, warnings: loaded.warnings };
  const filters = rydOrderFilters(params);
  const profiles = filterRydProfiles(loaded.profiles, filters);
  return {
    data: {
      available: true,
      filters,
      ...summarizeRydSales(profiles),
      unlinkedSubmissions: loaded.unlinkedSubmissions,
      resultCapped: loaded.capped,
    },
    warnings: loaded.warnings,
  };
}
