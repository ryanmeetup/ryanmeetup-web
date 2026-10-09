import { NextResponse } from "next/server";
import { databaseFailure, operationFailed } from "@/lib/server/api-response";
import { authorize } from "@/lib/server/auth";
import { isUuid, requiredTrimmedText } from "@/lib/api-schema/shared";
import { MAX_CHECKLIST_PASTE_ITEMS } from "@/lib/tasks/checklist-paste";
import type { Subtask, TaskComment } from "@/lib/tasks/task-types";
import type { TaskActivity } from "@/lib/activity/activity-types";
import {
  TASK_PAGE_SIZE,
  WORKSPACE_COLUMNS,
} from "@/lib/server/workspace-loader";

const failure = (message: string) => operationFailed(message);

/** Long enough for a wrapped line of prose, short enough to stay an item. */
const MAX_CHECKLIST_ITEM_LENGTH = 1000;

/**
 * Validates one pasted checklist batch into the shape the RPC expects.
 *
 * Sort order is derived from the offset the client sends plus the position in
 * the batch, so the pasted items land after whatever is already on the list
 * and keep the order they were written in.
 */
function checklistPasteItems(value: unknown, sortOrder: unknown) {
  const offset =
    typeof sortOrder === "number" &&
    Number.isInteger(sortOrder) &&
    sortOrder >= 0
      ? sortOrder
      : 0;
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > MAX_CHECKLIST_PASTE_ITEMS
  )
    return null;
  const items = value.map((entry, index) => {
    if (!entry || typeof entry !== "object") return null;
    const { id, title, completed } = entry as Record<string, unknown>;
    const cleanTitle = requiredTrimmedText(title, MAX_CHECKLIST_ITEM_LENGTH);
    return isUuid(id) && cleanTitle && typeof completed === "boolean"
      ? { id, title: cleanTitle, completed, sort_order: offset + index }
      : null;
  });
  return items.every((item) => item !== null) ? items : null;
}

export async function GET(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;
  const { supabase } = authorization;
  const params = new URL(request.url).searchParams;
  const taskId = params.get("taskId");
  const activityPage = Math.max(
    0,
    Number.parseInt(params.get("activityPage") ?? "0", 10) || 0,
  );
  if (!taskId) return failure("A task is required.");
  const from = activityPage * TASK_PAGE_SIZE;
  const [subtasks, comments, activity, attachments, taskReferences] =
    await Promise.all([
      supabase
        .from("subtasks")
        .select(WORKSPACE_COLUMNS.subtasks)
        .eq("task_id", taskId)
        .order("sort_order"),
      supabase
        .from("task_comments")
        .select(WORKSPACE_COLUMNS.comments)
        .eq("task_id", taskId)
        .order("created_at", { ascending: false }),
      supabase
        .from("task_activity")
        .select(WORKSPACE_COLUMNS.activity, { count: "exact" })
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .range(from, from + TASK_PAGE_SIZE - 1),
      supabase
        .from("task_attachments")
        .select(WORKSPACE_COLUMNS.attachments)
        .eq("task_id", taskId)
        .order("created_at"),
      supabase
        .from("tasks")
        .select("id,task_number,project_id")
        .order("task_number"),
    ]);
  const failed = [
    subtasks,
    comments,
    activity,
    attachments,
    taskReferences,
  ].find((result) => result.error);
  if (failed?.error)
    return databaseFailure(request, "task-details.load", failed.error, {
      error: "Task details could not be loaded. Try again.",
    });
  const attachmentPaths = (attachments.data ?? []).flatMap((attachment) =>
    attachment.file_path ? [attachment.file_path] : [],
  );
  const { data: signedUrls } = attachmentPaths.length
    ? await supabase.storage
        .from("task-attachments")
        .createSignedUrls(attachmentPaths, 3600)
    : { data: [] };
  const urlsByPath = new Map(
    (signedUrls ?? []).flatMap((item) =>
      item.signedUrl ? [[item.path, item.signedUrl] as const] : [],
    ),
  );
  const signedAttachments = (attachments.data ?? []).map((attachment) => {
    const signedUrl = attachment.file_path
      ? urlsByPath.get(attachment.file_path)
      : undefined;
    return signedUrl ? { ...attachment, url: signedUrl } : attachment;
  });
  return NextResponse.json({
    subtasks: subtasks.data ?? [],
    comments: comments.data ?? [],
    activity: activity.data ?? [],
    attachments: signedAttachments,
    taskReferences: taskReferences.data ?? [],
    activityPage: {
      page: activityPage,
      hasMore: from + (activity.data?.length ?? 0) < (activity.count ?? 0),
    },
  });
}

