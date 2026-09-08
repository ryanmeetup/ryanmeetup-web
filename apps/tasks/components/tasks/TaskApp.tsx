"use client";

import { useMemo, useRef, useState } from "react";
import { PendingResults, toast } from "@ryanmeetup/ui";

import { useQueryParamState, useSearchFilter } from "@ryanmeetup/hooks";
import type { Status, Task } from "@/lib/tasks/task-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { WorkspacePageShell } from "@/components/global";
import { TaskFilterBar } from "./TaskFilterBar";
import { TaskListView } from "./TaskListView";
import { TaskWorkspaceHeader } from "./TaskWorkspaceHeader";
import { TaskWorkspaceModals } from "./TaskWorkspaceModals";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import { useProjectFavorites } from "@/hooks/useProjectFavorites";
import { useTaskFilters } from "@/hooks/useTaskFilters";
import { usePagination } from "@/hooks/usePagination";
import { useCollapsedStatuses } from "@/hooks/useCollapsedStatuses";
import { useBoardAutoScroll } from "@/hooks/useBoardAutoScroll";
import { createTaskMutationService } from "@/lib/tasks/task-mutations";
import { taskKey, taskPath, parseTaskKey } from "@/lib/tasks/task-key";
import { errorMessage } from "@/lib/presentation";
import {
  deriveVisibleTasks,
  indexTaskAssignees,
  indexTaskCategories,
} from "@/lib/tasks/task-view";
import {
  countResolvedTaskFilters,
  useResolvedTaskFilters,
} from "@/hooks/useResolvedTaskFilters";
import { useReadableFilterParams } from "@/hooks/useReadableFilterParams";
import { useTaskPageLoader } from "@/hooks/useTaskPageLoader";
import { useTaskScope } from "@/hooks/useTaskScope";
import { useTaskEditorController } from "@/hooks/useTaskEditorController";
import { useTaskBoardDrag } from "@/hooks/useTaskBoardDrag";
import { TaskBoardView } from "./TaskBoardView";
import { StatusReasonDialog } from "./StatusReasonDialog";
import { statusNeedingReason } from "@/lib/tasks/task-status-reason";

type View = "board" | "list";

/** A board drop, held while its status asks the mover for a reason. */
type PendingMove = {
  id: string;
  statusId: string;
  targetId?: string;
  edge: "before" | "after";
  status?: Status;
};

