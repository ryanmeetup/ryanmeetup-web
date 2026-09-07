/**
 * The event kinds the Activity filter offers, and the mapping from a recorded
 * action to one of them.
 *
 * The route filters on these and the page renders chips from them, so they
 * live together: a kind the route can produce but the chip list omits is
 * unreachable by an include filter and unblockable by an exclude filter, which
 * is how comments and calendar events went missing from the feed.
 */
export const ACTIVITY_EVENT_OPTIONS = [
  { label: "Task created", value: "created" },
  { label: "Task updated", value: "updated" },
  { label: "Task moved", value: "moved" },
  { label: "Task deleted", value: "deleted" },
  { label: "Checklist", value: "checklist" },
  { label: "Comments", value: "comment" },
  { label: "Attachments", value: "attachment" },
  { label: "Notes", value: "note" },
  { label: "Contacts", value: "organization" },
  { label: "Projects", value: "project" },
  { label: "Categories", value: "category" },
  { label: "Calendar", value: "calendar" },
  { label: "Statuses", value: "status" },
  { label: "Access", value: "access" },
  { label: "Team", value: "team" },
  { label: "Settings", value: "settings" },
  { label: "Other", value: "other" },
] as const;

export type ActivityEventKind =
  (typeof ACTIVITY_EVENT_OPTIONS)[number]["value"];

/** The one action a status move is recorded under, matched in three places. */
export const TASK_MOVE_ACTION = "moved task";

const TASK_COMMENT_ACTIONS = new Set([
  "added a comment",
  "edited a comment",
  "deleted a comment",
]);

export function activityEventKind(action: string): ActivityEventKind {
  // The exact task actions come first: a checklist item or an attachment can
  // be named anything, so matching them on substrings has to happen after the
  // actions whose text is fixed.
  if (action === "created the task") return "created";
  if (action === "updated the task") return "updated";
  if (action === TASK_MOVE_ACTION) return "moved";
  if (action === "task.delete") return "deleted";
  if (TASK_COMMENT_ACTIONS.has(action) || action.startsWith("note.comment"))
    return "comment";
  if (action.includes("checklist")) return "checklist";
  // Covers both `attached "…"` on a task and `project.attachment.add` on a
  // resource, so one chip reaches every attachment in the workspace.
  if (action.includes("attach")) return "attachment";
  // `log_workspace_resource_activity` prefixes these `calendar.`, while their
  // target type is `calendar_event`; the prefix is what the feed matches on.
  if (action.startsWith("calendar.")) return "calendar";
  if (action.startsWith("note.")) return "note";
  if (
    action.startsWith("organization.") ||
    action.startsWith("contact_category.")
  )
    return "organization";
  if (action.startsWith("access_group.") || action.includes(".access."))
    return "access";
  if (action.startsWith("project.")) return "project";
  if (action.startsWith("category.")) return "category";
  if (action.startsWith("status.")) return "status";
  if (action.startsWith("team.")) return "team";
  if (
    action.startsWith("settings.") ||
    action.startsWith("digest.") ||
    action.startsWith("integration.") ||
    action.startsWith("email.")
  )
    return "settings";
  return "other";
}
