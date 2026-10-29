import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RydPageClient } from "@/components/ryd";
import {
  ACCESS_PREVIEW_PARAM,
  applyAccessPreview,
  USER_ACCESS_PREVIEW_PARAM,
} from "@/lib/access/access-preview";
import { canViewWorkspaceArea } from "@/lib/access/workspace-areas";
import { getAdminClient } from "@/lib/server/admin-client";
import { getInstanceSettings, pageTitle } from "@/lib/server/instance-settings";
import { resolveAccessPreview } from "@/lib/server/access-preview";
import { requireQueryData } from "@/lib/server/workspace-loader";
import { loadRydQueue } from "@/lib/server/ryd";
import { isRydGoogleConfigured } from "@/lib/server/ryd-google";
import {
  isWorkspaceDemo,
  loadWorkspacePage,
} from "@/lib/server/workspace-page-loader";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: await pageTitle("RY-D Verification") } };
}

export default async function RydPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const requestedGroupPreview =
    typeof query[ACCESS_PREVIEW_PARAM] === "string"
      ? query[ACCESS_PREVIEW_PARAM]
      : undefined;
  const requestedUserPreview =
    typeof query[USER_ACCESS_PREVIEW_PARAM] === "string"
      ? query[USER_ACCESS_PREVIEW_PARAM]
      : undefined;
  // Customer data has no demo stand-in, and an instance that doesn't sell
  // RY-Ds has no such page.
  if ((await isWorkspaceDemo()) || !(await getInstanceSettings()).rydEnabled)
    notFound();
  const loaded = await loadWorkspacePage(
    ["profiles", "statuses", "categories", "projects"],
    { area: "ryd" },
  );
  let initialData = loaded.data;
  if (requestedGroupPreview || requestedUserPreview) {
    const isOwner = requireQueryData(
      "owner access",
      await loaded.supabase.rpc("is_app_owner"),
    );
    if (isOwner) {
      const resolvedPreview = await resolveAccessPreview(loaded.supabase, {
        groupId: requestedGroupPreview,
        userName: requestedUserPreview,
        allProjectIds: initialData.projects.map((project) => project.id),
      });
      if (resolvedPreview) {
        initialData = applyAccessPreview(
          initialData,
          resolvedPreview.preview,
          resolvedPreview.projectIds,
        );
      }
    }
  }
  // A guest preview lands here, so it has to keep the preview: without it the
  // shell shows the owner's workspace and every link leaves the preview.
  if (!canViewWorkspaceArea(initialData.accessibleAreas, "ryd")) notFound();
  const admin = getAdminClient();
  if (!admin) notFound();

  return (
    <RydPageClient
      initialData={initialData}
      initialQueue={await loadRydQueue(admin)}
      googleConfigured={isRydGoogleConfigured()}
      canManageSettings={canViewWorkspaceArea(
        initialData.accessibleAreas,
        "ryd-settings",
      )}
    />
  );
}
