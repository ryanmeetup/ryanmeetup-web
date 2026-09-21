"use client";

import { useEffect } from "react";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import type { ResolvedTaskFilters } from "@/hooks/useResolvedTaskFilters";
import { useInstancePageTitle } from "@/components/global";

/**
 * Names what the viewer is currently looking at. The selected project or
 * category supplies the scope, "My Tasks" is layered on when the assignee
 * filter narrows to the viewer, and the result drives both the header and the
 * browser tab title.
 */
export function useTaskScope({
  data,
  resolved,
  visibility,
}: {
  data: WorkspaceData;
  resolved: Pick<
    ResolvedTaskFilters,
    "selectedAssignee" | "selectedCategory" | "selectedProject"
  >;
  visibility: "active" | "archived";
}) {
  const { selectedAssignee, selectedCategory, selectedProject } = resolved;
  const viewingAsGroup = data.accessPreview?.kind === "group";
  const myTasksProfile =
    data.accessPreview?.kind === "user"
      ? data.profiles.find(
          (profile) => profile.id === data.accessPreview?.subjectId,
        )
      : data.currentProfile;
  const myTasksName =
    myTasksProfile?.full_name ?? data.accessPreview?.subjectName ?? "";
  const isMyTasks =
    !viewingAsGroup && selectedAssignee?.id === myTasksProfile?.id;
  const scopeName = selectedProject?.name ?? selectedCategory?.name;
  const scopeDescription =
    selectedProject?.description ?? selectedCategory?.description;
  const taskScopeTitle = scopeName
    ? `${scopeName}${isMyTasks ? " · My Tasks" : ""}`
    : isMyTasks
      ? "My Tasks"
      : "All Tasks";
  const pageTitle = useInstancePageTitle();
  // The tab title has only text to work with, so it keeps the archived suffix.
  // The on-page heading shows a badge beside the plain name instead.
  const documentTitle =
    visibility === "archived" ? `${taskScopeTitle} · Archived` : taskScopeTitle;
  useEffect(() => {
    document.title = pageTitle(documentTitle);
  }, [pageTitle, documentTitle]);

  return {
    isMyTasks,
    myTasksName,
    scopeDescription,
    viewTitle: taskScopeTitle,
    viewingAsGroup,
  };
}
