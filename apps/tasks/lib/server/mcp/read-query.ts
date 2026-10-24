import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { CALENDAR_EVENT_COLUMNS } from "@/lib/calendar/calendar-types";
import { CONTACT_COLUMNS } from "@/lib/contacts/contact-types";
import { noteColumns, noteCommentColumns } from "@/lib/resources/notes";
import { DIGEST_SETTINGS_COLUMNS } from "@/lib/server/digest-settings";
import { WORKSPACE_COLUMNS } from "@/lib/server/workspace-loader";
import { parseTaskKey, taskKey } from "@/lib/tasks/task-key";
import { isUuid } from "@/lib/api-schema/shared";
import {
  filterRydProfiles,
  loadRydProfiles,
  rydOrderFilters,
  rydSalesInsights,
} from "@/lib/server/mcp/ryd-read";
import type {
  McpReadAction,
  McpReadResult,
} from "@/lib/server/mcp/read-types";

type AdminClient = SupabaseClient;
type Row = Record<string, unknown>;
type HydratedTask = Row & {
  key: string;
  status: Row | null;
  project: Row | null;
  reporter: Row | null;
  creator: Row | null;
  assignees: Row[];
  categories: Row[];
  labels: Row[];
};
type QueryResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
  count?: number | null;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_METRIC_ROWS = 5000;
const RESOURCE_ATTACHMENT_COLUMNS =
  "id,kind,name,body,url,file_path,mime_type,size_bytes,created_by,created_at,sort_order";

function required(result: QueryResult): unknown {
  if (result.error) throw result.error;
  return result.data;
}

function rows(result: QueryResult): Row[] {
  const data = required(result);
  return Array.isArray(data) ? (data as Row[]) : [];
}

function row(result: QueryResult): Row | null {
  const data = required(result);
  return data && typeof data === "object" ? (data as Row) : null;
}

function textParam(
  params: Record<string, unknown>,
  name: string,
  maxLength = 200,
) {
  const value = params[name];
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : null;
}

function booleanParam(
  params: Record<string, unknown>,
  name: string,
  fallback = false,
) {
  return typeof params[name] === "boolean" ? params[name] : fallback;
}

function stringList(params: Record<string, unknown>, name: string) {
  const value = params[name];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .slice(0, 50);
}

function dateParam(params: Record<string, unknown>, name: string) {
  const value = textParam(params, name, 10);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function limitParam(params: Record<string, unknown>) {
  const value = params.limit;
  return typeof value === "number" && Number.isSafeInteger(value)
    ? Math.min(MAX_LIMIT, Math.max(1, value))
    : DEFAULT_LIMIT;
}

function decodeOffset(value: unknown) {
  if (typeof value !== "string" || value.length > 200) return 0;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString());
    return typeof decoded.offset === "number" &&
      Number.isSafeInteger(decoded.offset) &&
      decoded.offset >= 0
      ? decoded.offset
      : 0;
  } catch {
    return 0;
  }
}

function pagination(
  params: Record<string, unknown>,
  count: number | null | undefined,
  returned: number,
) {
  const limit = limitParam(params);
  const offset = decodeOffset(params.cursor);
  const hasMore = count == null ? returned === limit : offset + returned < count;
  return {
    limit,
    offset,
    nextCursor: hasMore
      ? Buffer.from(JSON.stringify({ offset: offset + returned })).toString(
          "base64url",
        )
      : null,
    totalCount: count ?? null,
  };
}

async function catalogs(admin: AdminClient) {
  const [statuses, projects, categories, profiles, labels] = await Promise.all([
    admin.from("statuses").select(WORKSPACE_COLUMNS.statuses).order("sort_order"),
    admin.from("projects").select(WORKSPACE_COLUMNS.projects).order("name"),
    admin.from("work_groups").select(WORKSPACE_COLUMNS.categories).order("name"),
    admin.from("profiles").select(WORKSPACE_COLUMNS.profiles).order("full_name"),
    admin.from("labels").select(WORKSPACE_COLUMNS.labels).order("name"),
  ]);
  return {
    statuses: rows(statuses),
    projects: rows(projects),
    categories: rows(categories),
    profiles: rows(profiles),
    labels: rows(labels),
  };
}

function byId(items: Row[]) {
  return new Map(items.map((item) => [String(item.id), item]));
}

