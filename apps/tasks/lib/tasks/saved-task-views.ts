import type { TaskQueryFilters } from "./task-query";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { profileDisplayName } from "@/lib/presentation";
import {
  categoryTagFilterValue,
  readableTaskFilterValue,
} from "./task-filter-values";

export type SavedTaskViewSettings = {
  version: 1;
  filters: TaskQueryFilters;
  view: "board" | "list";
  sort: string;
  visibility: "active" | "archived";
};

export type SavedTaskView = {
  id: string;
  name: string;
  settings: SavedTaskViewSettings;
};

export type SavedTaskViewsState = {
  views: SavedTaskView[];
  available: boolean;
};

export const savedViewNameMaxLength = 80;

/** Resource IDs survive renames; only the applied browser URL uses names. */
export function normalizeSavedViewSettings(
  settings: SavedTaskViewSettings,
): SavedTaskViewSettings {
  const filters = { ...settings.filters };
  for (const key of Object.keys(filters) as (keyof TaskQueryFilters)[]) {
    if (key === "tags" || key === "excludedTags") {
      filters[key] = [
        ...new Map(
          filters[key].map((tag) => [categoryTagFilterValue(tag), tag]),
        ).values(),
      ].sort((a, b) =>
        categoryTagFilterValue(a).localeCompare(categoryTagFilterValue(b)),
      );
    } else {
      // All other filter dimensions are sets of strings, including priority.
      Object.assign(filters, { [key]: [...new Set(filters[key])].sort() });
    }
  }
  return {
    version: 1,
    filters,
    view: settings.visibility === "archived" ? "list" : settings.view,
    sort: settings.sort,
    visibility: settings.visibility,
  };
}

export function savedViewSettingsEqual(
  a: SavedTaskViewSettings,
  b: SavedTaskViewSettings,
) {
  const normalizedA = normalizeSavedViewSettings(a);
  const normalizedB = normalizeSavedViewSettings(b);
  return (
    normalizedA.view === normalizedB.view &&
    normalizedA.sort === normalizedB.sort &&
    normalizedA.visibility === normalizedB.visibility &&
    (Object.keys(normalizedA.filters) as (keyof TaskQueryFilters)[]).every(
      (key) =>
        JSON.stringify(normalizedA.filters[key]) ===
        JSON.stringify(normalizedB.filters[key]),
    )
  );
}

type ViewResources = Pick<
  WorkspaceData,
  "categories" | "projects" | "profiles" | "statuses"
>;

const dimensions = [
  ["assignees", "excludeAssignees", "assignee", "Assignee", "profiles"],
  ["reporters", "excludeReporters", "reporter", "Reporter", "profiles"],
  ["categories", "excludeCategories", "categories", "Category", "categories"],
  ["projects", "excludeProjects", "project", "Project", "projects"],
  ["statuses", "excludeStatuses", "status", "Status", "statuses"],
  ["priorities", "excludePriorities", "priority", "Priority", null],
  ["dueWithin", "excludeDueWithin", "dueWithin", "Due date", null],
] as const;

function resolveValue(
  id: string,
  resource: (typeof dimensions)[number][4],
  data: ViewResources,
) {
  if (!resource)
    return {
      label:
        id === "overdue"
          ? "Overdue"
          : ["7", "14", "30"].includes(id)
            ? `Next ${id} days`
            : id,
      value: id,
    };
  if (resource === "profiles" && id === "unassigned")
    return { label: "Unassigned", value: "Unassigned" };
  if (resource === "projects" && id === "none")
    return { label: "No project", value: "none" };
  const items = data[resource].map((candidate) => ({
    id: candidate.id,
    name:
      "full_name" in candidate ? profileDisplayName(candidate) : candidate.name,
  }));
  const item = items.find((candidate) => candidate.id === id);
  if (!item) return null;
  return {
    label: item.name,
    value: readableTaskFilterValue(id, items, (candidate) => candidate.name),
  };
}

