import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { callRmtReadApi, type RmtReadAction } from "./api-client.js";

const pagination = {
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().max(200).optional(),
};
const archived = { includeArchived: z.boolean().optional() };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuidList = z.array(z.uuid()).max(50).optional();
const rydFilters = {
  from: date.optional(),
  to: date.optional(),
  statuses: z
    .array(z.enum(["pending", "verified", "needs_info", "rejected"]))
    .max(4)
    .optional(),
  query: z.string().trim().max(200).optional(),
};

function toolResult(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

function toolError(error: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: error instanceof Error ? error.message : "The read failed.",
      },
    ],
    isError: true as const,
  };
}

async function read(action: RmtReadAction, params: Record<string, unknown>) {
  try {
    return toolResult(await callRmtReadApi(action, params));
  } catch (error) {
    return toolError(error);
  }
}

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export function createRmtServer() {
  const server = new McpServer(
    {
      name: "rmt-tasks-read",
      title: "Ryan Meetup Tasks (Read Only)",
      version: "0.2.0",
    },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.registerResource(
    "workspace-data-boundary",
    "rmt://workspace/about",
    {
      title: "RMT workspace data boundary",
      description: "What this read-only connector includes and excludes.",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: [
            "This connector reads the Ryan Meetup Tasks workspace only.",
            "It includes database-backed tasks, notes, comments, projects, categories, contacts, calendar events, relationships, activity, and metrics.",
            "It also includes RY-D sales: fulfillment orders, verification decisions, and the RY-dentification form answers linked to each order.",
            "It excludes credentials, encrypted integration tokens, rate-limit internals, raw authentication records, and attachment binary contents.",
            "RY-D buyers' email addresses are reduced to their domain, and files uploaded through the RY-dentification form are never included.",
            "Every tool is read-only; no create, update, delete, or upload operation is registered.",
          ].join("\n"),
        },
      ],
    }),
  );

  server.registerTool(
    "get_workspace_overview",
    {
      title: "Get workspace overview",
      description:
        "Read RMT workspace counts, catalogs, people, digest configuration, and the connector data boundary. Start here before broad analysis.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    (params) => read("get_workspace_overview", params),
  );

  server.registerTool(
    "search_workspace",
    {
      title: "Search workspace",
      description:
        "Search task titles/descriptions, note bodies, project names, category names, and contact names. Use a specific phrase, then fetch matching records with their get tool.",
      inputSchema: z.object({
        query: z.string().trim().min(2).max(200),
        limit: z.number().int().min(1).max(25).optional(),
      }),
      annotations: readOnly,
    },
    (params) => read("search_workspace", params),
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description:
        "List RMT tasks with resolved status, project, categories, assignees, reporter, creator, and labels. Results are newest-updated first and paginated.",
      inputSchema: z.object({
        query: z.string().trim().max(200).optional(),
        projectIds: uuidList,
        categoryIds: uuidList,
        statusIds: uuidList,
        assigneeIds: uuidList,
        priorities: z
          .array(z.enum(["low", "medium", "high", "urgent"]))
          .max(4)
          .optional(),
        updatedFrom: date.optional(),
        updatedTo: date.optional(),
        ...archived,
        ...pagination,
      }),
      annotations: readOnly,
    },
    (params) => read("list_tasks", params),
  );

  server.registerTool(
    "get_task",
    {
      title: "Get task",
      description:
        "Read one task by public key such as RMT-142 (or internal UUID), including comments, replies, checklist, activity, and attachment metadata.",
      inputSchema: z.object({ key: z.string().trim().min(1).max(100) }),
      annotations: readOnly,
    },
    (params) => read("get_task", params),
  );

  server.registerTool(
    "list_notes",
    {
      title: "List notes",
      description:
        "List workspace notes with creator and category context. Search matches note bodies; archived notes are excluded unless requested.",
      inputSchema: z.object({
        query: z.string().trim().max(200).optional(),
        ...archived,
        ...pagination,
      }),
      annotations: readOnly,
    },
    (params) => read("list_notes", params),
  );

  server.registerTool(
    "get_note",
    {
      title: "Get note",
      description: "Read one note and all of its comments by note UUID.",
      inputSchema: z.object({ id: z.uuid() }),
      annotations: readOnly,
    },
    (params) => read("get_note", params),
  );

  server.registerTool(
    "list_comments",
    {
      title: "List comments",
      description:
        "List task comments and note comments with author and task/note context. Use this for workspace-wide collaboration and theme analysis.",
      inputSchema: z.object({
        kind: z.enum(["all", "task", "note"]).optional(),
        query: z.string().trim().max(200).optional(),
        createdFrom: date.optional(),
        createdTo: date.optional(),
        ...pagination,
      }),
      annotations: readOnly,
    },
    (params) => read("list_comments", params),
  );

  server.registerTool(
    "list_activity",
    {
      title: "List task activity",
      description:
        "Read task activity history, newest first. The action filter is a partial match. Older records may contain less detail.",
      inputSchema: z.object({
        query: z.string().trim().max(200).optional(),
        ...pagination,
      }),
      annotations: readOnly,
    },
    (params) => read("list_activity", params),
  );

  server.registerTool(
    "list_calendar_events",
    {
      title: "List calendar events",
      description:
        "Read workspace-owned calendar events and recurrence data. Imported Google event payloads are not stored in the Tasks database and are not included.",
      inputSchema: z.object({
        query: z.string().trim().max(200).optional(),
        ...pagination,
      }),
      annotations: readOnly,
    },
    (params) => read("list_calendar_events", params),
  );

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "List projects and their lifecycle and visibility metadata.",
      inputSchema: z.object({
        query: z.string().trim().max(200).optional(),
        ...archived,
        ...pagination,
      }),
      annotations: readOnly,
    },
    (params) => read("list_projects", params),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description:
        "Read a project by UUID or exact name with owners, access grants, tasks, and attachment metadata or note bodies.",
      inputSchema: z
        .object({
          id: z.uuid().optional(),
          name: z.string().trim().min(1).max(200).optional(),
        })
        .refine((value) => value.id || value.name, {
          message: "Provide id or name.",
        }),
      annotations: readOnly,
    },
    (params) => read("get_project", params),
  );

  server.registerTool(
    "list_categories",
    {
      title: "List categories",
      description:
        "List work categories with tags, descriptions, links, archive state, and visibility mode.",
      inputSchema: z.object({
        query: z.string().trim().max(200).optional(),
        ...archived,
        ...pagination,
      }),
      annotations: readOnly,
    },
    (params) => read("list_categories", params),
  );

  server.registerTool(
    "get_category",
    {
      title: "Get category",
      description:
        "Read a category by UUID or exact name with owners, access grants, tasks, and attachment metadata or note bodies.",
      inputSchema: z
        .object({
          id: z.uuid().optional(),
          name: z.string().trim().min(1).max(200).optional(),
        })
        .refine((value) => value.id || value.name, {
          message: "Provide id or name.",
        }),
      annotations: readOnly,
    },
    (params) => read("get_category", params),
  );

  server.registerTool(
    "list_contacts",
    {
      title: "List contacts",
      description:
        "Read the contacts directory, including organization notes, people, email addresses, phone numbers, social handles, and contact categories.",
      inputSchema: z.object({
        query: z.string().trim().max(200).optional(),
        ...pagination,
      }),
      annotations: readOnly,
    },
    (params) => read("list_contacts", params),
  );

  server.registerTool(
    "get_work_metrics",
    {
      title: "Get work metrics",
      description:
        "Calculate evidence for planning and trend analysis: totals, completion, overdue work, cycle time, and distributions by status, project, category, assignee, and priority. Date bounds select tasks by creation date.",
      inputSchema: z.object({ from: date.optional(), to: date.optional() }),
      annotations: readOnly,
    },
    (params) => read("get_work_metrics", params),
  );

  server.registerTool(
    "list_governance_activity",
    {
      title: "List governance activity",
      description:
        "Read sensitive owner-level permission audits, privileged audits, access groups, and group membership. Use only when governance history is relevant.",
      inputSchema: z.object(pagination),
      annotations: readOnly,
    },
    (params) => read("list_governance_activity", params),
  );

  server.registerTool(
    "get_ryd_sales_insights",
    {
      title: "Get RY-D sales insights",
      description:
        "Profile who buys RY-Ds: order and revenue totals, gift versus self-purchase, and distributions by month, status, buyer and Ryan first-name spelling, last name, email type (personal, school, work) and domain, contact method, delivery, items, social platform, plus the most common answers to every RY-dentification form question. Dates filter on the order date. Start here for questions about the types of Ryans buying, then use list_ryd_orders for examples.",
      inputSchema: z.object(rydFilters),
      annotations: readOnly,
    },
    (params) => read("get_ryd_sales_insights", params),
  );

  server.registerTool(
    "list_ryd_orders",
    {
      title: "List RY-D orders",
      description:
        "List RY-D orders newest first, including ones already sent to fulfillment, each with its verification status, reviewer note, order total and items, buyer name, email domain, and the linked RY-dentification form answers and social links. Query matches names, order IDs, email domains, notes, and form answers.",
      inputSchema: z.object({ ...rydFilters, ...pagination }),
      annotations: readOnly,
    },
    (params) => read("list_ryd_orders", params),
  );

  return server;
}
