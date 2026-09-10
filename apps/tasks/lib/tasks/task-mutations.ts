import type { Dispatch, SetStateAction } from "react";
import { mutate } from "@/lib/mutation-client";
import {
  summarizeTaskChanges,
  taskChangeSnapshot,
  taskUpdateChanges,
} from "@/lib/activity/task-change-summary";
import type {
  Status,
  Task,
  TaskAssignee,
  TaskCategory,
  TaskComment,
} from "@/lib/tasks/task-types";
import { statusNeedingReason } from "@/lib/tasks/task-status-reason";
import { withRecordedRows } from "@/lib/activity/activity-state";
import type { TaskActivity } from "@/lib/activity/activity-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { withNormalizedTaskSchedule } from "@/lib/tasks/task-scheduling";
import { taskCompletionLifecycle } from "./status-outcome";

export type TaskDraft = Pick<
  Task,
  | "title"
  | "description"
  | "status_id"
  | "project_id"
  | "reported_by"
  | "start_date"
  | "due_date"
  | "due_time"
  | "reminder_at"
  | "priority"
> & {
  assignee_ids: string[];
  category_ids: string[];
  category_tags: Record<string, string[]>;
  /**
   * Why the task is entering a status that requires an explanation. It is not
   * a task column: the server stores it as the task's next comment.
   */
  status_reason: string;
};

type MutationContext = {
  demoMode: boolean;
  getData: () => WorkspaceData;
  setData: Dispatch<SetStateAction<WorkspaceData>>;
};

export type SavedTask = {
  task: Task;
  assignees: TaskAssignee[];
  categories: TaskCategory[];
  /**
   * The rows the save recorded rather than the caller: the audit entries, and
   * the comment a required status reason was stored as. A save that changes a
   * task's status *and* its fields records both a move and an edit, so this is
   * a list. Demo mode writes its own so both paths leave the panels in the
   * same state.
   */
  activity?: TaskActivity | TaskActivity[] | null;
  comment?: TaskComment | null;
};

/** The reason a demo move records, matching what `save_task` inserts. */
function reasonComment(
  taskId: string,
  body: string,
  authorId: string,
): TaskComment {
  return {
    id: crypto.randomUUID(),
    task_id: taskId,
    parent_id: null,
    body,
    created_by: authorId,
    created_at: new Date().toISOString(),
    edited_at: null,
  };
}

function completionLifecycle(
  statusId: string,
  statuses: Status[],
  current?: Pick<Task, "completed_at" | "archived_at">,
) {
  return taskCompletionLifecycle(
    statuses.find((candidate) => candidate.id === statusId),
    current,
  );
}

