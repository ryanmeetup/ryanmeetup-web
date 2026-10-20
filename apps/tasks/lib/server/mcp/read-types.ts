export type McpReadAction =
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

export type McpReadRequest = {
  action: McpReadAction;
  params: Record<string, unknown>;
};

export type McpReadResult = {
  action: McpReadAction;
  generatedAt: string;
  data: unknown;
  pagination?: {
    limit: number;
    offset: number;
    nextCursor: string | null;
    totalCount: number | null;
  };
  warnings?: string[];
};