function relatedBy<T extends Row>(items: T[], key: string) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const id = String(item[key]);
    grouped.set(id, [...(grouped.get(id) ?? []), item]);
  }
  return grouped;
}

async function taskRelations(admin: AdminClient, taskIds: string[]) {
  if (!taskIds.length)
    return {
      assignees: [] as Row[],
      categories: [] as Row[],
      labels: [] as Row[],
    };
  const [assignees, categories, labels] = await Promise.all([
    admin
      .from("task_assignees")
      .select(WORKSPACE_COLUMNS.taskAssignees)
      .in("task_id", taskIds),
    admin
      .from("task_categories")
      .select(WORKSPACE_COLUMNS.taskCategories)
      .in("task_id", taskIds),
    admin
      .from("task_labels")
      .select(WORKSPACE_COLUMNS.taskLabels)
      .in("task_id", taskIds),
  ]);
  return {
    assignees: rows(assignees),
    categories: rows(categories),
    labels: rows(labels),
  };
}

async function hydrateTasks(
  admin: AdminClient,
  tasks: Row[],
): Promise<HydratedTask[]> {
  const catalog = await catalogs(admin);
  const relations = await taskRelations(
    admin,
    tasks.map((task) => String(task.id)),
  );
  const statusMap = byId(catalog.statuses);
  const projectMap = byId(catalog.projects);
  const categoryMap = byId(catalog.categories);
  const profileMap = byId(catalog.profiles);
  const labelMap = byId(catalog.labels);
  const assignees = relatedBy(relations.assignees, "task_id");
  const categories = relatedBy(relations.categories, "task_id");
  const labels = relatedBy(relations.labels, "task_id");

  return tasks.map((task) => {
    const id = String(task.id);
    return {
      ...task,
      key: taskKey({ task_number: Number(task.task_number) }),
      status: statusMap.get(String(task.status_id)) ?? null,
      project: task.project_id
        ? projectMap.get(String(task.project_id)) ?? null
        : null,
      reporter: profileMap.get(String(task.reported_by)) ?? null,
      creator: profileMap.get(String(task.created_by)) ?? null,
      assignees: (assignees.get(id) ?? []).flatMap((relation) => {
        const profile = profileMap.get(String(relation.profile_id));
        return profile ? [profile] : [];
      }),
      categories: (categories.get(id) ?? []).flatMap((relation) => {
        const category = categoryMap.get(String(relation.category_id));
        return category ? [category] : [];
      }),
      labels: (labels.get(id) ?? []).flatMap((relation) => {
        const label = labelMap.get(String(relation.label_id));
        return label ? [label] : [];
      }),
    } as HydratedTask;
  });
}

async function listTasks(
  admin: AdminClient,
  params: Record<string, unknown>,
) {
  const limit = limitParam(params);
  const offset = decodeOffset(params.cursor);
  let query = admin.from("tasks").select(WORKSPACE_COLUMNS.tasks, {
    count: "exact",
  });
  const projectIds = stringList(params, "projectIds").filter(isUuid);
  const categoryIds = stringList(params, "categoryIds").filter(isUuid);
  const statusIds = stringList(params, "statusIds").filter(isUuid);
  const assigneeIds = stringList(params, "assigneeIds").filter(isUuid);
  const priorities = stringList(params, "priorities").filter((value) =>
    ["low", "medium", "high", "urgent"].includes(value),
  );
  if (projectIds.length) query = query.in("project_id", projectIds);
  if (statusIds.length) query = query.in("status_id", statusIds);
  if (priorities.length) query = query.in("priority", priorities);
  if (!booleanParam(params, "includeArchived"))
    query = query.is("archived_at", null);
  const updatedFrom = dateParam(params, "updatedFrom");
  const updatedTo = dateParam(params, "updatedTo");
  if (updatedFrom) query = query.gte("updated_at", `${updatedFrom}T00:00:00Z`);
  if (updatedTo) query = query.lt("updated_at", `${updatedTo}T23:59:59.999Z`);
  const title = textParam(params, "query", 200);
  if (title) query = query.ilike("title", `%${title}%`);

  if (categoryIds.length) {
    const related = await admin
      .from("task_categories")
      .select("task_id")
      .in("category_id", categoryIds);
    const ids = [...new Set(rows(related).map((item) => String(item.task_id)))];
    if (!ids.length)
      return { items: [], pagination: pagination(params, 0, 0) };
    query = query.in("id", ids);
  }
  if (assigneeIds.length) {
    const related = await admin
      .from("task_assignees")
      .select("task_id")
      .in("profile_id", assigneeIds);
    const ids = [...new Set(rows(related).map((item) => String(item.task_id)))];
    if (!ids.length)
      return { items: [], pagination: pagination(params, 0, 0) };
    query = query.in("id", ids);
  }

  const result = await query
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  const taskRows = rows(result);
  return {
    items: await hydrateTasks(admin, taskRows),
    pagination: pagination(params, result.count, taskRows.length),
  };
}

