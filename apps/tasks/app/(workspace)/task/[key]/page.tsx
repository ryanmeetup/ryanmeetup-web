import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TaskPageClient } from "@/components/tasks";
import {
  ACCESS_PREVIEW_PARAM,
  applyAccessPreview,
  USER_ACCESS_PREVIEW_PARAM,
} from "@/lib/access/access-preview";
import { resolveAccessPreview } from "@/lib/server/access-preview";
import { demoData } from "@/lib/workspace/demo-data";
import { parseTaskKey, taskKey } from "@/lib/tasks/task-key";
import {
  requireQueryData,
  WORKSPACE_COLUMNS,
} from "@/lib/server/workspace-loader";
import {
  isWorkspaceDemo,
  loadWorkspacePage,
  redirectPreviewedGuest,
} from "@/lib/server/workspace-page-loader";
import { pageTitle } from "@/lib/server/instance-settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  const taskNumber = parseTaskKey(key);
  if (taskNumber === null) return {};

  if (await isWorkspaceDemo()) {
    const task = demoData.tasks.find((item) => item.task_number === taskNumber);
    return task
      ? {
          title: {
            absolute: await pageTitle(`${taskKey(task)}: ${task.title}`),
          },
        }
      : {};
  }

  const { supabase } = await loadWorkspacePage([], {
    // Only a title; RLS keeps the lookup to tasks the reader can see.
    allowGuest: true,
  });
  const task = requireQueryData(
    "task metadata",
    await supabase
      .from("tasks")
      .select("task_number,title")
      .eq("task_number", taskNumber),
  )[0];

  return task
    ? {
        title: {
          absolute: await pageTitle(`${taskKey(task)}: ${task.title}`),
        },
      }
    : {};
}

export default async function SharedTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { key } = await params;
  const query = await searchParams;
  const taskNumber = parseTaskKey(key);
  if (taskNumber === null) notFound();

  if (await isWorkspaceDemo()) {
    const task = demoData.tasks.find((item) => item.task_number === taskNumber);
    if (!task) notFound();
    return <TaskPageClient initialData={demoData} taskId={task.id} demoMode />;
  }

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
  const task = requireQueryData(
    "shared task",
    await supabase
      .from("tasks")
      .select(WORKSPACE_COLUMNS.tasks)
      .eq("task_number", taskNumber),
  )[0];
  if (!task) notFound();

  const [assignees, categories, labels] = await Promise.all([
    supabase
      .from("task_assignees")
      .select(WORKSPACE_COLUMNS.taskAssignees)
      .eq("task_id", task.id),
    supabase
      .from("task_categories")
      .select(WORKSPACE_COLUMNS.taskCategories)
      .eq("task_id", task.id),
    supabase
      .from("task_labels")
      .select(WORKSPACE_COLUMNS.taskLabels)
      .eq("task_id", task.id),
  ]);
  initialData = {
    ...initialData,
    tasks: [task],
    taskAssignees: requireQueryData("shared task assignees", assignees),
    taskCategories: requireQueryData("shared task categories", categories),
    taskLabels: requireQueryData("shared task labels", labels),
  };

  const requestedGroupPreview =
    typeof query[ACCESS_PREVIEW_PARAM] === "string"
      ? query[ACCESS_PREVIEW_PARAM]
      : undefined;
  const requestedUserPreview =
    typeof query[USER_ACCESS_PREVIEW_PARAM] === "string"
      ? query[USER_ACCESS_PREVIEW_PARAM]
      : undefined;
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

  if (!initialData.tasks.some((item) => item.id === task.id)) notFound();
  return (
    <TaskPageClient
      initialData={initialData}
      taskId={task.id}
      demoMode={false}
    />
  );
}