export function TaskApp({
  initialData,
  demoMode,
  initialTaskId,
}: {
  initialData: WorkspaceData;
  demoMode: boolean;
  initialTaskId?: string;
}) {
  const initialTaskNumber = initialTaskId ? parseTaskKey(initialTaskId) : null;
  const initialEditing = initialTaskId
    ? (initialData.tasks.find(
        (task) =>
          task.id === initialTaskId || task.task_number === initialTaskNumber,
      ) ?? null)
    : null;
  const { data, setData, getData } = useWorkspaceData(initialData, demoMode);
  const mutations = useMemo(
    () => createTaskMutationService({ demoMode, getData, setData }),
    [demoMode, getData, setData],
  );
  const [viewParam, setView] = useQueryParamState("view", "board");
  const view: View = viewParam === "list" ? "list" : "board";
  const [committedSearch] = useQueryParamState("q", "");
  const { page, pageSize, setPage, setPageSize, syncPage, syncPageSize } =
    usePagination();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categoryEditId, setCategoryEditId] = useState<string | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projectEditId, setProjectEditId] = useState<string | null>(null);
  const [taskPendingDelete, setTaskPendingDelete] = useState<Task | null>(null);
  const [taskDeleting, setTaskDeleting] = useState(false);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [moveReason, setMoveReason] = useState("");
  const [moveSaving, setMoveSaving] = useState(false);
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const {
    setQuery: setSearch,
    filtered: searchedTasks,
    isPending: searchPending,
  } = useSearchFilter({
    data: data.tasks,
    buildHaystack: (task) =>
      `${taskKey(task)} ${task.title} ${task.description ?? ""}`.toLowerCase(),
  });
  const filters = useTaskFilters(setSearch);
  const { sort, visibility } = filters;
  const resolved = useResolvedTaskFilters(data, filters);
  useReadableFilterParams({ data, filters, resolved });
  const { collapsedStatusIds, expandStatusSection, toggleStatusSection } =
    useCollapsedStatuses();
  const { loading: taskPageLoading, loadTaskPage } = useTaskPageLoader({
    demoMode,
    preview: data.accessPreview,
    setData,
    filters: resolved.queryFilters,
    page,
    pageSize,
    setPage,
    syncPage,
    syncPageSize,
    search: committedSearch,
    sort,
    view,
    visibility,
  });
  const scope = useTaskScope({ data, resolved, visibility });
  const favorites = useProjectFavorites({ data, setData, demoMode });
  const filterCount = countResolvedTaskFilters(resolved, {
    isMyTasks: scope.isMyTasks,
    visibility,
  });

  const categoriesByTask = useMemo(
    () => indexTaskCategories(data.taskCategories),
    [data.taskCategories],
  );
  const assigneesByTask = useMemo(
    () => indexTaskAssignees(data.taskAssignees),
    [data.taskAssignees],
  );
  const { queryFilters, selectedProject, selectedStatus, statuses } = resolved;
  const { clock } = filters;
  const visibleTasks = useMemo(
    () =>
      deriveVisibleTasks({
        assigneesByTask,
        categoriesByTask,
        clock,
        filters: queryFilters,
        sort,
        tasks: searchedTasks,
        view,
        visibility,
      }),
    [
      assigneesByTask,
      categoriesByTask,
      clock,
      queryFilters,
      searchedTasks,
      sort,
      view,
      visibility,
    ],
  );
  const listTasks =
    view === "list" ? visibleTasks.slice(0, pageSize) : visibleTasks;
  const visibleTaskCount =
    view === "list"
      ? (data.taskPage?.totalCount ?? visibleTasks.length)
      : visibleTasks.length;

  const editor = useTaskEditorController({
    initialEditing,
    initialData,
    data,
    setData,
    demoMode,
    mutations,
    assigneesByTask,
    categoriesByTask,
    defaults: {
      statusId: selectedStatus?.id ?? statuses[1]?.id ?? statuses[0]?.id ?? "",
      categoryIds: resolved.includedCategoryIds,
      projectId: selectedProject?.id ?? null,
      assigneeIds: resolved.selectedAssignee
        ? [resolved.selectedAssignee.id]
        : [],
      priority: resolved.selectedPriority ?? "medium",
    },
    afterSave: async () => {
      if (!demoMode) await loadTaskPage(true);
    },
  });

  async function removeTask(id: string) {
    setTaskDeleting(true);
    try {
      await mutations.remove(id);
      if (!demoMode && view === "list") await loadTaskPage(true);
      setTaskPendingDelete(null);
      editor.modal.setOpen(false);
      toast.success("Task deleted.");
    } catch (error) {
      toast.error(errorMessage(error, "The task could not be deleted."));
    } finally {
      setTaskDeleting(false);
    }
  }

  /** Reports whether the move landed, so a rejected one keeps its reason. */
  async function commitMove(move: PendingMove, reason: string) {
    const { id, statusId, targetId, edge } = move;
    const task = getData().tasks.find((item) => item.id === id);
    const destination = data.statuses.find((item) => item.id === statusId);
    const movedToNewColumn = Boolean(task && task.status_id !== statusId);
    try {
      await mutations.move(id, statusId, targetId, edge, reason);
      if (!demoMode && view === "list") await loadTaskPage(true);
      if (movedToNewColumn && destination && task) {
        toast.successWithLink(`Task moved to ${destination.name}:`, {
          href: taskPath(task),
          linkLabel: taskKey(task),
        });
      }
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "The task could not be moved."));
      return false;
    }
  }

  async function moveTask(
    id: string,
    statusId: string,
    targetId?: string,
    edge: "before" | "after" = "after",
  ) {
    const task = getData().tasks.find((item) => item.id === id);
    const reasonStatus = task
      ? statusNeedingReason(data.statuses, statusId, task.status_id)
      : null;
    // A dragged card carries no explanation, so the move waits for one rather
    // than reaching a server that would reject it.
    if (reasonStatus) {
      setPendingMove({ id, statusId, targetId, edge, status: reasonStatus });
      return;
    }
    await commitMove({ id, statusId, targetId, edge }, "");
  }

  async function confirmPendingMove() {
    if (!pendingMove) return;
    setMoveSaving(true);
    try {
      if (await commitMove(pendingMove, moveReason)) closePendingMove();
    } finally {
      setMoveSaving(false);
    }
  }

  function closePendingMove() {
    setPendingMove(null);
    setMoveReason("");
  }
  const boardDrag = useTaskBoardDrag(moveTask);
  useBoardAutoScroll(Boolean(boardDrag.state.draggedTaskId), boardScrollRef);

  return (
    <>
      <WorkspacePageShell
        data={data}
        demoMode={demoMode}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onCreateCategory={() => {
          setCategoryEditId(null);
          setCategoriesOpen(true);
        }}
        onCreateProject={() => {
          setProjectEditId(null);
          setProjectsOpen(true);
        }}
        onNewTask={() => editor.openCreate()}
        setData={setData}
        contentClassName="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 lg:p-8">
          <TaskWorkspaceHeader
            scope={{
              assignee: filters.assignee,
              demoMode,
              isMyTasks: scope.isMyTasks,
              myTasksName: scope.myTasksName,
              previewing: Boolean(data.accessPreview),
              projectFavorite: selectedProject
                ? favorites.isFavorite(selectedProject.id)
                : false,
              projectFavoritePending: selectedProject
                ? favorites.isPending(selectedProject.id)
                : false,
              scopeDescription: scope.scopeDescription,
              selectedCategory: resolved.selectedCategory,
              selectedProject,
              projectOwners: resolved.selectedProjectOwners,
              projectAttachmentCount: attachmentCount(
                data.resourceAttachmentCounts?.projects,
                selectedProject?.id,
              ),
              categoryAttachmentCount: attachmentCount(
                data.resourceAttachmentCounts?.categories,
                resolved.selectedCategory?.id,
              ),
              taskCount: visibleTaskCount,
              view,
              viewTitle: scope.viewTitle,
              viewingAsGroup: scope.viewingAsGroup,
            }}
            controls={{
              onEditProject: () => {
                if (!selectedProject) return;
                setProjectEditId(selectedProject.id);
                setProjectsOpen(true);
              },
              onToggleProjectFavorite: () => {
                if (!selectedProject) return;
                void favorites.toggle(selectedProject);
              },
              onEditCategory: () => {
                if (!resolved.selectedCategory) return;
                setCategoryEditId(resolved.selectedCategory.id);
                setCategoriesOpen(true);
              },
              onSetAssignee: filters.setAssignee,
              onSetView: setView,
            }}
          />
          <TaskFilterBar
            data={data}
            filters={filters}
            resolved={resolved}
            filterCount={filterCount}
          />

          <PendingResults
            pending={searchPending}
            label="Loading tasks"
            surface="page"
            size="lg"
            className="rounded-2xl"
            fill={view === "board"}
          >
            {view === "board" ? (
              <TaskBoardView
                data={data}
                tasks={visibleTasks}
                statuses={statuses}
                collapsedStatusIds={collapsedStatusIds}
                scrollRef={boardScrollRef}
                drag={boardDrag}
                onToggleStatus={toggleStatusSection}
                onExpandStatus={expandStatusSection}
                onCreate={editor.openCreate}
                onOpen={editor.openEdit}
              />
            ) : (
              <TaskListView
                data={{
                  assigneesByTask,
                  categories: resolved.categories,
                  categoriesByTask,
                  profiles: resolved.profiles,
                  projects: resolved.projects,
                  statuses,
                  tasks: listTasks,
                }}
                loading={taskPageLoading}
                onOpenTask={editor.openEdit}
                pagination={{
                  page: data.taskPage?.page ?? page,
                  pageSize: data.taskPage?.pageSize ?? pageSize,
                  totalCount: data.taskPage?.totalCount ?? visibleTasks.length,
                  onPageChange: (nextPage) => {
                    setView("list");
                    setPage(nextPage);
                  },
                  onPageSizeChange: (nextPageSize) => {
                    setView("list");
                    setPageSize(nextPageSize);
                  },
                }}
                sorting={{
                  value: sort,
                  onChange: (nextSort) => {
                    setView("list");
                    filters.setSort(nextSort);
                  },
                  onToggle: () =>
                    filters.setSort(sort === "due" ? "updated" : "due"),
                }}
              />
            )}
          </PendingResults>
        </div>
      </WorkspacePageShell>

      <TaskWorkspaceModals
        workspace={{ data, setData, demoMode, statuses }}
        editor={editor}
        deletion={{
          task: taskPendingDelete,
          setTask: setTaskPendingDelete,
          pending: taskDeleting,
          onConfirm: (id) => void removeTask(id),
        }}
        categories={{
          open: categoriesOpen,
          setOpen: setCategoriesOpen,
          editId: categoryEditId,
          setEditId: setCategoryEditId,
          selectedId: resolved.selectedCategory?.id,
          onRename: (name) => {
            filters.setGroup(name);
            filters.setIncludedCategories(name);
          },
        }}
        projects={{
          open: projectsOpen,
          setOpen: setProjectsOpen,
          editId: projectEditId,
          setEditId: setProjectEditId,
          selectedId: selectedProject?.id,
          onRename: filters.setProject,
        }}
      />
      <StatusReasonDialog
        status={pendingMove?.status ?? null}
        reason={moveReason}
        onReasonChange={setMoveReason}
        pending={moveSaving}
        onCancel={closePendingMove}
        onConfirm={() => void confirmPendingMove()}
      />
    </>
  );
}

/**
 * Resolves how many attachments a resource has from the counts loaded with the
 * page. A missing entry in a loaded map means none; a missing map means the
 * counts never loaded, which stays undefined so the header falls back to
 * assuming there may be some.
 */
function attachmentCount(
  counts: Record<string, number> | undefined,
  resourceId: string | undefined,
) {
  if (!counts || !resourceId) return undefined;
  return counts[resourceId] ?? 0;
}
