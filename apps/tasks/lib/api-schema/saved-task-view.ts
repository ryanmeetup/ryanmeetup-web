import {
  normalizeSavedViewSettings,
  savedViewNameMaxLength,
  type SavedTaskViewSettings,
} from "@/lib/tasks/saved-task-views";
import { taskSorts } from "@/lib/tasks/task-view";
import { objectWithKeys, requiredTrimmedText } from "./shared";
import type { TaskQueryFilters } from "@/lib/tasks/task-query";

const stringFilters = [
  "statuses",
  "excludedStatuses",
  "projects",
  "excludedProjects",
  "assignees",
  "excludedAssignees",
  "reporters",
  "excludedReporters",
  "categories",
  "excludedCategories",
  "priorities",
  "excludedPriorities",
  "dueWithin",
  "excludedDueWithin",
] as const;

export function savedTaskViewSettingsSchema(
  value: unknown,
): SavedTaskViewSettings | null {
  const settings = objectWithKeys(value, [
    "version",
    "filters",
    "view",
    "sort",
    "visibility",
  ]);
  if (
    !settings ||
    settings.version !== 1 ||
    (settings.view !== "board" && settings.view !== "list") ||
    (settings.visibility !== "active" && settings.visibility !== "archived") ||
    typeof settings.sort !== "string" ||
    !taskSorts.includes(settings.sort)
  )
    return null;
  const filters = objectWithKeys(settings.filters, [
    ...stringFilters,
    "tags",
    "excludedTags",
  ]);
  if (!filters) return null;
  for (const key of stringFilters) {
    const values = filters[key];
    if (
      !Array.isArray(values) ||
      values.length > 100 ||
      values.some(
        (entry) =>
          typeof entry !== "string" || !entry.trim() || entry.length > 200,
      )
    )
      return null;
    if (
      (key === "priorities" || key === "excludedPriorities") &&
      values.some(
        (entry) => !["low", "medium", "high", "urgent"].includes(entry),
      )
    )
      return null;
    if (
      (key === "dueWithin" || key === "excludedDueWithin") &&
      values.some((entry) => !["overdue", "7", "14", "30"].includes(entry))
    )
      return null;
  }
  for (const key of ["tags", "excludedTags"]) {
    const values = filters[key];
    if (
      !Array.isArray(values) ||
      values.length > 100 ||
      values.some((entry) => {
        const tag = objectWithKeys(entry, ["categoryId", "tag"]);
        return (
          !tag ||
          !requiredTrimmedText(tag.categoryId, 200) ||
          !requiredTrimmedText(tag.tag, 200)
        );
      })
    )
      return null;
  }
  return normalizeSavedViewSettings({
    version: 1,
    filters: filters as TaskQueryFilters,
    view: settings.view as "board" | "list",
    sort: settings.sort,
    visibility: settings.visibility as "active" | "archived",
  });
}

export function savedTaskViewCreateSchema(value: unknown) {
  const body = objectWithKeys(value, ["name", "settings"]);
  const name = body && requiredTrimmedText(body.name, savedViewNameMaxLength);
  const settings = body && savedTaskViewSettingsSchema(body.settings);
  return name && settings ? { name, settings } : null;
}

export function savedTaskViewPatchSchema(value: unknown) {
  const body = objectWithKeys(value, ["name", "settings"]);
  if (!body || Object.keys(body).length === 0) return null;
  const name =
    body.name === undefined
      ? undefined
      : requiredTrimmedText(body.name, savedViewNameMaxLength);
  const settings =
    body.settings === undefined
      ? undefined
      : savedTaskViewSettingsSchema(body.settings);
  if (name === null || settings === null) return null;
  return {
    ...(name !== undefined ? { name } : {}),
    ...(settings !== undefined ? { settings } : {}),
  };
}
