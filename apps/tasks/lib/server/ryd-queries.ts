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

/** Order IDs per filtered request, so the URL stays well under proxy limits. */
const ORDER_ID_GROUP = 200;

/** The links of these orders only, read a bounded group of IDs at a time. */
export async function readRydLinksFor(
  admin: SupabaseClient,
  orderIds: string[],
): Promise<
  | { data: { order_id: string; submission_key: string }[]; error: null }
  | { data: null; error: PostgrestError }
> {
  const ids = [...new Set(orderIds)].sort();
  const data: { order_id: string; submission_key: string }[] = [];
  for (let start = 0; start < ids.length; start += ORDER_ID_GROUP) {
    const group = ids.slice(start, start + ORDER_ID_GROUP);
    const result = await readRydRows((from, to) =>
      admin
        .from("ryd_order_submissions")
        .select("order_id, submission_key")
        .in("order_id", group)
        .order("order_id")
        .order("submission_key")
        .range(from, to),
    );
    if (result.error) return result;
    data.push(...result.data);
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