async function getTask(admin: AdminClient, params: Record<string, unknown>) {
  const reference = textParam(params, "key", 100) ?? textParam(params, "id", 100);
  if (!reference) throw { code: "22P02", message: "A task key is required." };
  const number = parseTaskKey(reference);
  let query = admin.from("tasks").select(WORKSPACE_COLUMNS.tasks);
  query = number
    ? query.eq("task_number", number)
    : isUuid(reference)
      ? query.eq("id", reference)
      : query.eq("id", "00000000-0000-0000-0000-000000000000");
  const result = await query.maybeSingle();
  const task = row(result);
  if (!task) return null;
  const taskId = String(task.id);
  const [hydrated, subtasks, comments, activity, attachments] =
    await Promise.all([
      hydrateTasks(admin, [task]),
      admin
        .from("subtasks")
        .select(WORKSPACE_COLUMNS.subtasks)
        .eq("task_id", taskId)
        .order("sort_order"),
      admin
        .from("task_comments")
        .select(WORKSPACE_COLUMNS.comments)
        .eq("task_id", taskId)
        .order("created_at"),
      admin
        .from("task_activity")
        .select(WORKSPACE_COLUMNS.activity)
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(500),
      admin
        .from("task_attachments")
        .select(WORKSPACE_COLUMNS.attachments)
        .eq("task_id", taskId)
        .order("created_at"),
    ]);
  return {
    ...hydrated[0],
    subtasks: rows(subtasks),
    comments: rows(comments),
    activity: rows(activity),
    attachments: rows(attachments),
  };
}

async function pagedTable(
  admin: AdminClient,
  params: Record<string, unknown>,
  options: {
    table: string;
    columns: string;
    order: string;
    ascending?: boolean;
    archivedColumn?: string;
    searchColumn?: string;
  },
) {
  const limit = limitParam(params);
  const offset = decodeOffset(params.cursor);
  let query = admin.from(options.table).select(options.columns, { count: "exact" });
  if (options.archivedColumn && !booleanParam(params, "includeArchived"))
    query = query.is(options.archivedColumn, null);
  const search = textParam(params, "query", 200);
  if (search && options.searchColumn)
    query = query.ilike(options.searchColumn, `%${search}%`);
  const result = await query
    .order(options.order, { ascending: options.ascending ?? false })
    .range(offset, offset + limit - 1);
  const items = rows(result);
  return { items, pagination: pagination(params, result.count, items.length) };
}

async function listNotes(admin: AdminClient, params: Record<string, unknown>) {
  const result = await pagedTable(admin, params, {
    table: "notes",
    columns: noteColumns,
    order: "updated_at",
    archivedColumn: "archived_at",
    searchColumn: "body",
  });
  const profileResult = await admin
    .from("profiles")
    .select(WORKSPACE_COLUMNS.profiles);
  const categoryResult = await admin
    .from("work_groups")
    .select(WORKSPACE_COLUMNS.categories);
  const profiles = byId(rows(profileResult));
  const categories = byId(rows(categoryResult));
  return {
    ...result,
    items: result.items.map((note) => ({
      ...note,
      creator: profiles.get(String(note.created_by)) ?? null,
      category: note.category_id
        ? categories.get(String(note.category_id)) ?? null
        : null,
    })),
  };
}

async function getNote(admin: AdminClient, params: Record<string, unknown>) {
  const id = textParam(params, "id", 100);
  if (!id || !isUuid(id)) return null;
  const [noteResult, commentsResult, profileResult, categoryResult] =
    await Promise.all([
      admin.from("notes").select(noteColumns).eq("id", id).maybeSingle(),
      admin
        .from("note_comments")
        .select(noteCommentColumns)
        .eq("note_id", id)
        .order("created_at"),
      admin.from("profiles").select(WORKSPACE_COLUMNS.profiles),
      admin.from("work_groups").select(WORKSPACE_COLUMNS.categories),
    ]);
  const note = row(noteResult);
  if (!note) return null;
  const profiles = byId(rows(profileResult));
  const categories = byId(rows(categoryResult));
  return {
    ...note,
    creator: profiles.get(String(note.created_by)) ?? null,
    category: note.category_id
      ? categories.get(String(note.category_id)) ?? null
      : null,
    comments: rows(commentsResult).map((comment) => ({
      ...comment,
      creator: profiles.get(String(comment.created_by)) ?? null,
    })),
  };
}

