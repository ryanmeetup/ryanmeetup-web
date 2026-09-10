import type { Status } from "@/lib/tasks/task-types";
import type { TaskActivity } from "@/lib/activity/activity-types";
import { TASK_MOVE_ACTION } from "@/lib/activity/activity-events";

export function taskStatusChangesForTasks(
  activity: TaskActivity[],
  taskIds: ReadonlySet<string>,
) {
  return activity.filter(
    (item) =>
      item.action === TASK_MOVE_ACTION &&
      item.task_id !== null &&
      taskIds.has(item.task_id),
  );
}

export function taskStatusChange<
  T extends Pick<Status, "id" | "name" | "color">,
>(
  item: TaskActivity,
  statuses: T[],
) {
  const fromId =
    typeof item.details.from_status_id === "string"
      ? item.details.from_status_id
      : null;
  const toId =
    typeof item.details.status_id === "string" ? item.details.status_id : null;
  return {
    from: statuses.find((status) => status.id === fromId),
    to: statuses.find((status) => status.id === toId),
  };
}

export function taskActivityLabel(action: string) {
  const workspaceLabels: Record<string, string> = {
    "note.create": "Note created",
    "note.update": "Note updated",
    "note.archive": "Note archived",
    "note.restore": "Note restored",
    "note.delete": "Note deleted",
    "note.convert": "Note converted to a task",
    "note.comment": "Comment added to note",
    "note.comment.update": "Comment on note edited",
    "note.comment.delete": "Comment on note deleted",
    "organization.create": "Contact created",
    "organization.update": "Contact updated",
    "organization.delete": "Contact deleted",
    "organization.person.add": "Person added to contact",
    "organization.person.update": "Person updated on contact",
    "organization.person.remove": "Person removed from contact",
    "organization.categories.update": "Contact categories changed",
    "contact_category.create": "Contact category created",
    "project.create": "Project created",
    "project.update": "Project updated",
    "project.archive": "Project archived",
    "project.restore": "Project restored",
    "project.delete": "Project deleted",
    "project.owners.update": "Project owners changed",
    "project.access.update": "Project access changed",
    "project.attachment.add": "Project attachment added",
    "project.attachment.update": "Project attachment edited",
    "project.attachment.delete": "Project attachment removed",
    "category.create": "Category created",
    "category.update": "Category updated",
    "category.archive": "Category archived",
    "category.restore": "Category restored",
    "category.delete": "Category deleted",
    "category.owners.update": "Category owners changed",
    "category.access.update": "Category access changed",
    "workspace_area.access.update": "Page access changed",
    "category.attachment.add": "Category attachment added",
    "category.attachment.update": "Category attachment edited",
    "category.attachment.delete": "Category attachment removed",
    "calendar.create": "Calendar event created",
    "calendar.update": "Calendar event updated",
    "calendar.delete": "Calendar event deleted",
    "status.create": "Status created",
    "status.update": "Status updated",
    "status.reorder": "Statuses reordered",
    "status.delete": "Status deleted",
    "access_group.create": "Access group created",
    "access_group.update": "Access group updated",
    "access_group.delete": "Access group deleted",
    "team.invite": "Teammate invited",
    "team.remove": "Teammate removed",
    "settings.instance.update": "Workspace settings updated",
    "settings.logo.update": "Workspace logo updated",
    "digest.settings.update": "Digest settings updated",
    "digest.run": "Digest sent",
    "email.cancel": "Scheduled email cancelled",
    "email.delay": "Scheduled email delayed",
    "integration.google-calendar.connect": "Google Calendar connected",
    "integration.google-calendar.disconnect": "Google Calendar disconnected",
    "task.delete": "Task deleted",
  };
  if (workspaceLabels[action]) return workspaceLabels[action];
  if (action === "created the task") return "Task created";
  if (action === "updated the task") return "Task updated";
  if (action.startsWith("added checklist item"))
    return action.replace("added checklist item", "Checklist item added");
  const pastedChecklist = /^added (\d+) checklist items$/.exec(action);
  if (pastedChecklist) {
    const count = Number(pastedChecklist[1]);
    return `${count} checklist item${count === 1 ? "" : "s"} added`;
  }
  if (action.startsWith("attached "))
    return action.replace("attached ", "Attachment added: ");
  if (action.startsWith("removed attachment "))
    return action.replace("removed attachment ", "Attachment removed: ");
  return action.charAt(0).toUpperCase() + action.slice(1);
}