/** A missing selection must never turn an include filter into "all". */
export function savedViewUnavailable(
  settings: SavedTaskViewSettings,
  data: ViewResources,
) {
  for (const [included, , , , resource] of dimensions) {
    const excludedKey =
      `excluded${included[0].toUpperCase()}${included.slice(1)}` as keyof TaskQueryFilters;
    if (
      [
        ...settings.filters[included],
        ...(settings.filters[excludedKey] as string[]),
      ].some((id) => !resolveValue(id, resource, data))
    )
      return true;
  }
  return [...settings.filters.tags, ...settings.filters.excludedTags].some(
    ({ categoryId, tag }) =>
      !data.categories
        .find((category) => category.id === categoryId)
        ?.tags.includes(tag),
  );
}

export function savedViewSummary(
  settings: SavedTaskViewSettings,
  data: ViewResources,
) {
  const rows: { label: string; value: string }[] = [];
  for (const [included, , , label, resource] of dimensions) {
    const excluded =
      `excluded${included[0].toUpperCase()}${included.slice(1)}` as keyof TaskQueryFilters;
    for (const [key, prefix] of [
      [included, "Include"],
      [excluded, "Exclude"],
    ] as const) {
      const values = settings.filters[key] as string[];
      if (values.length)
        rows.push({
          label: `${prefix} ${label.toLowerCase()}`,
          value: values
            .map(
              (id) =>
                resolveValue(id, resource, data)?.label ??
                "Unavailable selection",
            )
            .join(", "),
        });
    }
  }
  for (const [key, label] of [
    ["tags", "Include tags"],
    ["excludedTags", "Exclude tags"],
  ] as const) {
    if (settings.filters[key].length)
      rows.push({
        label,
        value: settings.filters[key]
          .map(
            ({ categoryId, tag }) =>
              `${data.categories.find((category) => category.id === categoryId)?.name ?? "Unavailable category"}: ${tag}`,
          )
          .join(", "),
      });
  }
  return rows;
}

const taskViewParams = [
  "category",
  "q",
  "page",
  "savedView",
  "view",
  "sort",
  "visibility",
  "tags",
  "excludeTags",
  ...dimensions.flatMap(([, excluded, included]) => [excluded, included]),
];

export function applySavedViewParams(
  current: URLSearchParams,
  saved: SavedTaskView | null,
  data: ViewResources,
) {
  if (saved && savedViewUnavailable(saved.settings, data))
    throw new Error(
      "This view has selections that are no longer available. Save a replacement view or delete it from Manage saved views.",
    );
  const params = new URLSearchParams(current);
  taskViewParams.forEach((key) => params.delete(key));
  if (!saved) return params;
  const { settings } = saved;
  params.set("savedView", saved.name);
  params.set("view", settings.view);
  params.set("sort", settings.sort);
  params.set("visibility", settings.visibility);
  for (const [
    included,
    excludedParam,
    includedParam,
    ,
    resource,
  ] of dimensions) {
    const excluded =
      `excluded${included[0].toUpperCase()}${included.slice(1)}` as keyof TaskQueryFilters;
    for (const [key, param] of [
      [included, includedParam],
      [excluded, excludedParam],
    ] as const) {
      const values = settings.filters[key] as string[];
      if (values.length)
        params.set(
          param,
          values.map((id) => resolveValue(id, resource, data)!.value).join(","),
        );
    }
  }
  for (const [key, param] of [
    ["tags", "tags"],
    ["excludedTags", "excludeTags"],
  ] as const) {
    if (settings.filters[key].length)
      params.set(
        param,
        settings.filters[key]
          .map((tag) => {
            const category = data.categories.find(
              (item) => item.id === tag.categoryId,
            )!;
            return !category.name.includes(",") &&
              !tag.tag.includes(",") &&
              data.categories.filter((item) => item.name === category.name)
                .length === 1
              ? `${category.name}: ${tag.tag}`
              : categoryTagFilterValue(tag);
          })
          .join(","),
      );
  }
  return params;
}

export const savedViewSortLabels: Record<string, string> = {
  updated: "Recently updated",
  due: "Due date",
  priority: "Priority",
  closed: "Recently closed",
  "closed-asc": "Oldest closed",
};