async function getProject(
  admin: AdminClient,
  params: Record<string, unknown>,
) {
  const id = textParam(params, "id", 100);
  const name = textParam(params, "name", 200);
  let query = admin.from("projects").select(WORKSPACE_COLUMNS.projects);
  query = id && isUuid(id)
    ? query.eq("id", id)
    : name
      ? query.ilike("name", name)
      : query.eq("id", "00000000-0000-0000-0000-000000000000");
  const projectResult = await query.maybeSingle();
  const project = row(projectResult);
  if (!project) return null;
  const projectId = String(project.id);
  const [owners, grants, attachments, tasks, profiles, groups] =
    await Promise.all([
      admin.from("project_owners").select("project_id,profile_id").eq("project_id", projectId),
      admin
        .from("project_group_grants")
        .select("project_id,group_id,permission,created_at,updated_at")
        .eq("project_id", projectId),
      admin
        .from("project_attachments")
        .select(`project_id,${RESOURCE_ATTACHMENT_COLUMNS}`)
        .eq("project_id", projectId)
        .order("sort_order"),
      admin
        .from("tasks")
        .select(WORKSPACE_COLUMNS.tasks)
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false })
        .limit(500),
      admin.from("profiles").select(WORKSPACE_COLUMNS.profiles),
      admin.from("access_groups").select("id,name,description,kind,hierarchy_rank,grants_global_content"),
    ]);
  const profileMap = byId(rows(profiles));
  const groupMap = byId(rows(groups));
  return {
    ...project,
    owners: rows(owners).flatMap((owner) => {
      const profile = profileMap.get(String(owner.profile_id));
      return profile ? [profile] : [];
    }),
    grants: rows(grants).map((grant) => ({
      ...grant,
      group: groupMap.get(String(grant.group_id)) ?? null,
    })),
    attachments: rows(attachments),
    tasks: await hydrateTasks(admin, rows(tasks)),
    taskResultCapped: rows(tasks).length === 500,
  };
}

async function getCategory(
  admin: AdminClient,
  params: Record<string, unknown>,
) {
  const id = textParam(params, "id", 100);
  const name = textParam(params, "name", 200);
  let query = admin.from("work_groups").select(WORKSPACE_COLUMNS.categories);
  query = id && isUuid(id)
    ? query.eq("id", id)
    : name
      ? query.ilike("name", name)
      : query.eq("id", "00000000-0000-0000-0000-000000000000");
  const categoryResult = await query.maybeSingle();
  const category = row(categoryResult);
  if (!category) return null;
  const categoryId = String(category.id);
  const [owners, grants, attachments, relations, profiles, groups] =
    await Promise.all([
      admin.from("category_owners").select("category_id,profile_id").eq("category_id", categoryId),
      admin
        .from("category_group_grants")
        .select("category_id,group_id,created_at")
        .eq("category_id", categoryId),
      admin
        .from("category_attachments")
        .select(`category_id,${RESOURCE_ATTACHMENT_COLUMNS}`)
        .eq("category_id", categoryId)
        .order("sort_order"),
      admin.from("task_categories").select("task_id").eq("category_id", categoryId).limit(500),
      admin.from("profiles").select(WORKSPACE_COLUMNS.profiles),
      admin.from("access_groups").select("id,name,description,kind,hierarchy_rank,grants_global_content"),
    ]);
  const profileMap = byId(rows(profiles));
  const groupMap = byId(rows(groups));
  const taskIds = rows(relations).map((relation) => String(relation.task_id));
  const tasks = taskIds.length
    ? await admin.from("tasks").select(WORKSPACE_COLUMNS.tasks).in("id", taskIds)
    : ({ data: [], error: null } as QueryResult);
  return {
    ...category,
    owners: rows(owners).flatMap((owner) => {
      const profile = profileMap.get(String(owner.profile_id));
      return profile ? [profile] : [];
    }),
    grants: rows(grants).map((grant) => ({
      ...grant,
      group: groupMap.get(String(grant.group_id)) ?? null,
    })),
    attachments: rows(attachments),
    tasks: await hydrateTasks(admin, rows(tasks)),
    taskResultCapped: taskIds.length === 500,
  };
}

