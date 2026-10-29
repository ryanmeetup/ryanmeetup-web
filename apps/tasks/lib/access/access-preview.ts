import type { CalendarEvent } from "@/lib/calendar/calendar-types";
import type { Note } from "@/lib/resources/resource-types";
import type {
  AccessPreview,
  WorkspaceData,
} from "@/lib/workspace/workspace-types";

export const ACCESS_PREVIEW_PARAM = "viewAsGroup";
export const USER_ACCESS_PREVIEW_PARAM = "viewAsUser";

/** One group, or several viewed together as a single member holding them. */
export function accessPreviewHref(...groupNames: string[]) {
  return `/?${ACCESS_PREVIEW_PARAM}=${groupNames.map(encodeURIComponent).join(",")}`;
}

export function userAccessPreviewHref(profileName: string) {
  return `/?${USER_ACCESS_PREVIEW_PARAM}=${encodeURIComponent(profileName)}`;
}

export function withAccessPreview(href: string, preview?: AccessPreview) {
  if (!preview) return href;
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.delete(ACCESS_PREVIEW_PARAM);
  params.delete(USER_ACCESS_PREVIEW_PARAM);
  params.set(
    preview.kind === "group" ? ACCESS_PREVIEW_PARAM : USER_ACCESS_PREVIEW_PARAM,
    preview.subjectName,
  );
  return `${path}?${params.toString()}`;
}

/**
 * Routes that do something rather than show something. A preview reads the
 * workspace as its subject but writes as the owner, so these stay shut even
 * though they are links: `/profile` would show the owner's own profile.
 */
export function isPreviewActionPath(pathname: string) {
  return (
    pathname === "/profile" ||
    pathname.startsWith("/admin") ||
    /\/(new|edit)(\/|$)/.test(pathname)
  );
}

export function applyAccessPreview(
  data: WorkspaceData,
  preview: AccessPreview,
  projectIds: string[],
): WorkspaceData {
  const visibleProjectIds = new Set(projectIds);
  const visibleCategoryIds = new Set(
    preview.accessibleCategoryIds ?? data.categories.map(({ id }) => id),
  );
  const projects = data.projects.filter((project) =>
    visibleProjectIds.has(project.id),
  );
  const inaccessibleTaskIds = new Set(preview.inaccessibleTaskIds ?? []);
  // A guest skips projectless tasks along with everything else open to the
  // workspace.
  const tasks = data.tasks.filter(
    (task) =>
      (task.project_id === null
        ? !preview.guest
        : visibleProjectIds.has(task.project_id)) &&
      !inaccessibleTaskIds.has(task.id),
  );
  const visibleTaskIds = new Set(tasks.map((task) => task.id));

  return {
    ...data,
    accessPreview: preview,
    accessibleAreas: preview.accessibleAreas ?? data.accessibleAreas,
    isGuest: Boolean(preview.guest),
    canManageCategories: Boolean(preview.canManageCategories),
    // A group has no person of its own: it borrows the owner's name but never
    // the owner's role, so nothing owner-only renders as if it were theirs.
    currentProfile:
      preview.kind === "user" && preview.subjectProfile
        ? preview.subjectProfile
        : {
            ...data.currentProfile,
            app_role: "member",
            favorite_project_ids: [],
          },
    projects,
    categories: data.categories,
    tasks,
    subtasks: data.subtasks.filter((item) => visibleTaskIds.has(item.task_id)),
    comments: data.comments.filter((item) => visibleTaskIds.has(item.task_id)),
    activity: data.activity.filter(
      (item) => !item.task_id || visibleTaskIds.has(item.task_id),
    ),
    attachments: data.attachments.filter((item) =>
      visibleTaskIds.has(item.task_id),
    ),
    taskAssignees: data.taskAssignees.filter((item) =>
      visibleTaskIds.has(item.task_id),
    ),
    taskLabels: data.taskLabels.filter((item) =>
      visibleTaskIds.has(item.task_id),
    ),
    taskCategories: data.taskCategories.filter((item) =>
      visibleTaskIds.has(item.task_id),
    ),
    projectOwners: data.projectOwners.filter((item) =>
      visibleProjectIds.has(item.project_id),
    ),
    categoryOwners: data.categoryOwners.filter((item) =>
      visibleCategoryIds.has(item.category_id),
    ),
  };
}

// Standalone important dates may be workspace-wide or scoped to a project or a
// category. Time away stays visible so the team can see who is unavailable.
export function calendarEventsForPreview(
  events: CalendarEvent[],
  preview: AccessPreview,
  projectIds: string[],
): CalendarEvent[] {
  const visibleProjectIds = new Set(projectIds);
  const accessibleCategoryIds = preview.accessibleCategoryIds
    ? new Set(preview.accessibleCategoryIds)
    : null;
  return events.filter((event) => {
    if (event.kind === "away") return true;
    if (event.project_id && !visibleProjectIds.has(event.project_id))
      return false;
    return !(
      event.category_id &&
      accessibleCategoryIds &&
      !accessibleCategoryIds.has(event.category_id)
    );
  });
}

// Notes filed under a work group follow that group's access; an unfiled note
// stays workspace-wide, like a projectless task.
export function notesForPreview(notes: Note[], preview: AccessPreview): Note[] {
  if (!preview.accessibleCategoryIds) return notes;
  const accessibleCategoryIds = new Set(preview.accessibleCategoryIds);
  return notes.filter(
    (note) => !note.category_id || accessibleCategoryIds.has(note.category_id),
  );
}
