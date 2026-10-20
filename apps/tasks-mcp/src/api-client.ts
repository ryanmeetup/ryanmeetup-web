export type RmtReadAction =
  | "get_workspace_overview"
  | "search_workspace"
  | "list_tasks"
  | "get_task"
  | "list_notes"
  | "get_note"
  | "list_comments"
  | "list_activity"
  | "list_calendar_events"
  | "list_projects"
  | "get_project"
  | "list_categories"
  | "get_category"
  | "list_contacts"
  | "get_work_metrics"
  | "list_governance_activity"
  | "get_ryd_sales_insights"
  | "list_ryd_orders";

const PRODUCTION_ORIGIN = "https://tasks.ryanmeetup.com";
const REQUEST_TIMEOUT_MS = 30_000;

export function resolveApiOrigin(
  raw = process.env.RMT_MCP_API_URL,
  allowLocalhost = process.env.RMT_MCP_ALLOW_LOCALHOST === "true",
) {
  const value = raw?.trim() || PRODUCTION_ORIGIN;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("RMT_MCP_API_URL is not a valid URL.");
  }
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.origin !== PRODUCTION_ORIGIN && !(allowLocalhost && local))
    throw new Error(
      "RMT_MCP_API_URL must be https://tasks.ryanmeetup.com. Localhost is allowed only in explicit development mode.",
    );
  if (!local && url.protocol !== "https:")
    throw new Error("The RMT MCP API must use HTTPS.");
  return url.origin;
}

export function readToken(raw = process.env.RMT_MCP_READ_TOKEN) {
  const token = raw?.trim() ?? "";
  if (token.length < 32)
    throw new Error("RMT_MCP_READ_TOKEN is missing or too short.");
  return token;
}

export async function callRmtReadApi(
  action: RmtReadAction,
  params: Record<string, unknown> = {},
  options: {
    fetch?: typeof fetch;
    apiOrigin?: string;
    token?: string;
  } = {},
) {
  const request = options.fetch ?? fetch;
  const origin = resolveApiOrigin(options.apiOrigin);
  const token = readToken(options.token);
  let response: Response;
  try {
    response = await request(`${origin}/api/mcp/v1/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ action, params }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    throw new Error(`RMT Tasks could not be reached: ${message}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(`RMT Tasks returned HTTP ${response.status} without JSON.`);
  }
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String(body.error)
        : `HTTP ${response.status}`;
    throw new Error(`RMT Tasks rejected the read: ${message}`);
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("RMT Tasks returned an unexpected response shape.");
  return body as Record<string, unknown>;
}
