"use client";

import { useCallback, useMemo } from "react";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import type { TaskFiltersState } from "@/hooks/useTaskFilters";
import type { TaskQueryFilters } from "@/lib/tasks/task-query";
import {
  resolveCategoryTagFilters,
  resolveDueFilterValues,
  resolveEntityFilterIds,
  resolvePriorityFilterValues,
  resolveProfileFilterIds,
} from "@/lib/tasks/task-filter-values";

export type ResolvedTaskFilters = ReturnType<typeof useResolvedTaskFilters>;

/**
 * Turns the readable filter strings held in the URL into the workspace ids the
 * board, the list, and the tasks API all expect, alongside the lookup maps and
 * the singular selections the header renders from.
 */
export function useResolvedTaskFilters(
  data: WorkspaceData,
  filters: TaskFiltersState,
) {
  const profiles = useMemo(
    () => new Map(data.profiles.map((item) => [item.id, item])),
    [data.profiles],
  );
  const categories = useMemo(
    () => new Map(data.categories.map((item) => [item.id, item])),
    [data.categories],
  );
  const accessibleCategoryIds = useMemo(
    () =>
      data.accessPreview?.accessibleCategoryIds
        ? new Set(data.accessPreview.accessibleCategoryIds)
        : null,
    [data.accessPreview],
  );
  const accessibleCategories = useMemo(
    () =>
      accessibleCategoryIds
        ? data.categories.filter((item) => accessibleCategoryIds.has(item.id))
        : data.categories,
    [accessibleCategoryIds, data.categories],
  );
  const statuses = useMemo(
    () => [...data.statuses].sort((a, b) => a.sort_order - b.sort_order),
    [data.statuses],
  );
  const projects = useMemo(
    () => new Map(data.projects.map((item) => [item.id, item])),
    [data.projects],
  );
  const includedAssigneeIds = resolveProfileFilterIds(
    filters.assignee,
    data.profiles,
    true,
  );
  const excludedAssigneeIds = resolveProfileFilterIds(
    filters.excludedAssignees,
    data.profiles,
    true,
  );
  const includedReporterIds = resolveProfileFilterIds(
    filters.reporter,
    data.profiles,
  );
  const excludedReporterIds = resolveProfileFilterIds(
    filters.excludedReporters,
    data.profiles,
  );
  const selectedAssignee = profiles.get(includedAssigneeIds[0] ?? "") ?? null;
  const selectedReporter = profiles.get(includedReporterIds[0] ?? "") ?? null;
  const requestedCategory =
    filters.group === "all"
      ? null
      : (categories.get(filters.group) ??
        data.categories.find((item) => item.name === filters.group));
  const selectedCategory =
    requestedCategory &&
    (!accessibleCategoryIds || accessibleCategoryIds.has(requestedCategory.id))
      ? requestedCategory
      : null;
  const includedCategoryIds = useMemo(() => {
    const ids = filters.includedCategories
      .split(",")
      .filter(Boolean)
      .flatMap((value) => {
        const category =
          categories.get(value) ??
          data.categories.find((item) => item.name === value);
        return category &&
          (!accessibleCategoryIds || accessibleCategoryIds.has(category.id))
          ? [category.id]
          : [];
      });
    if (selectedCategory && !ids.includes(selectedCategory.id))
      ids.push(selectedCategory.id);
    return ids;
  }, [
    accessibleCategoryIds,
    categories,
    data.categories,
    filters.includedCategories,
    selectedCategory,
  ]);
  const excludedCategoryIds = useMemo(
    () =>
      filters.excludedCategories
        .split(",")
        .filter(Boolean)
        .flatMap((value) => {
          const category =
            categories.get(value) ??
            data.categories.find((item) => item.name === value);
          return category &&
            (!accessibleCategoryIds || accessibleCategoryIds.has(category.id))
            ? [category.id]
            : [];
        }),
    [
      accessibleCategoryIds,
      categories,
      data.categories,
      filters.excludedCategories,
    ],
  );
  const categoryNames = useCallback(
    (ids: string[]) =>
      ids
        .flatMap((id) => {
          const category = categories.get(id);
          return category ? [category.name] : [];
        })
        .join(","),
    [categories],
  );
  const includedProjectIds = resolveEntityFilterIds(
    filters.project,
    data.projects,
    true,
  );
  const excludedProjectIds = resolveEntityFilterIds(
    filters.excludedProjects,
    data.projects,
    true,
  );
  const includedStatusIds = resolveEntityFilterIds(
    filters.status,
    data.statuses,
  );
  const excludedStatusIds = resolveEntityFilterIds(
    filters.excludedStatuses,
    data.statuses,
  );
  const includedPriorityValues = resolvePriorityFilterValues(filters.priority);
  const excludedPriorityValues = resolvePriorityFilterValues(
    filters.excludedPriorities,
  );
  const includedDueValues = resolveDueFilterValues(filters.dueWithin);
  const excludedDueValues = resolveDueFilterValues(filters.excludedDueWithin);
  const includedTagFilters = resolveCategoryTagFilters(
    filters.tags,
    data.categories,
  );
  const excludedTagFilters = resolveCategoryTagFilters(
    filters.excludedTags,
    data.categories,
  );
  const selectedProject = projects.get(includedProjectIds[0] ?? "") ?? null;
  const selectedProjectOwners = selectedProject
    ? data.projectOwners
        .filter((item) => item.project_id === selectedProject.id)
        .flatMap((item) => {
          const profile = data.profiles.find(
            (candidate) => candidate.id === item.profile_id,
          );
          return profile ? [profile] : [];
        })
    : [];
  const selectedStatus =
    data.statuses.find((item) => item.id === includedStatusIds[0]) ?? null;
  const selectedPriority = includedPriorityValues[0] ?? null;
  const queryFilters: TaskQueryFilters = {
    statuses: includedStatusIds,
    excludedStatuses: excludedStatusIds,
    projects: includedProjectIds,
    excludedProjects: excludedProjectIds,
    assignees: includedAssigneeIds,
    excludedAssignees: excludedAssigneeIds,
    reporters: includedReporterIds,
    excludedReporters: excludedReporterIds,
    categories: includedCategoryIds,
    excludedCategories: excludedCategoryIds,
    priorities: includedPriorityValues,
    excludedPriorities: excludedPriorityValues,
    dueWithin: includedDueValues,
    excludedDueWithin: excludedDueValues,
    tags: includedTagFilters,
    excludedTags: excludedTagFilters,
  };

  return {
    accessibleCategories,
    accessibleCategoryIds,
    categories,
    categoryNames,
    excludedAssigneeIds,
    excludedCategoryIds,
    excludedDueValues,
    excludedPriorityValues,
    excludedProjectIds,
    excludedReporterIds,
    excludedStatusIds,
    excludedTagFilters,
    includedAssigneeIds,
    includedCategoryIds,
    includedDueValues,
    includedPriorityValues,
    includedProjectIds,
    includedReporterIds,
    includedStatusIds,
    includedTagFilters,
    profiles,
    projects,
    queryFilters,
    selectedAssignee,
    selectedCategory,
    selectedPriority,
    selectedProject,
    selectedProjectOwners,
    selectedReporter,
    selectedStatus,
    statuses,
  };
}

/**
 * The badge count on the filter button. An assignee filter that only narrows to
 * the viewer is already spelled out by the "My Tasks" title, so it is not
 * counted twice, and neither is the archive: it is a switch in the header with
 * its own visible state rather than something hidden inside the panel.
 */
export function countResolvedTaskFilters(
  resolved: ResolvedTaskFilters,
  { isMyTasks }: { isMyTasks: boolean },
) {
  return (
    (isMyTasks ? 0 : resolved.includedAssigneeIds.length) +
    resolved.excludedAssigneeIds.length +
    resolved.includedReporterIds.length +
    resolved.excludedReporterIds.length +
    resolved.includedProjectIds.length +
    resolved.excludedProjectIds.length +
    resolved.includedStatusIds.length +
    resolved.excludedStatusIds.length +
    resolved.includedPriorityValues.length +
    resolved.excludedPriorityValues.length +
    resolved.includedCategoryIds.length +
    resolved.excludedCategoryIds.length +
    resolved.includedDueValues.length +
    resolved.excludedDueValues.length +
    resolved.includedTagFilters.length +
    resolved.excludedTagFilters.length
  );
}
