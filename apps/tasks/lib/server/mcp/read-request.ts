import "server-only";

import { apiError } from "@/lib/server/api-response";
import type { McpReadAction, McpReadRequest } from "./read-types";
import type { NextResponse } from "next/server";

const MAX_BODY_BYTES = 32 * 1024;
const actions = new Set<McpReadAction>([
  "get_workspace_overview",
  "search_workspace",
  "list_tasks",
  "get_task",
  "list_notes",
  "get_note",
  "list_comments",
  "list_activity",
  "list_calendar_events",
  "list_projects",
  "get_project",
  "list_categories",
  "get_category",
  "list_contacts",
  "get_work_metrics",
  "list_governance_activity",
  "get_ryd_sales_insights",
  "list_ryd_orders",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readMcpRequest(
  request: Request,
): Promise<{ response: NextResponse } | { data: McpReadRequest }> {
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !==
    "application/json"
  ) {
    return {
      response: apiError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Send MCP queries as JSON.",
      ),
    } as const;
  }
  const declaredSize = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) {
    return {
      response: apiError(413, "REQUEST_TOO_LARGE", "The query is too large."),
    } as const;
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      response: apiError(400, "INVALID_JSON", "The query is not valid JSON."),
    } as const;
  }
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return {
      response: apiError(413, "REQUEST_TOO_LARGE", "The query is too large."),
    } as const;
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {
      response: apiError(400, "INVALID_JSON", "The query is not valid JSON."),
    } as const;
  }
  if (
    !isObject(value) ||
    typeof value.action !== "string" ||
    !actions.has(value.action as McpReadAction) ||
    (value.params !== undefined && !isObject(value.params))
  ) {
    return {
      response: apiError(
        400,
        "INVALID_REQUEST",
        "The MCP query fields are not valid.",
      ),
    } as const;
  }
  return {
    data: {
      action: value.action,
      params: value.params ?? {},
    } as McpReadRequest,
  } as const;
}