export async function POST(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;
  const { supabase, user } = authorization;
  const body = (await request.json()) as {
    kind?: string;
    id?: string;
    taskId?: string;
    parentId?: string | null;
    value?: string;
    sortOrder?: number;
    items?: unknown;
  };
  if (!body.taskId) return failure("Invalid task detail.");
  if (body.kind === "subtasks") {
    const items = checklistPasteItems(body.items, body.sortOrder);
    if (!items)
      return failure(
        `Paste up to ${MAX_CHECKLIST_PASTE_ITEMS} checklist items of ${MAX_CHECKLIST_ITEM_LENGTH.toLocaleString("en-US")} characters each.`,
      );
    const { data, error } = await supabase.rpc(
      "create_subtasks_with_activity",
      {
        parent_task_id: body.taskId,
        requested_items: items,
      },
    );
    if (error)
      return databaseFailure(request, "subtasks.create", error, {
        error: "The checklist items could not be added. Try again.",
      });
    return NextResponse.json(
      data as { subtasks: Subtask[]; activity: TaskActivity },
    );
  }
  if (typeof body.value !== "string" || !body.value.trim())
    return failure("Invalid task detail.");
  if (body.kind === "subtask") {
    const id = crypto.randomUUID();
    const { data, error } = await supabase.rpc("create_subtask_with_activity", {
      subtask_id: id,
      parent_task_id: body.taskId,
      subtask_title: body.value,
      subtask_sort_order: body.sortOrder ?? 0,
    });
    if (error)
      return databaseFailure(request, "subtask.create", error, {
        error: "The checklist item could not be added. Try again.",
      });
    return NextResponse.json(
      data as { subtask: Subtask; activity: TaskActivity },
    );
  }
  if (body.kind === "comment") {
    const { data, error } = await supabase
      .from("task_comments")
      .insert({
        id: crypto.randomUUID(),
        task_id: body.taskId,
        parent_id: body.parentId ?? null,
        body: body.value.trim(),
        created_by: user.id,
      })
      .select(WORKSPACE_COLUMNS.comments)
      .single();
    if (error)
      return databaseFailure(request, "comment.create", error, {
        error: "The comment could not be added. Try again.",
      });
    const activity = await recordTaskActivity(
      supabase,
      body.taskId,
      user.id,
      "added a comment",
    );
    if (activity.error)
      return databaseFailure(request, "comment.activity", activity.error, {
        error: "The comment was added, but its activity could not be recorded.",
      });
    return NextResponse.json({
      comment: data as TaskComment,
      activity: activity.data as TaskActivity,
    });
  }
  return failure("Invalid task detail type.");
}

