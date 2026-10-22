import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// Read bounded pages below the standard API cap. Every caller supplies a stable,
// unique ordering so adjacent pages cannot repeat rows with equal sort values.
const PAGE_SIZE = 500;

/** Read a RY-D collection without silently accepting the Data API's first page. */
export async function readRydRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: PostgrestError | null;
  }>,
  maxRows = Number.POSITIVE_INFINITY,
): Promise<{ data: T[]; error: null } | { data: null; error: PostgrestError }> {
  const data: T[] = [];
  while (data.length < maxRows) {
    const size = Math.min(PAGE_SIZE, maxRows - data.length);
    const result = await page(data.length, data.length + size - 1);
    if (result.error) return { data: null, error: result.error };
    const rows = result.data;
    if (!rows) throw new Error("RY-D collection returned no data.");
    data.push(...rows);
    if (rows.length < size) break;
  }
  return { data, error: null };
}

/** Links are shared by the queue and the read-only sales connector. */
export function readRydLinks(admin: SupabaseClient) {
  return readRydRows((from, to) =>
    admin
      .from("ryd_order_submissions")
      .select("order_id, submission_key")
      .order("order_id")
      .order("submission_key")
      .range(from, to),
  );
}
