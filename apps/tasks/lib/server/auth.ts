import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  workspaceAreaRequiresAccessCheck,
  type WorkspaceAreaKey,
} from "@/lib/access/workspace-areas";
import { apiError, authRequired, forbidden } from "./api-response";
import { isMissingFunction } from "./supabase-errors";

type ApiFailure = { response: ReturnType<typeof apiError> };
export type Authorization = { user: User; supabase: SupabaseClient };

export async function authorize({
  owner = false,
  onboarded = false,
  area,
}: {
  owner?: boolean;
  onboarded?: boolean;
  /**
   * The lockable page this route serves. RLS already refuses the rows, so this
   * only turns a silent empty result into an explicit 403 at the boundary.
   */
  area?: WorkspaceAreaKey;
} = {}): Promise<ApiFailure | Authorization> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return {
      response: apiError(
        503,
        "SERVICE_UNAVAILABLE",
        "Authentication is temporarily unavailable.",
      ),
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { response: authRequired() };
  if (onboarded) {
    const profile = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile.error || !profile.data?.onboarding_completed)
      return { response: forbidden() };
  }
  if (owner) {
    const { data: isOwner, error: ownerError } =
      await supabase.rpc("is_app_owner");
    if (ownerError || !isOwner) return { response: forbidden() };
  }
  if (area) {
    const { data: canView, error: areaError } = await supabase.rpc(
      "can_view_workspace_area",
      { requested_area: area },
    );
    // A build whose migrations have not run has no function to call and no
    // policy restricting the page either. Privileged-data areas always need
    // a working access check; every other failure denies too.
    if (
      areaError &&
      (!isMissingFunction(areaError.code) ||
        workspaceAreaRequiresAccessCheck(area))
    )
      return { response: forbidden() };
    if (!areaError && !canView) return { response: forbidden() };
  }
  return { user: data.user, supabase };
}