export function createTaskMutationService(context: MutationContext) {
  return {
    async save(draft: TaskDraft, editing: Task | null): Promise<SavedTask> {
      const snapshot = context.getData();
      const {
        assignee_ids: assigneeIds,
        category_ids: categoryIds,
        status_reason: rawReason,
        ...rawTaskDraft
      } = draft;
      const taskDraft = withNormalizedTaskSchedule(rawTaskDraft);
      const statusReason = statusNeedingReason(
        snapshot.statuses,
        draft.status_id,
        editing?.status_id ?? null,
      )
        ? rawReason.trim()
        : null;
      if (context.demoMode) {
        const now = new Date().toISOString();
        const task: Task = editing
          ? {
              ...editing,
              ...taskDraft,
              ...completionLifecycle(
                draft.status_id,
                snapshot.statuses,
                editing,
              ),
              title: draft.title.trim(),
              updated_at: now,
            }
          : {
              ...taskDraft,
              ...completionLifecycle(draft.status_id, snapshot.statuses),
              title: draft.title.trim(),
              id: crypto.randomUUID(),
              task_number:
                Math.max(0, ...snapshot.tasks.map((item) => item.task_number)) +
                1,
              created_by: snapshot.currentProfile.id,
              board_position:
                Math.max(
                  0,
                  ...snapshot.tasks
                    .filter((item) => item.status_id === draft.status_id)
                    .map((item) => item.board_position),
                ) + 1024,
              created_at: now,
              updated_at: now,
            };
        const changes = editing
          ? summarizeTaskChanges(
              taskChangeSnapshot({
                ...editing,
                assignee_ids: snapshot.taskAssignees
                  .filter((item) => item.task_id === editing.id)
                  .map((item) => item.profile_id),
                category_ids: snapshot.taskCategories
                  .filter((item) => item.task_id === editing.id)
                  .map((item) => item.category_id),
                category_tags: editing.category_tags ?? {},
              }),
              taskChangeSnapshot({
                ...task,
                assignee_ids: assigneeIds,
                category_ids: categoryIds,
                category_tags: task.category_tags ?? {},
              }),
            )
          : [];
        // Demo mode has no save transaction, so it records its own audit row
        // and reason comment to keep the panels aligned with the
        // server-backed path.
        const demoActivity = (
          action: string,
          details: TaskActivity["details"] = {},
        ): TaskActivity => ({
          id: crypto.randomUUID(),
          task_id: task.id,
          actor_id: snapshot.currentProfile.id,
          action,
          details,
          created_at: now,
        });
        return {
          task,
          // Matches what `log_task_change` writes: a status change and a field
          // edit in the same save are two rows, not one.
          activity: !editing
            ? [demoActivity("created the task")]
            : [
                ...(editing.status_id !== task.status_id
                  ? [
                      demoActivity("moved task", {
                        from_status_id: editing.status_id,
                        status_id: task.status_id,
                      }),
                    ]
                  : []),
                ...(taskUpdateChanges(changes).length
                  ? [
                      demoActivity("updated the task", {
                        changes: taskUpdateChanges(changes),
                      }),
                    ]
                  : []),
              ],
          comment: statusReason
            ? reasonComment(task.id, statusReason, snapshot.currentProfile.id)
            : null,
          assignees: assigneeIds.map((profile_id) => ({
            task_id: task.id,
            profile_id,
          })),
          categories: categoryIds.map((category_id) => ({
            task_id: task.id,
            category_id,
          })),
        };
      }
      const result = await mutate<SavedTask>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          id: editing?.id,
          task: taskDraft,
          assigneeIds,
          categoryIds,
          statusReason,
        }),
      });
      return {
        task: result.task,
        activity: result.activity,
        comment: result.comment,
        // The submitted assignees are the authoritative post-transaction set.
        // The RPC relation payload can briefly be empty, which otherwise makes
        // the board render the saved task as unassigned until a full refresh.
        assignees: assigneeIds.map((profile_id) => ({
          task_id: result.task.id,
          profile_id,
        })),
        // The submitted IDs are the authoritative post-transaction category
        // set. Keeping them here avoids a stale or incomplete RPC relation
        // payload temporarily removing a task from a category-filtered board.
        categories: categoryIds.map((category_id) => ({
          task_id: result.task.id,
          category_id,
        })),
      };
    },

    applySaved(saved: SavedTask, editing: boolean) {
      context.setData((current) =>
        withRecordedRows(saved, {
          ...current,
          tasks: editing
            ? current.tasks.map((task) =>
                task.id === saved.task.id ? saved.task : task,
              )
            : [
                saved.task,
                ...current.tasks.filter((task) => task.id !== saved.task.id),
              ],
          taskAssignees: [
            ...current.taskAssignees.filter(
              (item) => item.task_id !== saved.task.id,
            ),
            ...saved.assignees,
          ],
          taskCategories: [
            ...current.taskCategories.filter(
              (item) => item.task_id !== saved.task.id,
            ),
            ...saved.categories,
          ],
        }),
      );
    },

    async remove(id: string) {
      const snapshot = context.getData();
      const deletedTask = snapshot.tasks.find((item) => item.id === id);
      if (!context.demoMode) {
        await mutate<{ id: string }>("/api/tasks", {
          method: "DELETE",
          body: JSON.stringify({ id }),
        });
      }
      context.setData((current) => ({
        ...current,
        tasks: current.tasks.filter((item) => item.id !== id),
        subtasks: current.subtasks.filter((item) => item.task_id !== id),
        comments: current.comments.filter((item) => item.task_id !== id),
        activity: [
          ...(context.demoMode && deletedTask
            ? [
                {
                  id: crypto.randomUUID(),
                  task_id: null,
                  actor_id: current.currentProfile.id,
                  action: "task.delete",
                  details: {
                    resource_type: "task",
                    resource_id: deletedTask.id,
                    resource_name: deletedTask.title,
                    project_id: deletedTask.project_id ?? undefined,
                  },
                  created_at: new Date().toISOString(),
                },
              ]
            : []),
          ...current.activity.filter((item) => item.task_id !== id),
        ],
        attachments: current.attachments.filter((item) => item.task_id !== id),
        taskAssignees: current.taskAssignees.filter(
          (item) => item.task_id !== id,
        ),
        taskLabels: current.taskLabels.filter((item) => item.task_id !== id),
        taskCategories: current.taskCategories.filter(
          (item) => item.task_id !== id,
        ),
      }));
    },

    async move(
      id: string,
      statusId: string,
      targetId?: string,
      edge: "before" | "after" = "after",
      reason = "",
    ) {
      const snapshot = context.getData();
      const original = snapshot.tasks.find((task) => task.id === id);
      if (!original || targetId === id) return;
      const statusReason = statusNeedingReason(
        snapshot.statuses,
        statusId,
        original.status_id,
      )
        ? reason.trim()
        : null;
      const destination = snapshot.tasks
        .filter((task) => task.status_id === statusId && task.id !== id)
        .sort((a, b) => a.board_position - b.board_position);
      const index = targetId
        ? destination.findIndex((task) => task.id === targetId)
        : -1;
      let position = (destination.at(-1)?.board_position ?? 0) + 1024;
      if (index >= 0 && edge === "before") {
        position = destination[index - 1]
          ? (destination[index - 1].board_position +
              destination[index].board_position) /
            2
          : destination[index].board_position - 1024;
      } else if (index >= 0) {
        position = destination[index + 1]
          ? (destination[index].board_position +
              destination[index + 1].board_position) /
            2
          : destination[index].board_position + 1024;
      }
      context.setData((current) =>
        withRecordedRows(
          // Demo mode has no move transaction, so it records its own reason
          // comment; the server hands its own back once the move lands.
          context.demoMode && statusReason
            ? {
                comment: reasonComment(
                  id,
                  statusReason,
                  current.currentProfile.id,
                ),
              }
            : {},
          {
            ...current,
            tasks: current.tasks.map((task) =>
              task.id === id
                ? {
                    ...task,
                    status_id: statusId,
                    board_position: position,
                    ...completionLifecycle(statusId, current.statuses, task),
                    updated_at: new Date().toISOString(),
                  }
                : task,
            ),
          },
        ),
      );
      if (!context.demoMode) {
        try {
          const result = await mutate<{
            task: Task;
            activity: TaskActivity[];
            comment: TaskComment | null;
          }>("/api/tasks", {
            method: "PATCH",
            body: JSON.stringify({
              id,
              statusId,
              boardPosition: position,
              statusReason,
            }),
          });
          context.setData((current) =>
            withRecordedRows(result, {
              ...current,
              tasks: current.tasks.map((task) =>
                task.id === id ? result.task : task,
              ),
            }),
          );
        } catch (error) {
          context.setData((current) => ({
            ...current,
            tasks: current.tasks.map((task) =>
              task.id === id ? original : task,
            ),
          }));
          throw error;
        }
      }
    },
  };
}
