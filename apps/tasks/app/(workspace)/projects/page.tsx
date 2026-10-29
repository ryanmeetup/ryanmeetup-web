import { ProjectsPageClient } from "@/components/projects";
import { demoData } from "@/lib/workspace/demo-data";
import { requireQueryData } from "@/lib/server/workspace-loader";
import {
  isWorkspaceDemo,
  loadWorkspacePage,
  redirectPreviewedGuest,
} from "@/lib/server/workspace-page-loader";
import {
  ACCESS_PREVIEW_PARAM,
  applyAccessPreview,
  USER_ACCESS_PREVIEW_PARAM,
} from "@/lib/access/access-preview";
import { resolveAccessPreview } from "@/lib/server/access-preview";
import type { Metadata } from "next";
import { pageTitle } from "@/lib/server/instance-settings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: await pageTitle("Projects") } };
}

export default async function ProjectsPage({
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
  const demoMode = await isWorkspaceDemo();
  if (demoMode) return <ProjectsPageClient initialData={demoData} demoMode />;

  const loaded = await loadWorkspacePage([
    "profiles",
    "projects",
    "projectOwners",
    "categories",
    "categoryOwners",
    "statuses",
  ]);
  const { supabase } = loaded;
  let initialData = loaded.data;

  if (requestedGroupPreview || requestedUserPreview) {
    const isOwner = requireQueryData(
      "owner access",
      await supabase.rpc("is_app_owner"),
    );
    if (isOwner) {
      const resolvedPreview = await resolveAccessPreview(supabase, {
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
        await redirectPreviewedGuest(initialData);
      }
    }
  }

  const projectTaskCountEntries = await Promise.all(
    initialData.projects.map(async (project) => {
      const { count, error } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id);
      if (error) throw error;
      return [project.id, count ?? 0] as const;
    }),
  );
  initialData = {
    ...initialData,
    projectTaskCounts: Object.fromEntries(projectTaskCountEntries),
  };

  return <ProjectsPageClient initialData={initialData} demoMode={false} />;
}
