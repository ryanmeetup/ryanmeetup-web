import { NextResponse } from "next/server";
import { authorize } from "@/lib/server/auth";
import { databaseFailure } from "@/lib/server/api-response";
import { WORKSPACE_COLUMNS } from "@/lib/server/workspace-loader";
import { parseTaskKey } from "@/lib/tasks/task-key";
import { TASK_ASSIGNEE_COLUMNS } from "@/lib/workspace/database-shapes";

const SEARCH_LIMIT = 25;
/**
 * Archived matches are a footnote to the answer, not the answer, so they are
 * capped well below the live results they sit beneath.
 */
const ARCHIVED_SEARCH_LIMIT = 8;
const MIN_QUERY_LENGTH = 3;

export async function GET(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < MIN_QUERY_LENGTH)
    return NextResponse.json({ tasks: [], archivedTasks: [], totalCount: 0 });

  // PostgREST's `.or()` accepts a filter expression, so strip its structural
  // punctuation while retaining normal words, spaces, and task-key hyphens.
  const safeQuery = query.replace(/[,().%_]/g, " ").trim();
  if (!safeQuery) return NextResponse.json({ tasks: [], archivedTasks: [] });

  const taskNumber = parseTaskKey(safeQuery);
  const projectResult = await authorization.supabase
    .from("projects")
    .select("id")
    .ilike("name", `%${query}%`)
    .limit(SEARCH_LIMIT);
  if (projectResult.error)
    return databaseFailure(
      request,
      "tasks.search-projects",
      projectResult.error,
      {
        error: "Tasks could not be searched. Try again.",
      },
    );
  const projectFilter = (projectResult.data ?? []).length
    ? `,project_id.in.(${projectResult.data!.map((project) => project.id).join(",")})`
    : "";
  const boundary = new Date().toISOString();
  const matching = (archived: boolean) => {
    const scoped = authorization.supabase
      .from("tasks")
      .select(WORKSPACE_COLUMNS.tasks, { count: "exact" });
    const withVisibility = archived
      ? scoped.lte("archived_at", boundary)
      : scoped.or(`archived_at.is.null,archived_at.gt.${boundary}`);
    return taskNumber
      ? withVisibility.or(
          `task_number.eq.${taskNumber},title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%${projectFilter}`,
        )
      : withVisibility.or(
          `title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%${projectFilter}`,
        );
  };

  // Work that has left the board is still work someone can be looking for, and
  // a task key that resolves to an archived task used to find nothing at all.
  const [result, archivedResult] = await Promise.all([
    matching(false).order("updated_at", { ascending: false }).limit(SEARCH_LIMIT),
    matching(true)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(ARCHIVED_SEARCH_LIMIT),
  ]);
  if (result.error)
    return databaseFailure(request, "tasks.search", result.error, {
      error: "Tasks could not be searched. Try again.",
    });
  if (archivedResult.error)
    return databaseFailure(request, "tasks.search-archived", archivedResult.error, {
      error: "Tasks could not be searched. Try again.",
    });

  const tasks = result.data ?? [];
  const archivedTasks = archivedResult.data ?? [];
  const shownTaskIds = [...tasks, ...archivedTasks].map((task) => task.id);
  const assignees = shownTaskIds.length
    ? await authorization.supabase
        .from("task_assignees")
        .select(TASK_ASSIGNEE_COLUMNS)
        .in("task_id", shownTaskIds)
    : { data: [], error: null };
  if (assignees.error)
    return databaseFailure(request, "tasks.search-assignees", assignees.error, {
      error: "Task assignees could not be loaded. Try again.",
    });

  return NextResponse.json({
    tasks,
    archivedTasks,
    taskAssignees: assignees.data ?? [],
    totalCount: result.count ?? 0,
    archivedTotalCount: archivedResult.count ?? 0,
  });
}