async function searchWorkspace(
  admin: AdminClient,
  params: Record<string, unknown>,
) {
  const query = textParam(params, "query", 200);
  if (!query || query.length < 2)
    throw { code: "22P02", message: "Search needs at least two characters." };
  const limit = Math.min(25, limitParam(params));
  const pattern = `%${query}%`;
  const [
    taskTitles,
    taskDescriptions,
    notesByBody,
    notesByTitle,
    taskComments,
    noteComments,
    projects,
    categories,
    contacts,
    contactNotes,
  ] =
    await Promise.all([
      admin.from("tasks").select(WORKSPACE_COLUMNS.tasks).ilike("title", pattern).limit(limit),
      admin.from("tasks").select(WORKSPACE_COLUMNS.tasks).ilike("description", pattern).limit(limit),
      admin.from("notes").select(noteColumns).ilike("body", pattern).limit(limit),
      admin.from("notes").select(noteColumns).ilike("title", pattern).limit(limit),
      admin
        .from("task_comments")
        .select(WORKSPACE_COLUMNS.comments)
        .ilike("body", pattern)
        .limit(limit),
      admin
        .from("note_comments")
        .select(noteCommentColumns)
        .ilike("body", pattern)
        .limit(limit),
      admin.from("projects").select(WORKSPACE_COLUMNS.projects).ilike("name", pattern).limit(limit),
      admin.from("work_groups").select(WORKSPACE_COLUMNS.categories).ilike("name", pattern).limit(limit),
      admin.from("contacts").select(CONTACT_COLUMNS).ilike("display_name", pattern).limit(limit),
      admin.from("contacts").select(CONTACT_COLUMNS).ilike("notes", pattern).limit(limit),
    ]);
  const taskMap = new Map(
    [...rows(taskTitles), ...rows(taskDescriptions)].map((task) => [
      String(task.id),
      task,
    ]),
  );
  const noteMap = new Map(
    [...rows(notesByBody), ...rows(notesByTitle)].map((note) => [
      String(note.id),
      note,
    ]),
  );
  const contactMap = new Map(
    [...rows(contacts), ...rows(contactNotes)].map((contact) => [
      String(contact.id),
      contact,
    ]),
  );
  return {
    query,
    tasks: await hydrateTasks(admin, [...taskMap.values()].slice(0, limit)),
    notes: [...noteMap.values()].slice(0, limit),
    taskComments: rows(taskComments),
    noteComments: rows(noteComments),
    projects: rows(projects),
    categories: rows(categories),
    contacts: [...contactMap.values()].slice(0, limit),
    perDomainLimit: limit,
  };
}

