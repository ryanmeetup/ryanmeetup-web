import { TaskApp } from "@/components/tasks";
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
import { loadResourceAttachmentCounts } from "@/lib/server/resource-attachment-persistence";
import {
  isWorkspaceDemo,
  loadWorkspacePage,
  redirectPreviewedGuest,
} from "@/lib/server/workspace-page-loader";
import type { Metadata } from "next";
import { parseTaskKey } from "@/lib/tasks/task-key";
import { pageTitle } from "@/lib/server/instance-settings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: await pageTitle("Task Board") } };
}

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const initialTaskId = typeof query.task === "string" ? query.task : undefined;
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
      <TaskApp initialData={demoData} demoMode initialTaskId={initialTaskId} />
    );

  const loaded = await loadWorkspacePage(
    [
      "profiles",
      "statuses",
      "categories",
      "categoryOwners",
      "projects",
      "projectOwners",
      "labels",
    ],
    { guestProjectWork: true },
  );
  const { supabase } = loaded;
  let initialData = loaded.data;
  const archiveBoundary = new Date().toISOString();
  const taskResult = await supabase
    .from("tasks")
    .select(WORKSPACE_COLUMNS.tasks)
    .or(`archived_at.is.null,archived_at.gt.${archiveBoundary}`)
    .order("updated_at", { ascending: false });
  let tasks = requireQueryData("active tasks", taskResult);
  const initialTaskNumber = initialTaskId ? parseTaskKey(initialTaskId) : null;
  if (
    initialTaskNumber !== null &&
    !tasks.some((task) => task.task_number === initialTaskNumber)
  ) {
    const linkedTask = requireQueryData(
      "linked task",
      await supabase
        .from("tasks")
        .select(WORKSPACE_COLUMNS.tasks)
        .eq("task_number", initialTaskNumber),
    );
    tasks = [...tasks, ...linkedTask];
  }
  const taskIds = tasks.map((task) => task.id);
  const [assigneeResult, categoryResult, labelResult] = taskIds.length
    ? await Promise.all([
        supabase
          .from("task_assignees")
          .select(WORKSPACE_COLUMNS.taskAssignees)
          .in("task_id", taskIds),
        supabase
          .from("task_categories")
          .select(WORKSPACE_COLUMNS.taskCategories)
          .in("task_id", taskIds),
        supabase
          .from("task_labels")
          .select(WORKSPACE_COLUMNS.taskLabels)
          .in("task_id", taskIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];
  initialData = {
    ...initialData,
    tasks,
    taskAssignees: requireQueryData("task assignees", assigneeResult),
    taskCategories: requireQueryData("task categories", categoryResult),
    taskLabels: requireQueryData("task labels", labelResult),
    resourceAttachmentCounts: await loadResourceAttachmentCounts(supabase),
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
        await redirectPreviewedGuest(initialData, { projectWork: true });
      }
    }
  }
  return (
    <TaskApp
      initialData={initialData}
      demoMode={false}
      initialTaskId={initialTaskId}
    />
  );
}
