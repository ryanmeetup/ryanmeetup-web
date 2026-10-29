import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  requireWorkspaceEntry,
  requireWorkspaceUser,
} from "@/lib/server/workspace-entry";
import {
  loadWorkspace,
  requireQueryData,
  type WorkspaceCollection,
} from "@/lib/server/workspace-loader";
import {
  canViewWorkspaceArea,
  guestHome,
  type WorkspaceAreaKey,
} from "@/lib/access/workspace-areas";
import { withAccessPreview } from "@/lib/access/access-preview";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { getInstanceSettings } from "@/lib/server/instance-settings";
import { isDemoBuild } from "@/lib/instance";
import { DEMO_PREVIEW_COOKIE, DEMO_PREVIEW_VALUE } from "@/lib/demo-preview";
import { seedDefaultStatusesIfEmpty } from "@/lib/server/default-statuses";

/**
 * Whether this request renders the demo workspace, either because the build
 * has no Supabase credentials at all or because an app owner turned on demo
 * preview. Cached so the pages, the layout, and the branding resolver share one
 * answer — and one ownership check — per request.
 *
 * The cookie is never trusted on its own. Demo mode swaps the whole
 * database-backed workspace for fixtures, so a forged cookie leaks nothing, but
 * it would still walk an anonymous visitor past the login redirect into a
 * plausible-looking workspace. `is_app_owner` decides instead, and it fails
 * closed: any error, or any non-owner, gets the real app.
 */
export const isWorkspaceDemo = cache(async (): Promise<boolean> => {
  if (isDemoBuild) return true;
  const requested =
    (await cookies()).get(DEMO_PREVIEW_COOKIE)?.value === DEMO_PREVIEW_VALUE;
  if (!requested) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_app_owner");
  return !error && data === true;
});

/**
 * The signed-in user, or a redirect to /login.
 *
 * Cached so the workspace layout can gate on it before it streams anything
 * without paying for a second round trip when the page load below asks again.
 * The gate has to resolve before the shell flushes: once the browser has the
 * shell, a signed-out visitor would paint a workspace they cannot see and only
 * then bounce to the login page.
 */
export { requireWorkspaceUser };

export async function loadWorkspacePage(
  collections: readonly WorkspaceCollection[],
  {
    owner = false,
    requireOnboarding = true,
    area,
    allowGuest = false,
  }: {
    owner?: boolean;
    requireOnboarding?: boolean;
    /**
     * Whether a guest may open this route. Guests reach the lockable pages
     * granted to them; every other route sends them to the first of those,
     * since everything else on it is work open to the workspace.
     */
    allowGuest?: boolean;
    /**
     * The lockable page this route renders. A member who does not reach it
     * gets the same 404 an owner-only route gives, so a restricted page never
     * confirms it exists. RLS is still the boundary; this only keeps a member
     * from loading an empty shell of a page they cannot use.
     */
    area?: WorkspaceAreaKey;
  } = {},
) {
  const supabase = await createClient();
  const { user } = await requireWorkspaceEntry({
    allowIncomplete: !requireOnboarding,
  });
  if (owner) {
    const isOwner = requireQueryData(
      "owner access",
      await supabase.rpc("is_app_owner"),
    );
    if (!isOwner) notFound();
  }

  let data = await loadWorkspace(supabase, user.id, collections);
  if (data && collections.includes("statuses") && data.statuses.length === 0) {
    await seedDefaultStatusesIfEmpty();
    data = await loadWorkspace(supabase, user.id, collections);
  }

  if (!data) redirect("/account-error?reason=profile");
  if (area && !canViewWorkspaceArea(data.accessibleAreas, area)) notFound();
  if (data.isGuest && !area && !allowGuest)
    redirect(guestHome(data.accessibleAreas, await getInstanceSettings()));
  return { supabase, user, data };
}

/**
 * The preview counterpart of the guest redirect in `loadWorkspacePage`. That
 * check reads the signed-in owner, so a route open to the workspace calls this
 * once a preview is applied, and an owner viewing as a guest lands where the
 * guest would rather than on a page the guest never sees.
 */
export async function redirectPreviewedGuest(
  data: WorkspaceData,
  { onDashboard = false }: { onDashboard?: boolean } = {},
): Promise<"no-pages" | undefined> {
  if (!data.accessPreview?.guest) return;
  const home = guestHome(data.accessibleAreas, await getInstanceSettings());
  // A guest with no page is welcomed on the dashboard route itself.
  if (onDashboard && home === "/") return "no-pages";
  redirect(withAccessPreview(home, data.accessPreview));
}
