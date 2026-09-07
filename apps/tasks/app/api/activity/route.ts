import { NextResponse } from "next/server";
import { authorize } from "@/lib/server/auth";
import { apiError, databaseFailure } from "@/lib/server/api-response";
import { derivePagination, parsePagination } from "@/lib/pagination";
import { WORKSPACE_COLUMNS } from "@/lib/server/workspace-loader";
import type { Task } from "@/lib/tasks/task-types";
import type { TaskActivity } from "@/lib/activity/activity-types";
import { activityEventKind } from "@/lib/activity/activity-events";
import {
  activityStatusMove,
  matchesExcludedMoves,
  matchesIncludedMoves,
  parseMoveFilter,
} from "@/lib/activity/activity-moves";
import {
  ACCESS_PREVIEW_PARAM,
  USER_ACCESS_PREVIEW_PARAM,
} from "@/lib/access/access-preview";
import { resolveAccessPreview } from "@/lib/server/access-preview";
import {
  canViewWorkspaceArea,
  WORKSPACE_AREA_KEYS,
  type WorkspaceAreaKey,
} from "@/lib/access/workspace-areas";
import { getAdminClient } from "@/lib/server/admin-client";
import { isMissingFunction } from "@/lib/server/supabase-errors";

const DAY = 24 * 60 * 60 * 1000;

/** The oldest timestamp a `when` filter admits, or null for "any time". */
function activityCutoff(when: string | null) {
  const windowMs =
    when === "day"
      ? DAY
      : when === "week"
        ? 7 * DAY
        : when === "month"
          ? 30 * DAY
          : null;
  return windowMs ? new Date(Date.now() - windowMs) : null;
}

/**
 * Narrows the task-activity query in SQL.
 *
 * Only the filters that map cleanly onto a column belong here. Event kinds
 * deliberately do not: a kind such as "note" or "comment" spans both sources,
 * so translating one half of an include list into SQL would drop rows the JS
 * filter downstream would have kept.
 */
function applyActivityFilters<
  T extends {
    eq: (column: string, value: string) => T;
    in: (column: string, values: string[]) => T;
    is: (column: string, value: null) => T;
    ilike: (column: string, pattern: string) => T;
    not: (column: string, operator: string, value: string | null) => T;
    gte: (column: string, value: string) => T;
    or: (filters: string, options?: { referencedTable?: string }) => T;
  },
>(
  query: T,
  params: URLSearchParams,
  previewProjectIds?: string[],
  previewInaccessibleTaskIds: string[] = [],
) {
  const values = (name: string, legacyName?: string) =>
    (params.get(name) ?? (legacyName ? params.get(legacyName) : null) ?? "")
      .split(",")
      .filter(Boolean);
  if (previewProjectIds) {
    const projectFilter = previewProjectIds.length
      ? `project_id.is.null,project_id.in.(${previewProjectIds.join(",")})`
      : "project_id.is.null";
    query = query.or(projectFilter, { referencedTable: "tasks" });
  }
  if (previewInaccessibleTaskIds.length)
    query = query.not(
      "tasks.id",
      "in",
      `(${previewInaccessibleTaskIds.join(",")})`,
    );
  const projects = values("projects", "project").filter(
    (value) => value !== "all",
  );
  const excludedProjects = values("excludeProjects");
  const projectIds = projects.filter((value) => value !== "none");
  if (projects.includes("none")) {
    const filter = projectIds.length
      ? `project_id.is.null,project_id.in.(${projectIds.join(",")})`
      : "project_id.is.null";
    query = query.or(filter, { referencedTable: "tasks" });
  } else if (projectIds.length)
    query = query.in("tasks.project_id", projectIds);
  if (excludedProjects.includes("none"))
    query = query.not("tasks.project_id", "is", null);
  const excludedProjectIds = excludedProjects.filter(
    (value) => value !== "none",
  );
  if (excludedProjectIds.length)
    query = query.not(
      "tasks.project_id",
      "in",
      `(${excludedProjectIds.join(",")})`,
    );

  query = applyActorFilters(query, params);

  const cutoff = activityCutoff(params.get("when"));
  if (cutoff) query = query.gte("created_at", cutoff.toISOString());
  return query;
}