async function listActivity(
  admin: AdminClient,
  params: Record<string, unknown>,
) {
  const result = await pagedTable(admin, params, {
    table: "task_activity",
    columns: WORKSPACE_COLUMNS.activity,
    order: "created_at",
    searchColumn: "action",
  });
  const taskIds = [...new Set(result.items.map((item) => String(item.task_id)))];
  const actorIds = [
    ...new Set(
      result.items
        .map((item) => item.actor_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const [taskResult, profileResult] = await Promise.all([
    taskIds.length
      ? admin.from("tasks").select(WORKSPACE_COLUMNS.tasks).in("id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    actorIds.length
      ? admin.from("profiles").select(WORKSPACE_COLUMNS.profiles).in("id", actorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const tasks = byId(rows(taskResult));
  const profiles = byId(rows(profileResult));
  return {
    ...result,
    items: result.items.map((activity) => {
      const task = tasks.get(String(activity.task_id));
      return {
        ...activity,
        task: task
          ? {
              id: task.id,
              key: taskKey({ task_number: Number(task.task_number) }),
              title: task.title,
              project_id: task.project_id,
              status_id: task.status_id,
            }
          : null,
        actor: activity.actor_id
          ? profiles.get(String(activity.actor_id)) ?? null
          : null,
      };
    }),
  };
}

async function listComments(
  admin: AdminClient,
  params: Record<string, unknown>,
) {
  const kind = textParam(params, "kind", 20);
  const includeTask = kind !== "note";
  const includeNote = kind !== "task";
  const limit = limitParam(params);
  const offset = decodeOffset(params.cursor);
  const search = textParam(params, "query", 200);
  const createdFrom = dateParam(params, "createdFrom");
  const createdTo = dateParam(params, "createdTo");

  const taskQuery = () => {
    let query = admin
      .from("task_comments")
      .select(WORKSPACE_COLUMNS.comments, { count: "exact" });
    if (search) query = query.ilike("body", `%${search}%`);
    if (createdFrom)
      query = query.gte("created_at", `${createdFrom}T00:00:00Z`);
    if (createdTo)
      query = query.lt("created_at", `${createdTo}T23:59:59.999Z`);
    return query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
  };
  const noteQuery = () => {
    let query = admin
      .from("note_comments")
      .select(noteCommentColumns, { count: "exact" });
    if (search) query = query.ilike("body", `%${search}%`);
    if (createdFrom)
      query = query.gte("created_at", `${createdFrom}T00:00:00Z`);
    if (createdTo)
      query = query.lt("created_at", `${createdTo}T23:59:59.999Z`);
    return query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
  };
  const [taskResult, noteResult] = await Promise.all([
    includeTask
      ? taskQuery()
      : Promise.resolve({ data: [], error: null, count: 0 }),
    includeNote
      ? noteQuery()
      : Promise.resolve({ data: [], error: null, count: 0 }),
  ]);
  const taskComments = rows(taskResult);
  const noteComments = rows(noteResult);
  const taskIds = [
    ...new Set(taskComments.map((comment) => String(comment.task_id))),
  ];
  const noteIds = [
    ...new Set(noteComments.map((comment) => String(comment.note_id))),
  ];
  const creatorIds = [
    ...new Set(
      [...taskComments, ...noteComments].map((comment) =>
        String(comment.created_by),
      ),
    ),
  ];
  const [taskRows, noteRows, profileRows] = await Promise.all([
    taskIds.length
      ? admin.from("tasks").select(WORKSPACE_COLUMNS.tasks).in("id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    noteIds.length
      ? admin.from("notes").select(noteColumns).in("id", noteIds)
      : Promise.resolve({ data: [], error: null }),
    creatorIds.length
      ? admin
          .from("profiles")
          .select(WORKSPACE_COLUMNS.profiles)
          .in("id", creatorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const tasks = byId(rows(taskRows));
  const notes = byId(rows(noteRows));
  const profiles = byId(rows(profileRows));
  const returned = Math.max(taskComments.length, noteComments.length);
  return {
    taskComments: taskComments.map((comment) => {
      const task = tasks.get(String(comment.task_id));
      return {
        ...comment,
        task: task
          ? {
              id: task.id,
              key: taskKey({ task_number: Number(task.task_number) }),
              title: task.title,
            }
          : null,
        creator: profiles.get(String(comment.created_by)) ?? null,
      };
    }),
    noteComments: noteComments.map((comment) => {
      const note = notes.get(String(comment.note_id));
      return {
        ...comment,
        note: note
          ? { id: note.id, title: note.title, bodyPreview: String(note.body).slice(0, 240) }
          : null,
        creator: profiles.get(String(comment.created_by)) ?? null,
      };
    }),
    pagination: pagination(
      params,
      Math.max(taskResult.count ?? 0, noteResult.count ?? 0),
      returned,
    ),
  };
}

async function workspaceOverview(admin: AdminClient) {
  const countTables = [
    "tasks",
    "task_comments",
    "task_activity",
    "subtasks",
    "notes",
    "note_comments",
    "projects",
    "work_groups",
    "calendar_events",
    "contacts",
    "profiles",
  ] as const;
  const countResults = await Promise.all(
    countTables.map((table) =>
      admin.from(table).select("*", { count: "exact", head: true }),
    ),
  );
  const [catalog, digestSettings, recentRuns, instanceSettings] =
    await Promise.all([
      catalogs(admin),
      admin.from("digest_settings").select(DIGEST_SETTINGS_COLUMNS).maybeSingle(),
      admin
        .from("digest_runs")
        .select("id,ran_at,digest_date,time_zone,outcome,source,scheduled_count,skipped_count,failed_count,deliver_at,detail")
        .order("ran_at", { ascending: false })
        .limit(20),
      admin
        .from("instance_settings")
        .select("name,description,updated_at")
        .maybeSingle(),
    ]);
  const counts = Object.fromEntries(
    countTables.map((table, index) => {
      required(countResults[index]);
      return [table, countResults[index].count ?? 0];
    }),
  );
  return {
    workspace: row(instanceSettings),
    counts,
    statuses: catalog.statuses,
    projects: catalog.projects,
    categories: catalog.categories,
    profiles: catalog.profiles,
    labels: catalog.labels,
    digestSettings: row(digestSettings),
    recentDigestRuns: rows(recentRuns),
    dataBoundary: {
      includesArchivedContent: true,
      attachmentMetadataOnly: true,
      excludes: [
        "encrypted integration tokens",
        "MCP credentials",
        "environment secrets",
        "rate-limit internals",
        "raw authentication records",
        "attachment binary contents",
      ],
    },
  };
}

function increment(group: Record<string, number>, key: unknown) {
  const normalized = key == null || key === "" ? "none" : String(key);
  group[normalized] = (group[normalized] ?? 0) + 1;
}

async function workMetrics(admin: AdminClient, params: Record<string, unknown>) {
  const from = dateParam(params, "from");
  const to = dateParam(params, "to");
  let query = admin.from("tasks").select(WORKSPACE_COLUMNS.tasks);
  if (from) query = query.gte("created_at", `${from}T00:00:00Z`);
  if (to) query = query.lt("created_at", `${to}T23:59:59.999Z`);
  const result = await query
    .order("created_at", { ascending: false })
    .limit(MAX_METRIC_ROWS);
  const tasks = rows(result);
  const hydrated = await hydrateTasks(admin, tasks);
  const now = new Date().toISOString().slice(0, 10);
  const byStatus: Record<string, number> = {};
  const byProject: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byAssignee: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const cycleDays: number[] = [];
  let completed = 0;
  let overdue = 0;
  let archived = 0;
  for (const task of hydrated) {
    const status = task.status as Row | null;
    const project = task.project as Row | null;
    increment(byStatus, status?.name ?? task.status_id);
    increment(byProject, project?.name ?? "No project");
    increment(byPriority, task.priority);
    for (const category of task.categories as Row[])
      increment(byCategory, category.name);
    const assignees = task.assignees as Row[];
    if (!assignees.length) increment(byAssignee, "Unassigned");
    for (const assignee of assignees) increment(byAssignee, assignee.full_name);
    if (task.completed_at) {
      completed += 1;
      cycleDays.push(
        Math.max(
          0,
          (new Date(String(task.completed_at)).getTime() -
            new Date(String(task.created_at)).getTime()) /
            86_400_000,
        ),
      );
    }
    if (task.archived_at) archived += 1;
    if (!task.completed_at && !task.archived_at && task.due_date && task.due_date < now)
      overdue += 1;
  }
  cycleDays.sort((left, right) => left - right);
  const average = cycleDays.length
    ? cycleDays.reduce((sum, value) => sum + value, 0) / cycleDays.length
    : null;
  const median = cycleDays.length
    ? cycleDays[Math.floor((cycleDays.length - 1) / 2)]
    : null;
  return {
    period: { from, to, basis: "task created_at" },
    totals: {
      tasks: tasks.length,
      completed,
      active: tasks.length - completed - archived,
      archived,
      overdue,
    },
    cycleTimeDays: {
      sampleSize: cycleDays.length,
      average: average == null ? null : Number(average.toFixed(2)),
      median: median == null ? null : Number(median.toFixed(2)),
    },
    distributions: { byStatus, byProject, byCategory, byAssignee, byPriority },
    resultCapped: tasks.length === MAX_METRIC_ROWS,
  };
}

async function governanceActivity(
  admin: AdminClient,
  params: Record<string, unknown>,
) {
  const limit = limitParam(params);
  const offset = decodeOffset(params.cursor);
  const [permission, privileged, groups, memberships] = await Promise.all([
    admin
      .from("permission_audit_events")
      .select("id,actor_id,action,target_type,target_id,before_state,after_state,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
    admin
      .from("privileged_audit_events")
      .select("id,actor_id,action,target_type,target_id,metadata,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
    admin
      .from("access_groups")
      .select("id,name,description,kind,hierarchy_rank,grants_global_content,is_default"),
    admin
      .from("access_group_members")
      .select("group_id,profile_id,added_by,created_at"),
  ]);
  return {
    permissionAudit: rows(permission),
    privilegedAudit: rows(privileged),
    accessGroups: rows(groups),
    memberships: rows(memberships),
    pagination: pagination(
      params,
      Math.max(permission.count ?? 0, privileged.count ?? 0),
      Math.max(rows(permission).length, rows(privileged).length),
    ),
  };
}

async function listRydOrders(
  admin: AdminClient,
  params: Record<string, unknown>,
) {
  const loaded = await loadRydProfiles(admin);
  if (!loaded.available)
    return { items: loaded, pagination: undefined, warnings: loaded.warnings };
  const matching = filterRydProfiles(loaded.profiles, rydOrderFilters(params));
  const limit = limitParam(params);
  const offset = decodeOffset(params.cursor);
  const items = matching.slice(offset, offset + limit);
  return {
    items,
    pagination: pagination(params, matching.length, items.length),
    warnings: loaded.warnings,
  };
}

export async function executeMcpRead(
  admin: AdminClient,
  action: McpReadAction,
  params: Record<string, unknown>,
): Promise<McpReadResult> {
  let data: unknown;
  let page:
    | {
        limit: number;
        offset: number;
        nextCursor: string | null;
        totalCount: number | null;
      }
    | undefined;
  const warnings: string[] = [];

  switch (action) {
    case "get_workspace_overview":
      data = await workspaceOverview(admin);
      break;
    case "search_workspace":
      data = await searchWorkspace(admin, params);
      break;
    case "list_tasks": {
      const result = await listTasks(admin, params);
      data = result.items;
      page = result.pagination;
      break;
    }
    case "get_task":
      data = await getTask(admin, params);
      break;
    case "list_notes": {
      const result = await listNotes(admin, params);
      data = result.items;
      page = result.pagination;
      break;
    }
    case "get_note":
      data = await getNote(admin, params);
      break;
    case "list_comments": {
      const result = await listComments(admin, params);
      data = {
        taskComments: result.taskComments,
        noteComments: result.noteComments,
      };
      page = result.pagination;
      break;
    }
    case "list_activity": {
      const result = await listActivity(admin, params);
      data = result.items;
      page = result.pagination;
      warnings.push(
        "Older activity may be less detailed than records created after activity coverage was expanded.",
      );
      break;
    }
    case "list_calendar_events": {
      const result = await pagedTable(admin, params, {
        table: "calendar_events",
        columns: CALENDAR_EVENT_COLUMNS,
        order: "starts_at",
        ascending: true,
        searchColumn: "title",
      });
      data = result.items;
      page = result.pagination;
      break;
    }
    case "list_projects": {
      const result = await pagedTable(admin, params, {
        table: "projects",
        columns: WORKSPACE_COLUMNS.projects,
        order: "name",
        ascending: true,
        archivedColumn: "closed_at",
        searchColumn: "name",
      });
      data = result.items;
      page = result.pagination;
      break;
    }
    case "get_project":
      data = await getProject(admin, params);
      break;
    case "list_categories": {
      const result = await pagedTable(admin, params, {
        table: "work_groups",
        columns: WORKSPACE_COLUMNS.categories,
        order: "name",
        ascending: true,
        archivedColumn: "archived_at",
        searchColumn: "name",
      });
      data = result.items;
      page = result.pagination;
      break;
    }
    case "get_category":
      data = await getCategory(admin, params);
      break;
    case "list_contacts": {
      const result = await pagedTable(admin, params, {
        table: "contacts",
        columns: CONTACT_COLUMNS,
        order: "display_name",
        ascending: true,
        searchColumn: "display_name",
      });
      data = result.items;
      page = result.pagination;
      break;
    }
    case "get_work_metrics":
      data = await workMetrics(admin, params);
      break;
    case "list_governance_activity": {
      const result = await governanceActivity(admin, params);
      data = {
        permissionAudit: result.permissionAudit,
        privilegedAudit: result.privilegedAudit,
        accessGroups: result.accessGroups,
        memberships: result.memberships,
      };
      page = result.pagination;
      break;
    }
    case "get_ryd_sales_insights": {
      const result = await rydSalesInsights(admin, params);
      data = result.data;
      warnings.push(...result.warnings);
      break;
    }
    case "list_ryd_orders": {
      const result = await listRydOrders(admin, params);
      data = result.items;
      page = result.pagination;
      warnings.push(...result.warnings);
      break;
    }
  }

  return {
    action,
    generatedAt: new Date().toISOString(),
    data,
    ...(page ? { pagination: page } : {}),
    ...(warnings.length ? { warnings } : {}),
  };
}