export async function PATCH(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;
  const { supabase, user } = authorization;
  const body = (await request.json()) as {
    kind?: string;
    id?: string;
    completed?: boolean;
    title?: unknown;
    value?: string;
  };
  if (body.kind === "comment") {
    if (!body.id || typeof body.value !== "string" || !body.value.trim())
      return failure("Invalid comment update.");
    const { data, error } = await supabase
      .from("task_comments")
      .update({ body: body.value.trim(), edited_at: new Date().toISOString() })
      .eq("id", body.id)
      .eq("created_by", user.id)
      .select(WORKSPACE_COLUMNS.comments)
      .single();
    if (error)
      return databaseFailure(request, "comment.update", error, {
        error: "The comment could not be updated. Try again.",
      });
    const activity = await recordTaskActivity(
      supabase,
      data.task_id,
      user.id,
      "edited a comment",
    );
    if (activity.error)
      return databaseFailure(request, "comment.activity", activity.error, {
        error:
          "The comment was edited, but its activity could not be recorded.",
      });
    return NextResponse.json({
      comment: data as TaskComment,
      activity: activity.data as TaskActivity,
    });
  }
  // A checklist edit either renames the item or flips it, never both.
  const title =
    body.title === undefined
      ? undefined
      : requiredTrimmedText(body.title, MAX_CHECKLIST_ITEM_LENGTH);
  if (
    !body.id ||
    title === null ||
    (title === undefined) === (typeof body.completed !== "boolean")
  )
    return failure("Invalid checklist update.");
  const { data, error } = await supabase
    .from("subtasks")
    .update(title ? { title } : { is_completed: body.completed })
    .eq("id", body.id)
    .select(WORKSPACE_COLUMNS.subtasks)
    .single();
  if (error)
    return databaseFailure(request, "subtask.update", error, {
      error: "The checklist item could not be updated. Try again.",
    });
  const activity = await recordTaskActivity(
    supabase,
    data.task_id,
    user.id,
    title
      ? "renamed a checklist item"
      : body.completed
        ? "completed a checklist item"
        : "reopened a checklist item",
  );
  if (activity.error)
    return databaseFailure(request, "subtask.activity", activity.error, {
      error:
        "The checklist was updated, but its activity could not be recorded.",
    });
  return NextResponse.json({
    subtask: data as Subtask,
    activity: activity.data as TaskActivity,
  });
}

export async function DELETE(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;
  const { supabase, user } = authorization;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const kind = searchParams.get("kind");
  if (kind === "comment") {
    if (!id) return failure("A comment is required.");
    const { data, error } = await supabase
      .from("task_comments")
      .delete()
      .eq("id", id)
      .eq("created_by", user.id)
      .select("id,task_id")
      .single();
    if (error)
      return databaseFailure(request, "comment.delete", error, {
        error: "The comment could not be deleted. Try again.",
      });
    const activity = await recordTaskActivity(
      supabase,
      data.task_id,
      user.id,
      "deleted a comment",
    );
    if (activity.error)
      return databaseFailure(request, "comment.activity", activity.error, {
        error:
          "The comment was deleted, but its activity could not be recorded.",
      });
    return NextResponse.json({
      id: data.id,
      activity: activity.data as TaskActivity,
    });
  }
  if (!id) return failure("A checklist item is required.");
  const { data, error } = await supabase
    .from("subtasks")
    .delete()
    .eq("id", id)
    .select("id,task_id")
    .single();
  if (error)
    return databaseFailure(request, "subtask.delete", error, {
      error: "The checklist item could not be removed. Try again.",
    });
  const activity = await recordTaskActivity(
    supabase,
    data.task_id,
    user.id,
    "deleted a checklist item",
  );
  if (activity.error)
    return databaseFailure(request, "subtask.activity", activity.error, {
      error:
        "The checklist item was deleted, but its activity could not be recorded.",
    });
  return NextResponse.json({
    id: data.id,
    activity: activity.data as TaskActivity,
  });
}
/**
 * Records one audit row and hands it back.
 *
 * The row is selected rather than discarded because the panels read activity
 * out of the workspace the client already holds. A write that only inserts it
 * leaves the activity list a page refresh behind the change it describes.
 */
async function recordTaskActivity(
  supabase: Awaited<ReturnType<typeof authorize>> extends infer T
    ? T extends { supabase: infer S }
      ? S
      : never
    : never,
  taskId: string,
  actorId: string,
  action: string,
) {
  return supabase
    .from("task_activity")
    .insert({
      task_id: taskId,
      actor_id: actorId,
      action,
      details: {},
    })
    .select(WORKSPACE_COLUMNS.activity)
    .single();
}
