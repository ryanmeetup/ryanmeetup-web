import { profileDisplayName } from "@/lib/presentation";
import { projectStatusOptions } from "@/lib/resources/project-status";
import { TASK_MOVE_ACTION } from "./activity-events";
import { taskActivityLabel, taskStatusChange } from "./task-activity";
import {
  taskActivityChanges,
  type TaskChangeDetail,
} from "./task-change-presentation";
import type { Profile } from "@/lib/workspace/workspace-types";
import type { Category, Project } from "@/lib/resources/resource-types";
import type { Status, Task } from "@/lib/tasks/task-types";
import type { TaskActivity } from "./activity-types";

export type ActivityDescription =
  | { kind: "text"; label: string; detail?: string }
  | { kind: "status"; from?: Status; to?: Status }
  | {
      kind: "project-status";
      from: { name: string; color: string };
      to: { name: string; color: string };
      detail?: string;
    }
  | { kind: "changes"; label: string; changes: TaskChangeDetail[] };

export type ActivityPresentationRow = {
  item: TaskActivity;
  actor?: Profile;
  actorName: string;
  task?: Task;
  project?: Project;
  category?: Category;
  resourceName?: string;
  resourceHref?: string;
  changes: TaskChangeDetail[];
  description: ActivityDescription;
};

export type ActivityPresentationGroup = {
  date: string;
  label: string;
  rows: ActivityPresentationRow[];
};

/**
 * The part of an event that names the thing it happened to, when that is not
 * the resource in the "Item" column: the file a resource attachment carries,
 * or the people an owner or membership change added and removed. Without it a
 * row reads "Project attachment added -- Fall Launch" and never says which
 * file, and an owner change says only that something changed.
 */
export function activityDetail(item: TaskActivity) {
  const { detail, attachment_name: attachmentName } = item.details;
  return typeof detail === "string" && detail
    ? detail
    : typeof attachmentName === "string" && attachmentName
      ? attachmentName
      : undefined;
}

function projectStatusChange(detail: string) {
  const parts = detail.split("; ");
  const statusIndex = parts.findIndex((part) => part.startsWith("Status: "));
  if (statusIndex < 0) return;

  const match = /^Status: (.+?)\s*→\s*(.+)$/.exec(parts[statusIndex]);
  if (!match) return;
  const statusFor = (name: string) =>
    projectStatusOptions.find(
      (option) => option.label.toLowerCase() === name.trim().toLowerCase(),
    );
  const from = statusFor(match[1]);
  const to = statusFor(match[2]);
  if (!from || !to) return;

  return {
    kind: "project-status" as const,
    from: { name: from.label, color: from.color },
    to: { name: to.label, color: to.color },
    detail:
      parts.filter((_, index) => index !== statusIndex).join("; ") ||
      undefined,
  };
}

export function describeActivity(
  item: TaskActivity,
  statuses: Status[],
  changes: TaskChangeDetail[] = [],
): ActivityDescription {
  if (item.action !== TASK_MOVE_ACTION) {
    const label = taskActivityLabel(item.action);
    const detail = activityDetail(item);
    if (item.action === "project.update" && detail) {
      const statusChange = projectStatusChange(detail);
      if (statusChange) return statusChange;
    }
    return changes.length
      ? { kind: "changes", label, changes }
      : { kind: "text", label, detail };
  }
  const { from, to } = taskStatusChange(item, statuses);
  if (!from && !to) return { kind: "text", label: "Task moved" };
  return { kind: "status", from, to };
}

export function resolveActivityRows(
  activity: TaskActivity[],
  data: {
    tasks: Task[];
    profiles: Profile[];
    projects: Project[];
    categories: Category[];
    statuses: Status[];
  },
): ActivityPresentationRow[] {
  const tasks = new Map(data.tasks.map((task) => [task.id, task]));
  const profiles = new Map(
    data.profiles.map((profile) => [profile.id, profile]),
  );
  const projects = new Map(
    data.projects.map((project) => [project.id, project]),
  );
  const categories = new Map(
    data.categories.map((category) => [category.id, category]),
  );
  return activity.map((item) => {
    const changes = taskActivityChanges(item, data);
    const task = item.task_id ? tasks.get(item.task_id) : undefined;
    const actor = item.actor_id ? profiles.get(item.actor_id) : undefined;
    const category = item.action.startsWith("category.")
      ? ((typeof item.details.resource_id === "string"
          ? categories.get(item.details.resource_id)
          : undefined) ??
        data.categories.find(
          (candidate) => candidate.name === item.details.resource_name,
        ))
      : undefined;
    return {
      item,
      actor,
      actorName: actor ? profileDisplayName(actor) : "System",
      task,
      project: task?.project_id
        ? projects.get(task.project_id)
        : item.details.project_id
          ? projects.get(item.details.project_id)
          : undefined,
      category,
      resourceName: item.details.resource_name,
      resourceHref: item.details.resource_href,
      changes,
      description: describeActivity(item, data.statuses, changes),
    };
  });
}

export function groupActivityByDate(
  rows: ActivityPresentationRow[],
  locale = "en-US",
  timeZone?: string,
): ActivityPresentationGroup[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone,
  });
  const groups = new Map<string, ActivityPresentationGroup>();
  for (const row of rows) {
    const date = new Date(row.item.created_at);
    const keyFormatter = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone,
    });
    const key = keyFormatter.format(date);
    const group = groups.get(key) ?? {
      date: key,
      label: formatter.format(date),
      rows: [],
    };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()];
}
