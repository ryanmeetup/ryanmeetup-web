import { NextResponse } from "next/server";
import { idSchema, taskMoveSchema, taskSaveSchema } from "@/lib/api-schema";
import { databaseFailure, operationFailed } from "@/lib/server/api-response";
import { authorize } from "@/lib/server/auth";
import { readJson } from "@/lib/server/request";
import {
  TASK_ASSIGNEE_COLUMNS,
  TASK_CATEGORY_COLUMNS,
  TASK_COLUMNS,
  TASK_LABEL_COLUMNS,
} from "@/lib/workspace/database-shapes";
import { derivePagination } from "@/lib/pagination";
import type { Task } from "@/lib/tasks/task-types";
import {
  ACCESS_PREVIEW_PARAM,
  USER_ACCESS_PREVIEW_PARAM,
} from "@/lib/access/access-preview";
import { resolveAccessPreview } from "@/lib/server/access-preview";
import { parseTaskKey } from "@/lib/tasks/task-key";
import {
  deleteTask,
  isMissingStatusReason,
  moveTask,
  saveTask,
} from "@/lib/server/tasks/mutations";
import {
  loadTaskChangeSnapshot,
  savedTaskRecords,
  savedTaskSnapshot,
} from "@/lib/server/tasks/task-change-activity";
import {
  summarizeTaskChanges,
  taskUpdateChanges,
} from "@/lib/activity/task-change-summary";
import { recordTaskChangeActivity } from "@/lib/server/privileged-api";
import {
  parseTaskListQuery,
  resolveAssigneeTaskFilters,
  TASK_EXACT_FILTERS,
} from "@/lib/server/tasks/list-query";

