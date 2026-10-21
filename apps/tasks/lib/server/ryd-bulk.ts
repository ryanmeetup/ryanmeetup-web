import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RydContactResult,
  RydProductionMove,
  RydProductionResult,
} from "@/lib/ryd/bulk-operations";

export async function moveRydProduction(
  admin: SupabaseClient,
  actor: string,
  operationId: string,
  moves: RydProductionMove[],
) {
  const result = await admin.rpc("ryd_move_production", {
    requested_actor: actor,
    requested_operation: operationId,
    requested_moves: moves,
  });
  if (result.error) throw result.error;
  return result.data as RydProductionResult;
}

export async function recordRydContacts(
  admin: SupabaseClient,
  actor: string,
  operationId: string,
  emails: string[],
) {
  const result = await admin.rpc("ryd_record_contacts", {
    requested_actor: actor,
    requested_operation: operationId,
    requested_emails: emails,
  });
  if (result.error) throw result.error;
  return result.data as RydContactResult;
}
