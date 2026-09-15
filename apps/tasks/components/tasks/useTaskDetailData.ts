"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "@ryanmeetup/ui";
import { fetchTaskDetails } from "@/lib/tasks/task-detail-mutations";
import { errorMessage } from "@/lib/presentation";
import type { TaskReference } from "@/lib/tasks/task-types";
import type { TaskActivity } from "@/lib/activity/activity-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import type { TaskDetailContext } from "./task-detail-context";

type Section = "all" | "work" | "comment" | "activity";

/** Only these sections read anything the detail request returns. */
const loadsDetails = (section: Section) =>
  section === "all" || section === "activity";

/**
 * Loads a task's checklist, comments, attachments, and activity, and pages
 * through its activity history.
 *
 * The first page replaces this task's rows outright; later pages only append
 * activity, so paging back through history never discards the rest.
 */
export function useTaskDetailData({
  task,
  data,
  demoMode,
  setData,
  section,
}: Omit<TaskDetailContext, "recordActivity"> & { section: Section }) {
  // Which page is in flight: page 0 replaces the task's history, later pages
  // append to it, and the panel shows placeholders only for the former.
  const [loadingPage, setLoadingPage] = useState<number | null>(
    !demoMode && loadsDetails(section) ? 0 : null,
  );
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const activity = useMemo(
    () =>
      data.activity
        .filter((item) => item.task_id === task.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [data.activity, task.id],
  );

  async function load(nextPage = 0) {
    if (demoMode) return;
    setLoadingPage(nextPage);
    try {
      const result = await fetchTaskDetails(task.id, nextPage);
      if (nextPage === 0) setData(replaceTaskRows(task.id, result));
      setData(mergeActivity(task.id, result.activity));
      if (nextPage === 0) setData(visibleReferences(result.taskReferences));
      setPage(nextPage);
      setHasMore(result.activityPage.hasMore);
    } catch (error) {
      toast.error(errorMessage(error, "Task details could not be loaded."));
    } finally {
      setLoadingPage(null);
    }
  }

  /**
   * A reference to a task in a project the reader cannot see, or one the
   * access preview hides, must not leak through the detail panel.
   */
  function visibleReferences(references: TaskReference[]) {
    return (current: WorkspaceData): WorkspaceData => {
      const visibleProjectIds = new Set(
        current.projects.map((project) => project.id),
      );
      const inaccessible = new Set(
        current.accessPreview?.inaccessibleTaskIds ?? [],
      );
      return {
        ...current,
        taskReferences: references.filter(
          (reference) =>
            !inaccessible.has(reference.id) &&
            (reference.project_id === null ||
              visibleProjectIds.has(reference.project_id)),
        ),
      };
    };
  }

  useEffect(() => {
    if (!loadsDetails(section)) return;
    // Deferred a tick so opening a task paints before its details are fetched.
    const timer = window.setTimeout(() => void load(0), 0);
    return () => window.clearTimeout(timer);
    // Detail data is scoped to the selected task and loaded only when opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, demoMode, section]);

  return {
    activity,
    loading: loadingPage !== null,
    loadingFirstPage: loadingPage === 0,
    page,
    hasMore,
    loadMore: () => void load(page + 1),
  };
}

const replaceTaskRows =
  (
    taskId: string,
    result: {
      subtasks: WorkspaceData["subtasks"];
      comments: WorkspaceData["comments"];
      attachments: WorkspaceData["attachments"];
    },
  ) =>
  (current: WorkspaceData): WorkspaceData => ({
    ...current,
    subtasks: [
      ...current.subtasks.filter((item) => item.task_id !== taskId),
      ...result.subtasks,
    ],
    comments: [
      ...current.comments.filter((item) => item.task_id !== taskId),
      ...result.comments,
    ],
    attachments: [
      ...current.attachments.filter((item) => item.task_id !== taskId),
      ...result.attachments,
    ],
  });

const mergeActivity =
  (taskId: string, incoming: TaskActivity[]) =>
  (current: WorkspaceData): WorkspaceData => ({
    ...current,
    activity: [
      ...current.activity.filter(
        (item) =>
          item.task_id !== taskId ||
          !incoming.some((next) => next.id === item.id),
      ),
      ...incoming,
    ],
  });
