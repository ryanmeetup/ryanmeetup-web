import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GoogleEventPageClient } from "@/components/calendar";
import { canViewWorkspaceArea } from "@/lib/access/workspace-areas";
import { redirectAccessPreviewAway } from "@/lib/server/editor-page-loader";
import {
  getGoogleCalendarEvent,
  loadGoogleCalendarAccess,
} from "@/lib/server/google-calendar";
import { pageTitle } from "@/lib/server/instance-settings";
import {
  isWorkspaceDemo,
  loadWorkspacePage,
} from "@/lib/server/workspace-page-loader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: await pageTitle("Google Calendar Event") } };
}

/**
 * The mobile route for an imported Google invite; the calendar keeps the
 * details dialog from `sm` up. Google's event ID is the only identifier it
 * has. Whoever can't see the shared calendar gets the same 404 as a missing
 * event, so the route never confirms what's on it.
 */
export default async function GoogleEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  redirectAccessPreviewAway(query, "/calendar");
  // The demo workspace has no Google connection to read from.
  if (await isWorkspaceDemo()) notFound();
  const loaded = await loadWorkspacePage(
    ["profiles", "statuses", "categories", "projects"],
    { area: "calendar" },
  );
  if (!canViewWorkspaceArea(loaded.data.accessibleAreas, "calendar"))
    notFound();
  const { googleCanView, integration } = await loadGoogleCalendarAccess(
    loaded.supabase,
    { owner: loaded.data.currentProfile.app_role === "owner" },
  );
  if (!googleCanView || !integration) notFound();
  const result = await getGoogleCalendarEvent(integration, decodeURIComponent(id)).then(
    (event) => ({ event }),
    (error: unknown) => {
      console.error("Google Calendar event could not be loaded", error);
      return { event: null, error: "Google Calendar could not be loaded. Try again in a moment." };
    },
  );
  if (!result.event && !("error" in result)) notFound();
  return (
    <GoogleEventPageClient
      initialData={loaded.data}
      event={result.event}
      error={"error" in result ? result.error : undefined}
    />
  );
}
