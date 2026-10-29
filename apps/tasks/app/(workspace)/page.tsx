import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardPageClient } from "@/components/dashboard";
import {
  ACCESS_PREVIEW_PARAM,
  applyAccessPreview,
  USER_ACCESS_PREVIEW_PARAM,
} from "@/lib/access/access-preview";
import { resolveAccessPreview } from "@/lib/server/access-preview";
import { demoData } from "@/lib/workspace/demo-data";
import {
  requireQueryData,
  WORKSPACE_COLUMNS,
} from "@/lib/server/workspace-loader";
import { GuestWelcomePage } from "@/components/access/GuestWelcomePage";
import { guestHasProjectWork, guestHome } from "@/lib/access/workspace-areas";
import { loadAppOwnerContacts } from "@/lib/server/app-owners";
import { getInstanceSettings, pageTitle } from "@/lib/server/instance-settings";
import {
  isWorkspaceDemo,
  loadWorkspacePage,
  redirectPreviewedGuest,
} from "@/lib/server/workspace-page-loader";
import { latestChangelogRelease } from "@/lib/server/changelog";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: await pageTitle("Dashboard") } };
}

export default async function DashboardPage({
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
  if (demoMode)
    return (
      <DashboardPageClient
        initialData={demoData}
        demoMode
        latestChangelogRelease={latestChangelogRelease}
      />
    );

  const loaded = await loadWorkspacePage(
    [
      "profiles",
      "statuses",
      "categories",
      "categoryOwners",
      "projects",
      "projectOwners",
    ],
    { allowGuest: true },
  );
  const { supabase } = loaded;
  let initialData = loaded.data;
  // A guest's dashboard covers only the projects shared with them. With no
  // current one, they go to their first page, or are welcomed here when
  // nothing has been shared with them yet.
  if (initialData.isGuest && !guestHasProjectWork(initialData.projects)) {
    const home = guestHome(
      initialData.accessibleAreas,
      await getInstanceSettings(),
    );
    if (home !== "/") redirect(home);
    return (
      <GuestWelcomePage
        initialData={initialData}
        owners={await loadAppOwnerContacts()}
      />
    );
  }
  const taskResult = await supabase
    .from("tasks")
    .select(WORKSPACE_COLUMNS.tasks)
    .or(`archived_at.is.null,archived_at.gt.${new Date().toISOString()}`)
    .order("updated_at", { ascending: false });
  const tasks = requireQueryData("dashboard tasks", taskResult);
  const taskIds = tasks.map((task) => task.id);
  const [assigneeResult, activityResult] = taskIds.length
    ? await Promise.all([
        supabase
          .from("task_assignees")
          .select(WORKSPACE_COLUMNS.taskAssignees)
          .in("task_id", taskIds),
        supabase
          .from("task_activity")
          .select(WORKSPACE_COLUMNS.activity)
          .in("task_id", taskIds)
          .eq("action", "moved task")
          .order("created_at", { ascending: false })
          .limit(20),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  initialData = {
    ...initialData,
    tasks,
    taskAssignees: requireQueryData("dashboard assignees", assigneeResult),
    activity: requireQueryData("dashboard activity", activityResult),
  };

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
        if (
          (await redirectPreviewedGuest(initialData, { onDashboard: true })) ===
          "no-pages"
        )
          return (
            <GuestWelcomePage
              initialData={initialData}
              owners={await loadAppOwnerContacts()}
            />
          );
      }
    }
  }

  return (
    <DashboardPageClient
      initialData={initialData}
      demoMode={false}
      latestChangelogRelease={latestChangelogRelease}
    />
  );
}
