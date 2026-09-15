"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "@ryanmeetup/ui";
import type { Task } from "@/lib/tasks/task-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import {
  buildTaskQueryParams,
  taskQuerySignature as buildTaskQuerySignature,
  type TaskQueryFilters,
} from "@/lib/tasks/task-query";
import { LatestRequestTracker } from "@/lib/latest-request";
import { errorMessage } from "@/lib/presentation";

type TaskPageResponse = {
  error?: string;
  tasks?: Task[];
  taskAssignees?: WorkspaceData["taskAssignees"];
  taskCategories?: WorkspaceData["taskCategories"];
  taskLabels?: WorkspaceData["taskLabels"];
  page?: NonNullable<WorkspaceData["taskPage"]>;
};

/**
 * Owns the authoritative task fetch: it refetches whenever the query the URL
 * describes changes, and hands back a loader the mutation handlers call so a
 * paginated list reflects a write immediately.
 */
export function useTaskPageLoader({
  demoMode,
  preview,
  setData,
  filters,
  page,
  pageSize,
  setPage,
  syncPage,
  syncPageSize,
  search,
  sort,
  view,
  visibility,
}: {
  demoMode: boolean;
  preview: WorkspaceData["accessPreview"];
  setData: React.Dispatch<React.SetStateAction<WorkspaceData>>;
  filters: TaskQueryFilters;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  syncPage: (page: number) => void;
  syncPageSize: (pageSize: number) => void;
  search: string;
  sort: string;
  view: "board" | "list";
  visibility: "active" | "archived";
}) {
  const [loading, setLoading] = useState(false);
  const taskQuerySignature = buildTaskQuerySignature({
    filters,
    pageSize,
    search,
    sort,
    view,
    visibility,
  });
  const queryKey = `${taskQuerySignature}|${page}`;
  // The server-rendered page already matches its initial query. A changed
  // query must hide those rows on the very first render, before the effect
  // starts the replacement request.
  const [settledQueryKey, setSettledQueryKey] = useState(queryKey);
  const loadedTaskQuery = useRef("");
  const requests = useRef(new LatestRequestTracker());

  async function loadTaskPage(replace = false) {
    if (demoMode) return;
    const request = requests.current.start();
    setLoading(true);
    try {
      const params = buildTaskQueryParams({
        filters,
        page,
        pageSize,
        preview,
        search,
        sort,
        view,
        visibility,
      });
      const response = await fetch(`/api/tasks?${params}`, {
        signal: request.controller.signal,
      });
      const result = (await response.json()) as TaskPageResponse;
      if (!requests.current.isLatest(request)) return;
      if (!response.ok || !result.tasks || !result.page)
        throw new Error(result.error ?? "Tasks could not be loaded.");
      setData((current) => {
        const ids = new Set(result.tasks!.map((task) => task.id));
        const mergeRows = <T extends { task_id: string }>(
          oldRows: T[],
          rows: T[],
        ) =>
          replace
            ? rows
            : [...oldRows.filter((row) => !ids.has(row.task_id)), ...rows];
        return {
          ...current,
          tasks:
            replace || view === "list"
              ? result.tasks!
              : [
                  ...current.tasks,
                  ...result.tasks!.filter(
                    (task) =>
                      !current.tasks.some((item) => item.id === task.id),
                  ),
                ],
          taskAssignees: mergeRows(
            current.taskAssignees,
            result.taskAssignees ?? [],
          ),
          taskCategories: mergeRows(
            current.taskCategories,
            result.taskCategories ?? [],
          ),
          taskLabels: mergeRows(current.taskLabels, result.taskLabels ?? []),
          taskPage: view === "list" ? result.page : undefined,
        };
      });
      setSettledQueryKey(queryKey);
      if (view === "list") {
        syncPage(result.page.page);
        syncPageSize(result.page.pageSize);
      }
    } catch (error) {
      if (!requests.current.isLatest(request)) return;
      setSettledQueryKey(queryKey);
      toast.error(errorMessage(error, "Tasks could not be loaded."));
    } finally {
      if (requests.current.finish(request)) setLoading(false);
    }
  }

  useEffect(() => {
    if (demoMode) return;
    if (
      view === "list" &&
      loadedTaskQuery.current &&
      loadedTaskQuery.current !== taskQuerySignature &&
      page !== 1
    ) {
      loadedTaskQuery.current = taskQuerySignature;
      setPage(1);
      return;
    }
    loadedTaskQuery.current = taskQuerySignature;
    const requestTracker = requests.current;
    void loadTaskPage(true);
    const request = requestTracker.getActive();
    return () => {
      if (request) requestTracker.abort(request);
    };
    // Query values are normalized above; fetching from this signature keeps
    // URL pagination and the authoritative server result in sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, page, taskQuerySignature, view]);

  return {
    loading: loading || (!demoMode && settledQueryKey !== queryKey),
    loadTaskPage,
  };
}
