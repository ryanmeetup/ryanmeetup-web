"use client";

import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import type { TaskFiltersState } from "@/hooks/useTaskFilters";
import type { ResolvedTaskFilters } from "@/hooks/useResolvedTaskFilters";
import { TaskFilters } from "./TaskFilters";
import { profileDisplayName } from "@/lib/presentation";
import {
  categoryTagFilterValue,
  parseCategoryTagFilterValue,
} from "@/lib/tasks/task-filter-values";

/**
 * Adapts the resolved id-based filter state back into the readable URL values
 * TaskFilters edits. Selections arrive here as workspace ids and leave as the
 * names a person would recognize in a shared link.
 */
export function TaskFilterBar({
  data,
  filters,
  resolved,
  filterCount,
}: {
  data: WorkspaceData;
  filters: TaskFiltersState;
  resolved: ResolvedTaskFilters;
  filterCount: number;
}) {
  const {
    accessibleCategories,
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
    selectedCategory,
    statuses,
  } = resolved;

  return (
    <TaskFilters
      options={{
        categories: accessibleCategories,
        currentProfileId: data.currentProfile.id,
        favoriteProjectIds: data.currentProfile.favorite_project_ids ?? [],
        profiles: data.profiles,
        projects: data.projects,
        statuses,
      }}
      controller={{
        count: filterCount,
        categories: {
          included: includedCategoryIds,
          excluded: excludedCategoryIds,
        },
        selections: {
          assignee: {
            included: includedAssigneeIds,
            excluded: excludedAssigneeIds,
          },
          reporter: {
            included: includedReporterIds,
            excluded: excludedReporterIds,
          },
          project: {
            included: includedProjectIds,
            excluded: excludedProjectIds,
          },
          status: {
            included: includedStatusIds,
            excluded: excludedStatusIds,
          },
          priority: {
            included: includedPriorityValues,
            excluded: excludedPriorityValues,
          },
          dueWithin: {
            included: includedDueValues,
            excluded: excludedDueValues,
          },
          tag: {
            included: includedTagFilters.map(categoryTagFilterValue),
            excluded: excludedTagFilters.map(categoryTagFilterValue),
          },
        },
        clear: filters.clear,
        setCategories: (kind, ids) => {
          if (kind === "included") {
            filters.setGroup("all");
            filters.setIncludedCategories(categoryNames(ids));
            filters.setExcludedCategories(
              categoryNames(
                excludedCategoryIds.filter((id) => !ids.includes(id)),
              ),
            );
            return;
          }
          filters.setExcludedCategories(categoryNames(ids));
          filters.setIncludedCategories(
            categoryNames(
              includedCategoryIds.filter((id) => !ids.includes(id)),
            ),
          );
          if (selectedCategory && ids.includes(selectedCategory.id))
            filters.setGroup("all");
        },
        setSelection: (filter, kind, values) => {
          const readableValues = values.map((value) => {
            if (filter === "assignee" || filter === "reporter")
              return value === "unassigned"
                ? "Unassigned"
                : profileDisplayName(profiles.get(value));
            if (filter === "project")
              return value === "none"
                ? value
                : (projects.get(value)?.name ?? value);
            if (filter === "status")
              return (
                data.statuses.find((item) => item.id === value)?.name ?? value
              );
            if (filter === "tag") {
              const parsed = parseCategoryTagFilterValue(value);
              const category = parsed
                ? categories.get(parsed.categoryId)
                : undefined;
              return parsed && category
                ? `${category.name}: ${parsed.tag}`
                : value;
            }
            return value;
          });
          const value = readableValues.length
            ? readableValues.join(",")
            : kind === "included"
              ? "all"
              : "";
          const setters = {
            assignee:
              kind === "included"
                ? filters.setAssignee
                : filters.setExcludedAssignees,
            reporter:
              kind === "included"
                ? filters.setReporter
                : filters.setExcludedReporters,
            project:
              kind === "included"
                ? filters.setProject
                : filters.setExcludedProjects,
            status:
              kind === "included"
                ? filters.setStatus
                : filters.setExcludedStatuses,
            priority:
              kind === "included"
                ? filters.setPriority
                : filters.setExcludedPriorities,
            dueWithin:
              kind === "included"
                ? filters.setDueWithin
                : filters.setExcludedDueWithin,
            tag:
              kind === "included" ? filters.setTags : filters.setExcludedTags,
          };
          setters[filter](value);
        },
      }}
    />
  );
}