export async function GET(request: Request): Promise<NextResponse> {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;
  const { supabase } = authorization;

  const params = new URL(request.url).searchParams;
  const {
    visibility,
    boundary,
    includedCategoryIds,
    excludedCategoryIds,
    includedAssigneeIds,
    excludedAssigneeIds,
    includeUnassigned,
    excludeUnassigned,
    paginated,
    requestedPage,
    pageSize,
    sort,
    excludedDueDays,
    hasDueWithinFilter,
    today,
    dueBoundary,
    excludedDueBoundary,
    rawSearch,
    search,
    includedTags,
    excludedTags,
  } = parseTaskListQuery(params);
  let previewProjectIds: string[] | undefined;
  let previewInaccessibleTaskIds: string[] = [];
  const requestedGroupPreview = params.get(ACCESS_PREVIEW_PARAM) ?? undefined;
  const requestedUserPreview =
    params.get(USER_ACCESS_PREVIEW_PARAM) ?? undefined;
  if (requestedGroupPreview || requestedUserPreview) {
    const { data: isOwner } = await supabase.rpc("is_app_owner");
    if (isOwner) {
      const { data: previewProjects } = await supabase
        .from("projects")
        .select("id");
      const resolved = await resolveAccessPreview(supabase, {
        groupId: requestedGroupPreview,
        userName: requestedUserPreview,
        allProjectIds: (previewProjects ?? []).map((project) => project.id),
      });
      if (resolved) {
        previewProjectIds = resolved.projectIds;
        previewInaccessibleTaskIds = resolved.preview.inaccessibleTaskIds ?? [];
      }
    }
  }
  const [includedRows, excludedRows, assignmentRows] = await Promise.all([
    includedCategoryIds.length
      ? supabase
          .from("task_categories")
          .select("task_id")
          .in("category_id", includedCategoryIds)
      : Promise.resolve({ data: [], error: null }),
    excludedCategoryIds.length
      ? supabase
          .from("task_categories")
          .select("task_id")
          .in("category_id", excludedCategoryIds)
      : Promise.resolve({ data: [], error: null }),
    includedAssigneeIds.length ||
    excludedAssigneeIds.length ||
    includeUnassigned ||
    excludeUnassigned
      ? supabase.from("task_assignees").select(TASK_ASSIGNEE_COLUMNS)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (includedRows.error || excludedRows.error || assignmentRows.error)
    return databaseFailure(
      request,
      "tasks.relation-filters",
      includedRows.error ?? excludedRows.error ?? assignmentRows.error!,
      { error: "Task filters could not be applied. Try again." },
    );
  const includedTaskIds = [
    ...new Set((includedRows.data ?? []).map((row) => row.task_id)),
  ];
  const excludedTaskIds = [
    ...new Set((excludedRows.data ?? []).map((row) => row.task_id)),
  ];
  const {
    assignedTaskIds,
    includedAssigneeTaskIds,
    excludedAssigneeTaskIds,
    assignedWithoutIncludedAssignee,
  } = resolveAssigneeTaskFilters(
    assignmentRows.data ?? [],
    includedAssigneeIds,
    excludedAssigneeIds,
  );
  const tagResults = await Promise.all(
    [...includedTags, ...excludedTags].map(({ categoryId, tag }) =>
      supabase
        .from("tasks")
        .select("id")
        .contains("category_tags", { [categoryId]: [tag] }),
    ),
  );
  const tagError = tagResults.find((result) => result.error)?.error;
  if (tagError)
    return databaseFailure(request, "tasks.tag-filters", tagError, {
      error: "Tag filters could not be applied. Try again.",
    });
  const includedTagTaskIds = [
    ...new Set(
      tagResults
        .slice(0, includedTags.length)
        .flatMap((result) => (result.data ?? []).map((row) => row.id)),
    ),
  ];
  const excludedTagTaskIds = [
    ...new Set(
      tagResults
        .slice(includedTags.length)
        .flatMap((result) => (result.data ?? []).map((row) => row.id)),
    ),
  ];
  const searchProjectResult = rawSearch
    ? await supabase
        .from("projects")
        .select("id")
        .ilike("name", `%${rawSearch}%`)
    : { data: [], error: null };
  if (searchProjectResult.error)
    return databaseFailure(
      request,
      "tasks.search-projects",
      searchProjectResult.error,
      { error: "Tasks could not be searched. Try again." },
    );
  const matchingProjectIds = (searchProjectResult.data ?? []).map(
    (project) => project.id,
  );

  let query = supabase
    .from("tasks")
    .select(TASK_COLUMNS, paginated ? { count: "exact" } : undefined);
  query =
    visibility === "archived"
      ? query.lte("archived_at", boundary)
      : query.or(`archived_at.is.null,archived_at.gt.${boundary}`);
  if (previewProjectIds) {
    query = query.or(
      previewProjectIds.length
        ? `project_id.is.null,project_id.in.(${previewProjectIds.join(",")})`
        : "project_id.is.null",
    );
  }
  if (previewInaccessibleTaskIds.length)
    query = query.not("id", "in", `(${previewInaccessibleTaskIds.join(",")})`);
  if (includeUnassigned) {
    if (assignedWithoutIncludedAssignee.length)
      query = query.not(
        "id",
        "in",
        `(${assignedWithoutIncludedAssignee.join(",")})`,
      );
  } else if (includedAssigneeIds.length) {
    query = query.in(
      "id",
      includedAssigneeTaskIds.length
        ? includedAssigneeTaskIds
        : ["00000000-0000-0000-0000-000000000000"],
    );
  }
  if (excludeUnassigned)
    query = query.in(
      "id",
      assignedTaskIds.length
        ? assignedTaskIds
        : ["00000000-0000-0000-0000-000000000000"],
    );
  if (excludedAssigneeTaskIds.length)
    query = query.not(
      "id",
      "in",
      `(${excludedAssigneeTaskIds.join(",")})`,
    );

  for (const [includeParam, excludeParam, column] of TASK_EXACT_FILTERS) {
    const included = (params.get(includeParam) ?? "")
      .split(",")
      .filter((value) => value && value !== "all");
    const excluded = (params.get(excludeParam) ?? "")
      .split(",")
      .filter(Boolean);
    const includeNull = included.some(
      (value) => value === "none" || value === "unassigned",
    );
    const excludeNull = excluded.some(
      (value) => value === "none" || value === "unassigned",
    );
    const includedValues = included.filter(
      (value) => value !== "none" && value !== "unassigned",
    );
    const excludedValues = excluded.filter(
      (value) => value !== "none" && value !== "unassigned",
    );
    if (includeNull && includedValues.length)
      query = query.or(
        `${column}.is.null,${column}.in.(${includedValues.join(",")})`,
      );
    else if (includeNull) query = query.is(column, null);
    else if (includedValues.length) query = query.in(column, includedValues);
    if (excludeNull) query = query.not(column, "is", null);
    if (excludedValues.length)
      query = query.not(column, "in", `(${excludedValues.join(",")})`);
  }
  if (hasDueWithinFilter)
    query = query.gte("due_date", today).lte("due_date", dueBoundary);
  if (excludedDueDays)
    query = query.or(
      `due_date.is.null,due_date.lt.${today},due_date.gt.${excludedDueBoundary}`,
    );
  if (includedCategoryIds.length)
    query = query.in(
      "id",
      includedTaskIds.length
        ? includedTaskIds
        : ["00000000-0000-0000-0000-000000000000"],
    );
  if (excludedTaskIds.length)
    query = query.not("id", "in", `(${excludedTaskIds.join(",")})`);
  if (includedTags.length)
    query = query.in(
      "id",
      includedTagTaskIds.length
        ? includedTagTaskIds
        : ["00000000-0000-0000-0000-000000000000"],
    );
  if (excludedTagTaskIds.length)
    query = query.not("id", "in", `(${excludedTagTaskIds.join(",")})`);
  if (search) {
    const taskNumber = parseTaskKey(search);
    const searchFilters = [
      `title.ilike.%${search}%`,
      `description.ilike.%${search}%`,
      ...(taskNumber ? [`task_number.eq.${taskNumber}`] : []),
      ...(matchingProjectIds.length
        ? [`project_id.in.(${matchingProjectIds.join(",")})`]
        : []),
    ];
    query = query.or(searchFilters.join(","));
  }

  query =
    sort === "due"
      ? query
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true })
      : sort === "closed"
        ? query
            .order("completed_at", { ascending: false, nullsFirst: false })
            .order("id", { ascending: false })
        : query
            .order("updated_at", { ascending: false })
            .order("id", { ascending: false });
  if (paginated) {
    const requestedFrom = (requestedPage - 1) * pageSize;
    query = query.range(requestedFrom, requestedFrom + pageSize - 1);
  }
  let result = await query;
  if (result.error)
    return databaseFailure(request, "tasks.list", result.error, {
      error: "Tasks could not be loaded. Try again.",
    });

  let totalCount = paginated ? (result.count ?? 0) : (result.data?.length ?? 0);
  const pageState = derivePagination(requestedPage, pageSize, totalCount);
  if (paginated && pageState.page !== requestedPage && totalCount > 0) {
    let corrected = supabase.from("tasks").select(TASK_COLUMNS);
    corrected =
      visibility === "archived"
        ? corrected.lte("archived_at", boundary)
        : corrected.or(`archived_at.is.null,archived_at.gt.${boundary}`);
    if (previewProjectIds) {
      corrected = corrected.or(
        previewProjectIds.length
          ? `project_id.is.null,project_id.in.(${previewProjectIds.join(",")})`
          : "project_id.is.null",
      );
    }
    if (previewInaccessibleTaskIds.length)
      corrected = corrected.not(
        "id",
        "in",
        `(${previewInaccessibleTaskIds.join(",")})`,
      );
    if (includeUnassigned) {
      if (assignedWithoutIncludedAssignee.length)
        corrected = corrected.not(
          "id",
          "in",
          `(${assignedWithoutIncludedAssignee.join(",")})`,
        );
    } else if (includedAssigneeIds.length) {
      corrected = corrected.in(
        "id",
        includedAssigneeTaskIds.length
          ? includedAssigneeTaskIds
          : ["00000000-0000-0000-0000-000000000000"],
      );
    }
    if (excludeUnassigned)
      corrected = corrected.in(
        "id",
        assignedTaskIds.length
          ? assignedTaskIds
          : ["00000000-0000-0000-0000-000000000000"],
      );
    if (excludedAssigneeTaskIds.length)
      corrected = corrected.not(
        "id",
        "in",
        `(${excludedAssigneeTaskIds.join(",")})`,
      );
    for (const [includeParam, excludeParam, column] of TASK_EXACT_FILTERS) {
      const included = (params.get(includeParam) ?? "")
        .split(",")
        .filter((value) => value && value !== "all");
      const excluded = (params.get(excludeParam) ?? "")
        .split(",")
        .filter(Boolean);
      const includeNull = included.some(
        (value) => value === "none" || value === "unassigned",
      );
      const excludeNull = excluded.some(
        (value) => value === "none" || value === "unassigned",
      );
      const includedValues = included.filter(
        (value) => value !== "none" && value !== "unassigned",
      );
      const excludedValues = excluded.filter(
        (value) => value !== "none" && value !== "unassigned",
      );
      if (includeNull && includedValues.length)
        corrected = corrected.or(
          `${column}.is.null,${column}.in.(${includedValues.join(",")})`,
        );
      else if (includeNull) corrected = corrected.is(column, null);
      else if (includedValues.length)
        corrected = corrected.in(column, includedValues);
      if (excludeNull) corrected = corrected.not(column, "is", null);
      if (excludedValues.length)
        corrected = corrected.not(
          column,
          "in",
          `(${excludedValues.join(",")})`,
        );
    }
    if (hasDueWithinFilter)
      corrected = corrected.gte("due_date", today).lte("due_date", dueBoundary);
    if (excludedDueDays)
      corrected = corrected.or(
        `due_date.is.null,due_date.lt.${today},due_date.gt.${excludedDueBoundary}`,
      );
    if (includedCategoryIds.length)
      corrected = corrected.in(
        "id",
        includedTaskIds.length
          ? includedTaskIds
          : ["00000000-0000-0000-0000-000000000000"],
      );
    if (excludedTaskIds.length)
      corrected = corrected.not("id", "in", `(${excludedTaskIds.join(",")})`);
    if (includedTags.length)
      corrected = corrected.in(
        "id",
        includedTagTaskIds.length
          ? includedTagTaskIds
          : ["00000000-0000-0000-0000-000000000000"],
      );
    if (excludedTagTaskIds.length)
      corrected = corrected.not(
        "id",
        "in",
        `(${excludedTagTaskIds.join(",")})`,
      );
    if (search)
      corrected = corrected.or(
        `title.ilike.%${search}%,description.ilike.%${search}%`,
      );
    corrected =
      sort === "due"
        ? corrected
            .order("due_date", { ascending: true, nullsFirst: false })
            .order("id", { ascending: true })
        : sort === "closed"
          ? corrected
              .order("completed_at", { ascending: false, nullsFirst: false })
              .order("id", { ascending: false })
          : corrected
              .order("updated_at", { ascending: false })
              .order("id", { ascending: false });
    result = await corrected.range(pageState.from, pageState.to);
    if (result.error)
      return databaseFailure(request, "tasks.list", result.error, {
        error: "Tasks could not be loaded. Try again.",
      });
    totalCount = pageState.totalCount;
  }
  const tasks = (result.data ?? []) as unknown as Task[];
  const taskIds = tasks.map((task) => task.id);
  const [categories, assignees, labels] = taskIds.length
    ? await Promise.all([
        supabase
          .from("task_categories")
          .select(TASK_CATEGORY_COLUMNS)
          .in("task_id", taskIds),
        supabase
          .from("task_assignees")
          .select(TASK_ASSIGNEE_COLUMNS)
          .in("task_id", taskIds),
        supabase
          .from("task_labels")
          .select(TASK_LABEL_COLUMNS)
          .in("task_id", taskIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const relationError = categories.error ?? assignees.error ?? labels.error;
  if (relationError)
    return databaseFailure(request, "tasks.list-relations", relationError, {
      error: "Task details could not be loaded. Try again.",
    });
  return NextResponse.json({
    tasks,
    taskCategories: categories.data ?? [],
    taskAssignees: assignees.data ?? [],
    taskLabels: labels.data ?? [],
    page: paginated
      ? {
          page: pageState.page,
          pageSize: pageState.pageSize,
          totalCount,
        }
      : {
          page: 1,
          pageSize: tasks.length || pageSize,
          totalCount: tasks.length,
        },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = await readJson(request, taskSaveSchema);
  if ("response" in parsed) return parsed.response;
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;
  const previous = parsed.data.id
    ? await loadTaskChangeSnapshot(authorization.supabase, parsed.data.id)
    : null;
  const { data, error } = await saveTask(authorization.supabase, parsed.data);
  if (isMissingStatusReason(error)) return operationFailed(error!.message);
  if (error)
    return databaseFailure(request, "task.save", error, {
      error: "The task could not be saved. Try again.",
      conflictError:
        "This task conflicts with a recent change. Refresh and try again.",
    });
  if (previous)
    await recordTaskChangeActivity(
      data.activity_id,
      taskUpdateChanges(
        summarizeTaskChanges(
          previous,
          savedTaskSnapshot(
            data.task,
            parsed.data.categoryIds,
            parsed.data.assigneeIds,
          ),
        ),
      ),
    );
  // Read after the change summary is attached, so the client is handed the
  // finished audit row rather than the bare one the trigger wrote.
  const recorded = await savedTaskRecords(
    authorization.supabase,
    data.task.id,
    parsed.data.statusReason,
  );
  return NextResponse.json({ ...data, ...recorded });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const parsed = await readJson(request, taskMoveSchema);
  if ("response" in parsed) return parsed.response;
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;
  const { data, error } = await moveTask(authorization.supabase, parsed.data);
  if (isMissingStatusReason(error)) return operationFailed(error!.message);
  if (error)
    return databaseFailure(request, "task.move", error, {
      error: "The task could not be moved. Refresh and try again.",
    });
  const recorded = await savedTaskRecords(
    authorization.supabase,
    data.id,
    parsed.data.statusReason,
  );
  return NextResponse.json({ task: data, ...recorded });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const parsed = await readJson(request, idSchema);
  if ("response" in parsed) return parsed.response;
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;
  const { data, error } = await deleteTask(
    authorization.supabase,
    parsed.data.id,
  );
  if (error)
    return databaseFailure(request, "task.delete", error, {
      error: "The task could not be deleted. Try again.",
    });
  return NextResponse.json({ id: data });
}
