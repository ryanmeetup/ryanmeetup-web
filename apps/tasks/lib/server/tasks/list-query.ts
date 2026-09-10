import { parsePagination } from "../../pagination";
import { isUuid } from "@/lib/api-schema/shared";
import { parseCategoryTagFilterValue } from "@/lib/tasks/task-filter-values";
import type { TaskAssignee } from "@/lib/tasks/task-types";

const dateValue = (date: Date) => date.toISOString().slice(0, 10);

export const TASK_EXACT_FILTERS = [
  ["status", "excludeStatuses", "status_id"],
  ["project", "excludeProjects", "project_id"],
  ["reporter", "excludeReporters", "reported_by"],
  ["priority", "excludePriorities", "priority"],
] as const;

export function resolveAssigneeTaskFilters(
  rows: TaskAssignee[],
  includedAssigneeIds: string[],
  excludedAssigneeIds: string[],
) {
  const assignedTaskIds = [...new Set(rows.map((row) => row.task_id))];
  const taskIdsFor = (profileIds: string[]) => [
    ...new Set(
      rows
        .filter((row) => profileIds.includes(row.profile_id))
        .map((row) => row.task_id),
    ),
  ];
  const includedAssigneeTaskIds = taskIdsFor(includedAssigneeIds);
  return {
    assignedTaskIds,
    includedAssigneeTaskIds,
    excludedAssigneeTaskIds: taskIdsFor(excludedAssigneeIds),
    assignedWithoutIncludedAssignee: assignedTaskIds.filter(
      (taskId) => !includedAssigneeTaskIds.includes(taskId),
    ),
  };
}

/** The orders `GET /api/tasks` can ask Postgres for. */
function taskListSort(value: string | null): "due" | "closed" | "updated" {
  if (value === "due") return "due";
  if (value === "closed") return "closed";
  return "updated";
}

export function parseTaskListQuery(params: URLSearchParams, now = new Date()) {
  const parseAssigneeIds = (name: string) =>
    (params.get(name) ?? "").split(",").filter(isUuid);
  const parseCategoryIds = (name: string) =>
    (params.get(name) ?? "").split(",").filter(isUuid);
  const includedCategoryIds = parseCategoryIds("categories");
  const legacyCategory = params.get("category");
  if (isUuid(legacyCategory)) includedCategoryIds.push(legacyCategory);
  const parseDueDays = (name: string) =>
    (params.get(name) ?? "")
      .split(",")
      .filter((value) => ["7", "14", "30"].includes(value))
      .map(Number);
  const dueWithinDays = Math.max(...parseDueDays("dueWithin"), 0) || null;
  const excludedDueDays =
    Math.max(...parseDueDays("excludeDueWithin"), 0) || null;
  const rawSearch = params.get("search")?.trim() ?? "";
  const parseTags = (name: string) =>
    (params.get(name) ?? "").split(",").flatMap((value) => {
      const filter = parseCategoryTagFilterValue(value);
      return filter && isUuid(filter.categoryId) ? [filter] : [];
    });
  const { requestedPage, pageSize } = parsePagination(params);
  return {
    visibility: params.get("visibility") === "archived" ? "archived" : "active",
    boundary: now.toISOString(),
    includedCategoryIds,
    excludedCategoryIds: parseCategoryIds("excludeCategories"),
    includedAssigneeIds: parseAssigneeIds("assignee"),
    excludedAssigneeIds: parseAssigneeIds("excludeAssignees"),
    includeUnassigned: (params.get("assignee") ?? "")
      .split(",")
      .includes("unassigned"),
    excludeUnassigned: (params.get("excludeAssignees") ?? "")
      .split(",")
      .includes("unassigned"),
    paginated: params.get("paginated") === "1",
    requestedPage,
    pageSize,
    // Only the orders the database can apply. Priority is a client-side sort,
    // so it arrives here as the default and is reordered after the page loads.
    sort: taskListSort(params.get("sort")),
    dueWithinDays,
    excludedDueDays,
    hasDueWithinFilter: dueWithinDays !== null,
    today: dateValue(now),
    dueBoundary: dateValue(
      new Date(now.getTime() + (dueWithinDays ?? 0) * 86_400_000),
    ),
    excludedDueBoundary: dateValue(
      new Date(now.getTime() + (excludedDueDays ?? 0) * 86_400_000),
    ),
    rawSearch,
    search: rawSearch.replaceAll(/[%,()]/g, ""),
    includedTags: parseTags("tags"),
    excludedTags: parseTags("excludeTags"),
  } as const;
}
