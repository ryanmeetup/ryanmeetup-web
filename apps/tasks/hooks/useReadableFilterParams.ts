"use client";

import { useEffect } from "react";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import type { TaskFiltersState } from "@/hooks/useTaskFilters";
import type { ResolvedTaskFilters } from "@/hooks/useResolvedTaskFilters";
import { profileDisplayName } from "@/lib/presentation";
import { readableTaskFilterValue } from "@/lib/tasks/task-filter-values";

/** Normalize legacy IDs without dropping multi-selections or ambiguous IDs. */
export function useReadableFilterParams({
  data,
  filters,
  resolved,
}: {
  data: WorkspaceData;
  filters: TaskFiltersState;
  resolved: ResolvedTaskFilters;
}) {
  useEffect(() => {
    const profileValue = (id: string) =>
      id === "unassigned"
        ? "Unassigned"
        : readableTaskFilterValue(id, data.profiles, profileDisplayName);
    const projectValue = (id: string) =>
      id === "none"
        ? id
        : readableTaskFilterValue(id, data.projects, (item) => item.name);
    const categoryValue = (id: string) =>
      readableTaskFilterValue(id, data.categories, (item) => item.name);
    const statusValue = (id: string) =>
      readableTaskFilterValue(id, data.statuses, (item) => item.name);
    const priorityValue = (value: string) =>
      value[0].toUpperCase() + value.slice(1);
    const mappings: [
      string,
      string[],
      (value: string) => void,
      (id: string) => string,
    ][] = [
      [
        filters.assignee,
        resolved.includedAssigneeIds,
        filters.setAssignee,
        profileValue,
      ],
      [
        filters.excludedAssignees,
        resolved.excludedAssigneeIds,
        filters.setExcludedAssignees,
        profileValue,
      ],
      [
        filters.reporter,
        resolved.includedReporterIds,
        filters.setReporter,
        profileValue,
      ],
      [
        filters.excludedReporters,
        resolved.excludedReporterIds,
        filters.setExcludedReporters,
        profileValue,
      ],
      [
        filters.project,
        resolved.includedProjectIds,
        filters.setProject,
        projectValue,
      ],
      [
        filters.excludedProjects,
        resolved.excludedProjectIds,
        filters.setExcludedProjects,
        projectValue,
      ],
      [
        filters.includedCategories,
        resolved.includedCategoryIds,
        filters.setIncludedCategories,
        categoryValue,
      ],
      [
        filters.excludedCategories,
        resolved.excludedCategoryIds,
        filters.setExcludedCategories,
        categoryValue,
      ],
      [
        filters.status,
        resolved.includedStatusIds,
        filters.setStatus,
        statusValue,
      ],
      [
        filters.excludedStatuses,
        resolved.excludedStatusIds,
        filters.setExcludedStatuses,
        statusValue,
      ],
      [
        filters.priority,
        resolved.includedPriorityValues,
        filters.setPriority,
        priorityValue,
      ],
    ];
    for (const [current, values, setValue, readable] of mappings) {
      if (!current || current === "all") continue;
      const next = values.map(readable).join(",");
      if (current !== next) setValue(next);
    }
    if (filters.group !== "all" && resolved.selectedCategory) {
      const next = categoryValue(resolved.selectedCategory.id);
      if (filters.group !== next) filters.setGroup(next);
    }
  }, [data, filters, resolved]);
}
