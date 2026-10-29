import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectOverviewPageClient } from "@/components/projects";
import {
  ACCESS_PREVIEW_PARAM,
  applyAccessPreview,
  calendarEventsForPreview,
  USER_ACCESS_PREVIEW_PARAM,
} from "@/lib/access/access-preview";
import {
  CALENDAR_EVENT_COLUMNS,
  type CalendarEvent,
} from "@/lib/calendar/calendar-types";
import { findProjectByRouteId } from "@/lib/resources/project-route";
import type { ProjectAttachment } from "@/lib/resources/resource-types";
import type { Task } from "@/lib/tasks/task-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { resolveAccessPreview } from "@/lib/server/access-preview";
import { attachmentColumns } from "@/lib/server/resource-attachment-persistence";
import { pageTitle } from "@/lib/server/instance-settings";
import {
  requireQueryData,
  WORKSPACE_COLUMNS,
} from "@/lib/server/workspace-loader";
import {
  isWorkspaceDemo,
  loadWorkspacePage,
  redirectPreviewedGuest,
} from "@/lib/server/workspace-page-loader";
import { demoCalendarEvents, demoData } from "@/lib/workspace/demo-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (await isWorkspaceDemo()) {
    const project = findProjectByRouteId(demoData.projects, id);
    return project
      ? { title: { absolute: await pageTitle(project.name) } }
      : {};
  }
  const { data } = await loadWorkspacePage(["projects"]);
  const project = findProjectByRouteId(data.projects, id);
  return project ? { title: { absolute: await pageTitle(project.name) } } : {};
}

export default async function ProjectOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (await isWorkspaceDemo()) {
    const project = findProjectByRouteId(demoData.projects, id);
    if (!project) notFound();
    return (
      <ProjectOverviewPageClient
        initialData={demoData}
        projectId={project.id}
        initialEvents={demoCalendarEvents.filter(
          (event) => event.project_id === project.id,
        )}
        attachments={[]}
        canEditProject
        demoMode
      />
    );
  }

  const loaded = await loadWorkspacePage([
    "profiles",
    "statuses",
    "categories",
    "projects",
    "projectOwners",
  ]);
  const project = findProjectByRouteId(loaded.data.projects, id);
  if (!project) notFound();

  const tasks = requireQueryData(
    "project tasks",
    await loaded.supabase
      .from("tasks")
      .select(WORKSPACE_COLUMNS.tasks)
      .eq("project_id", project.id)
      .order("updated_at", { ascending: false }),
  ) as Task[];
  const taskIds = tasks.map((task) => task.id);
  const [
    assigneeResult,
    eventResult,
    attachmentResult,
    activityResult,
    editResult,
  ] = await Promise.all([
    taskIds.length
      ? loaded.supabase
          .from("task_assignees")
          .select(WORKSPACE_COLUMNS.taskAssignees)
          .in("task_id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    loaded.supabase
      .from("calendar_events")
      .select(CALENDAR_EVENT_COLUMNS)
      .eq("project_id", project.id)
      .order("starts_at"),
    loaded.supabase
      .from("project_attachments")
      .select(attachmentColumns("project_id"))
      .eq("project_id", project.id)
      .order("sort_order"),
    taskIds.length
      ? loaded.supabase
          .from("task_activity")
          .select(WORKSPACE_COLUMNS.activity)
          .in("task_id", taskIds)
          .order("created_at", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [], error: null }),
    loaded.supabase.rpc("can_edit_project", { project_id: project.id }),
  ]);

  const taskAssignees = requireQueryData(
    "project task assignees",
    assigneeResult,
  );
  let events = requireQueryData(
    "project calendar events",
    eventResult,
  ) as CalendarEvent[];
  const projectAttachments = requireQueryData(
    "project attachments",
    attachmentResult,
  ) as unknown as ProjectAttachment[];
  const activity = requireQueryData("project activity", activityResult);
  let canEditProject = Boolean(
    requireQueryData("project edit access", editResult),
  );
  const paths = projectAttachments.flatMap((attachment) =>
    attachment.file_path ? [attachment.file_path] : [],
  );
  const signed = paths.length
    ? await loaded.supabase.storage
        .from("project-attachments")
        .createSignedUrls(paths, 3600)
    : { data: [], error: null };
  if (signed.error) {
    throw new Error("Project attachment links could not be created.");
  }
  const signedUrls = new Map(
    (signed.data ?? []).flatMap((item) =>
      item.signedUrl ? [[item.path, item.signedUrl] as const] : [],
    ),
  );
  const attachments = projectAttachments.map((attachment) => ({
    ...attachment,
    url: attachment.file_path
      ? (signedUrls.get(attachment.file_path) ?? "")
      : attachment.url,
  }));

  let initialData: WorkspaceData = {
    ...loaded.data,
    tasks,
    taskAssignees,
    activity,
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
      await loaded.supabase.rpc("is_app_owner"),
    );
    if (isOwner) {
      const resolved = await resolveAccessPreview(loaded.supabase, {
        groupId: requestedGroupPreview,
        userName: requestedUserPreview,
        allProjectIds: loaded.data.projects.map((item) => item.id),
      });
      if (resolved) {
        initialData = applyAccessPreview(
          initialData,
          resolved.preview,
          resolved.projectIds,
        );
        await redirectPreviewedGuest(initialData);
        // The RPC answered for the owner. Every project a member can reach
        // makes them at least an editor, and an unreachable one 404s below.
        canEditProject = true;
        events = calendarEventsForPreview(
          events,
          resolved.preview,
          resolved.projectIds,
        );
      }
    }
  }
  if (!initialData.projects.some((item) => item.id === project.id)) notFound();

  return (
    <ProjectOverviewPageClient
      initialData={initialData}
      projectId={project.id}
      initialEvents={events}
      attachments={attachments}
      canEditProject={canEditProject}
      demoMode={false}
    />
  );
}