/** The actor half of the filter set, shared by both activity sources. */
function applyActorFilters<
  T extends {
    in: (column: string, values: string[]) => T;
    not: (column: string, operator: string, value: string | null) => T;
    or: (filters: string, options?: { referencedTable?: string }) => T;
  },
>(query: T, params: URLSearchParams) {
  const values = (name: string, legacyName?: string) =>
    (params.get(name) ?? (legacyName ? params.get(legacyName) : null) ?? "")
      .split(",")
      .filter(Boolean);
  const people = values("people", "person").filter((value) => value !== "all");
  const excludedPeople = values("excludePeople");
  const personIds = people.filter((value) => value !== "system");
  if (people.includes("system")) {
    const filter = personIds.length
      ? `actor_id.is.null,actor_id.in.(${personIds.join(",")})`
      : "actor_id.is.null";
    query = query.or(filter);
  } else if (personIds.length) query = query.in("actor_id", personIds);
  if (excludedPeople.includes("system"))
    query = query.not("actor_id", "is", null);
  const excludedPersonIds = excludedPeople.filter(
    (value) => value !== "system",
  );
  if (excludedPersonIds.length)
    query = query.not("actor_id", "in", `(${excludedPersonIds.join(",")})`);
  return query;
}

export async function GET(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;
  const params = new URL(request.url).searchParams;
  const { requestedPage, pageSize } = parsePagination(params);
  const selection = `${WORKSPACE_COLUMNS.activity},tasks!inner(${WORKSPACE_COLUMNS.tasks})`;
  let previewProjectIds: string[] | undefined;
  let previewInaccessibleTaskIds: string[] = [];
  // Resource activity is read with the service-role key, so nothing about a
  // locked page filters itself out. Which pages the caller reaches has to be
  // asked for explicitly and applied below.
  const areaResult = await authorization.supabase.rpc(
    "accessible_workspace_areas",
    { requested_areas: WORKSPACE_AREA_KEYS },
  );
  if (areaResult.error && !isMissingFunction(areaResult.error.code))
    return databaseFailure(request, "activity.page-access", areaResult.error, {
      error: "Activity permissions could not be resolved. Try again.",
    });
  let accessibleAreas: WorkspaceAreaKey[] = areaResult.error
    ? [...WORKSPACE_AREA_KEYS]
    : ((areaResult.data ?? []) as WorkspaceAreaKey[]);
  const requestedGroupPreview = params.get(ACCESS_PREVIEW_PARAM) ?? undefined;
  const requestedUserPreview =
    params.get(USER_ACCESS_PREVIEW_PARAM) ?? undefined;
  // Asked once: it gates both the access preview and the owner-only page
  // access events below.
  const { data: isOwner } = await authorization.supabase.rpc("is_app_owner");
  const callerIsOwner = isOwner === true;
  if (requestedGroupPreview || requestedUserPreview) {
    if (callerIsOwner) {
      const { data: projects, error: projectsError } =
        await authorization.supabase.from("projects").select("id");
      if (projectsError)
        return databaseFailure(
          request,
          "activity.preview-projects",
          projectsError,
          {
            error: "Activity could not be loaded. Try again.",
          },
        );
      const resolved = await resolveAccessPreview(authorization.supabase, {
        groupId: requestedGroupPreview,
        userName: requestedUserPreview,
        allProjectIds: (projects ?? []).map((project) => project.id),
      });
      if (resolved) {
        previewProjectIds = resolved.projectIds;
        previewInaccessibleTaskIds = resolved.preview.inaccessibleTaskIds ?? [];
        accessibleAreas = resolved.preview.accessibleAreas ?? [
          ...WORKSPACE_AREA_KEYS,
        ];
      }
    }
  }

  // Resource activity lives in a table only the service role may read, so
  // without a key the feed would quietly render as task activity alone. A
  // half-empty page that looks complete is worse than an outage: the two Tasks
  // instances are configured separately, so one can be misconfigured for weeks
  // while the other is fine.
  const admin = getAdminClient();
  if (!admin)
    return apiError(
      503,
      "SERVICE_UNAVAILABLE",
      "Activity is temporarily unavailable.",
    );

  let itemQuery = authorization.supabase
    .from("task_activity")
    .select(selection);
  itemQuery = applyActivityFilters(
    itemQuery,
    params,
    previewProjectIds,
    previewInaccessibleTaskIds,
  );
  const cutoff = activityCutoff(params.get("when"));
  let auditQuery = admin
    .from("permission_audit_events")
    .select("id,actor_id,action,target_type,target_id,after_state,created_at")
    .contains("after_state", { activity: true });
  auditQuery = applyActorFilters(auditQuery, params);
  if (cutoff) auditQuery = auditQuery.gte("created_at", cutoff.toISOString());

  const [result, auditResult] = await Promise.all([
    itemQuery
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(5000),
    auditQuery
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(5000),
  ]);
  if (result.error)
    return databaseFailure(request, "activity.list", result.error, {
      error: "Activity could not be loaded. Try again.",
    });
  if (auditResult.error)
    return databaseFailure(request, "activity.resources", auditResult.error, {
      error: "Resource activity could not be loaded. Try again.",
    });

  const rows = (result.data ?? []) as unknown as Array<
    TaskActivity & { tasks: Task }
  >;
  const tasks = [
    ...new Map(rows.map((row) => [row.tasks.id, row.tasks])).values(),
  ];
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const [visibleProjectsResult, visibleCategoriesResult, visibleNotesResult] =
    await Promise.all([
      authorization.supabase.from("projects").select("id"),
      authorization.supabase.from("work_groups").select("id"),
      authorization.supabase.from("notes").select("id"),
    ]);
  const visibilityError =
    visibleProjectsResult.error ??
    visibleCategoriesResult.error ??
    visibleNotesResult.error;
  if (visibilityError)
    return databaseFailure(request, "activity.visibility", visibilityError, {
      error: "Activity permissions could not be resolved. Try again.",
    });
  const visibleProjectIds = new Set(
    (visibleProjectsResult.data ?? []).map((item) => item.id),
  );
  const visibleCategoryIds = new Set(
    (visibleCategoriesResult.data ?? []).map((item) => item.id),
  );
  const visibleNoteIds = new Set(
    (visibleNotesResult.data ?? []).map((item) => item.id),
  );

  /**
   * Whether the caller may read one resource event.
   *
   * Deletions are the awkward case: the row is gone, so "can you still see it"
   * can only ever answer no, and the event would be invisible to everyone
   * (including, before this, to everyone but the person who deleted it). A
   * resource disappearing is a workspace-level fact in the way an edit to it
   * is not, so the three top-level deletions are shown to the whole team --
   * and only those, never the `.attachment.delete` events that share the
   * `project` and `category` target types.
   */
  const workspaceDeletions = new Set([
    "project.delete",
    "category.delete",
    "note.delete",
  ]);
  const canView = (area: WorkspaceAreaKey) =>
    canViewWorkspaceArea(accessibleAreas, area);
  /**
   * The page a resource event belongs to, when it belongs to one. A member who
   * cannot open Notes must not read that a note was written, edited, or
   * deleted -- including through the workspace-deletion exception below, which
   * exists so a disappearing resource stays legible, not so a locked page
   * leaks through it.
   */
  const eventArea = (targetType: string): WorkspaceAreaKey | null => {
    if (targetType === "note") return "notes";
    if (targetType === "organization" || targetType === "contact_category")
      return "contacts";
    if (targetType === "calendar_event") return "calendar";
    return null;
  };
  const resourceVisible = (
    event: {
      action: string;
      target_type: string;
      target_id: string | null;
    },
    metadata: Record<string, unknown>,
  ) => {
    const area = eventArea(event.target_type);
    if (area && !canView(area)) return false;
    if (workspaceDeletions.has(event.action)) return true;
    const scoped = (name: string, visible: Set<string>) => {
      const value = metadata[name];
      return typeof value !== "string" || visible.has(value);
    };
    switch (event.target_type) {
      case "project":
        return Boolean(
          event.target_id && visibleProjectIds.has(event.target_id),
        );
      case "category":
        return Boolean(
          event.target_id && visibleCategoryIds.has(event.target_id),
        );
      case "note":
        return Boolean(event.target_id && visibleNoteIds.has(event.target_id));
      // A calendar event is readable per project *and* per category, matching
      // the `calendar_events_select` policy. The ids are recorded on the event
      // itself, so this still resolves after the event is deleted.
      case "calendar_event":
        return (
          scoped("project_id", visibleProjectIds) &&
          scoped("category_id", visibleCategoryIds)
        );
      case "task":
        return scoped("project_id", visibleProjectIds);
      // Contacts, contact categories, statuses, access groups, teammates and
      // workspace settings are not access-scoped: every teammate sees them.
      case "organization":
      case "contact_category":
      case "status":
      case "status_collection":
      case "access_group":
      case "profile":
      case "workspace":
        return true;
      // Which groups reach which page is owner-only administrative data, and
      // this feed is read with the service-role key, so it is gated here.
      case "workspace_area":
        return callerIsOwner;
      default:
        return false;
    }
  };

  const taskActivity = rows.map(({ tasks: relatedTask, ...item }) => {
    void relatedTask;
    return item;
  });
  const resourceActivity = (auditResult.data ?? []).flatMap((event) => {
    const metadata = (event.after_state ?? {}) as Record<string, unknown>;
    if (!resourceVisible(event, metadata)) return [];
    const text = (name: string) =>
      typeof metadata[name] === "string"
        ? (metadata[name] as string)
        : undefined;
    return [
      {
        id: event.id,
        task_id: null,
        actor_id: event.actor_id,
        action: event.action,
        details: {
          resource_type: event.target_type,
          resource_id: event.target_id ?? undefined,
          resource_name: text("resource_name"),
          resource_href: text("resource_href"),
          project_id: text("project_id"),
          category_id: text("category_id"),
          attachment_name: text("attachment_name"),
          detail: text("detail"),
        },
        created_at: event.created_at,
      } satisfies TaskActivity,
    ];
  });
  const values = (name: string) =>
    (params.get(name) ?? "").split(",").filter(Boolean);
  const includedProjects = values("projects");
  const excludedProjects = values("excludeProjects");
  const includedPeople = values("people");
  const excludedPeople = values("excludePeople");
  const includedEvents = values("events");
  const excludedEvents = values("excludeEvents");
  // Status ids, already resolved by the caller. Like event kinds these stay
  // out of SQL: the pair lives in `details`, and only half of a move is a
  // column the task query could narrow on.
  const includedMoves = parseMoveFilter(values("moves"));
  const excludedMoves = parseMoveFilter(values("excludeMoves"));
  const cutoffTime = cutoff?.getTime() ?? null;
  const allActivity = [...taskActivity, ...resourceActivity]
    .filter((item) => {
      const task = item.task_id ? taskById.get(item.task_id) : undefined;
      const projectId = task?.project_id ?? item.details.project_id ?? null;
      const projectValue = projectId ?? "none";
      const actorValue = item.actor_id ?? "system";
      const kind = activityEventKind(item.action);
      const move = activityStatusMove(item);
      return (
        (!includedProjects.length || includedProjects.includes(projectValue)) &&
        !excludedProjects.includes(projectValue) &&
        (!includedPeople.length || includedPeople.includes(actorValue)) &&
        !excludedPeople.includes(actorValue) &&
        (!includedEvents.length || includedEvents.includes(kind)) &&
        !excludedEvents.includes(kind) &&
        matchesIncludedMoves(move, includedMoves) &&
        !matchesExcludedMoves(move, excludedMoves) &&
        (!cutoffTime || new Date(item.created_at).getTime() >= cutoffTime) &&
        (!previewProjectIds ||
          !projectId ||
          previewProjectIds.includes(projectId))
      );
    })
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
  const page = derivePagination(requestedPage, pageSize, allActivity.length);
  const activity = allActivity.slice(page.from, page.to + 1);
  return NextResponse.json({
    activity,
    tasks,
    page: {
      page: page.page,
      pageSize: page.pageSize,
      totalCount: page.totalCount,
    },
  });
}
