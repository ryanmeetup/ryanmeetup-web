import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  rydCardBatchCsv,
  rydCardBatchFilename,
  type RydCardBatch,
  type RydCardBatchRow,
} from "@/lib/ryd/card-export";
import { readRydRows } from "./ryd-queries";
import { isMissingRelation } from "./supabase-errors";

/** How many past batches the page lists. */
const LISTED_BATCHES = 20;

/**
 * Freeze every approved, ready card into a new batch and mark those orders
 * sent to fulfillment, in one transaction. A retry returns the same batch.
 */
export async function createRydCardBatch(
  admin: SupabaseClient,
  actor: string,
  operationId: string,
): Promise<{ batchId: string | null; orderCount: number }> {
  const result = await admin.rpc("ryd_create_card_batch", {
    requested_actor: actor,
    requested_operation: operationId,
  });
  if (result.error) throw result.error;
  return result.data;
}

/** The latest batches, newest first; none before the batch migration. */
export async function listRydCardBatches(
  admin: SupabaseClient,
): Promise<RydCardBatch[]> {
  const result = await admin
    .from("ryd_card_batches")
    .select("id, order_count, created_at, profiles(full_name)")
    .order("created_at", { ascending: false })
    .order("id")
    .limit(LISTED_BATCHES);
  if (result.error) {
    if (isMissingRelation(result.error.code)) return [];
    throw result.error;
  }
  return (result.data ?? []).map((row) => {
    const profile = row.profiles as unknown as { full_name?: string } | null;
    return {
      id: row.id,
      orderCount: row.order_count,
      createdAt: row.created_at,
      createdBy: profile?.full_name ?? null,
    };
  });
}

/** One batch's file, rebuilt from its frozen rows; null when it is unknown. */
export async function rydCardBatchFile(
  admin: SupabaseClient,
  batchId: string,
): Promise<{ csv: string; filename: string } | null> {
  const batch = await admin
    .from("ryd_card_batches")
    .select("created_at")
    .eq("id", batchId)
    .maybeSingle();
  if (batch.error) throw batch.error;
  if (!batch.data) return null;
  const rows = await readRydRows<RydCardBatchRow>((from, to) =>
    admin
      .from("ryd_card_batch_orders")
      .select("order_id, first_name, last_name, location, ryan_since")
      .eq("batch_id", batchId)
      .order("position")
      .range(from, to),
  );
  if (rows.error) throw rows.error;
  return {
    csv: rydCardBatchCsv(rows.data),
    filename: rydCardBatchFilename(batch.data.created_at),
  };
}
