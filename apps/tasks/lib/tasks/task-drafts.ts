import type { TaskDraft } from "./task-mutations";
import type { NewTaskDetailsDraft } from "./task-types";

export type StoredTaskDraft = {
  id: string;
  draft: TaskDraft;
  details?: NewTaskDetailsDraft;
  updatedAt: string;
};

const storagePrefix = "ryanmeetup:task-drafts:";
export const taskDraftsChangedEvent = "task-drafts-changed";
export const taskDraftAutosaveDelayMs = 4000;
const draftTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

export function draftSavedStatus(kind: "auto" | "manual", date = new Date()) {
  const action = kind === "auto" ? "Autosaved draft" : "Draft saved";
  return `${action} at ${draftTimeFormatter.format(date)}`;
}

function storageKey(profileId: string) {
  return `${storagePrefix}${profileId}`;
}

function storedTaskDetails(value: unknown): NewTaskDetailsDraft {
  if (!value || typeof value !== "object")
    return { checklist: [], files: [], urls: [] };

  const details = value as Partial<NewTaskDetailsDraft>;
  return {
    checklist: Array.isArray(details.checklist)
      ? details.checklist
          .filter(
            (item): item is { id: string; title: string; completed: boolean } =>
              Boolean(item) &&
              typeof item.id === "string" &&
              typeof item.title === "string",
          )
          .map((item) => ({
            ...item,
            // Drafts saved before checklist completion was available reopen
            // their items instead of becoming unreadable.
            completed: typeof item.completed === "boolean" && item.completed,
          }))
      : [],
    // Browser File objects cannot be represented safely in local storage.
    files: [],
    urls: Array.isArray(details.urls)
      ? details.urls.filter(
          (item): item is { id: string; url: string } =>
            Boolean(item) &&
            typeof item.id === "string" &&
            typeof item.url === "string",
        )
      : [],
  };
}

export function readTaskDrafts(profileId: string): StoredTaskDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(
      localStorage.getItem(storageKey(profileId)) ?? "[]",
    );
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is StoredTaskDraft =>
          Boolean(item) &&
          typeof item.id === "string" &&
          typeof item.updatedAt === "string" &&
          typeof item.draft === "object",
      )
      .map((item) => {
        const legacyDraft = item.draft as TaskDraft & {
          assignee_id?: unknown;
        };
        const { assignee_id: legacyAssigneeId, ...draft } = legacyDraft;
        return {
          ...item,
          details: storedTaskDetails(item.details),
          draft: {
            ...draft,
            assignee_ids:
              draft.assignee_ids ??
              (typeof legacyAssigneeId === "string" ? [legacyAssigneeId] : []),
            category_tags: draft.category_tags ?? {},
            status_reason: draft.status_reason ?? "",
          },
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function saveTaskDraft(
  profileId: string,
  draft: TaskDraft,
  id = crypto.randomUUID(),
  details?: NewTaskDetailsDraft,
) {
  const saved: StoredTaskDraft = {
    id,
    draft,
    details: storedTaskDetails(details),
    updatedAt: new Date().toISOString(),
  };
  const drafts = readTaskDrafts(profileId).filter((item) => item.id !== id);
  localStorage.setItem(
    storageKey(profileId),
    JSON.stringify([saved, ...drafts]),
  );
  window.dispatchEvent(new CustomEvent(taskDraftsChangedEvent));
  return saved;
}

export function deleteTaskDraft(profileId: string, id: string) {
  const drafts = readTaskDrafts(profileId).filter((item) => item.id !== id);
  localStorage.setItem(storageKey(profileId), JSON.stringify(drafts));
  window.dispatchEvent(new CustomEvent(taskDraftsChangedEvent));
}

function hasTaskDetailsContent(details?: NewTaskDetailsDraft) {
  return Boolean(
    details?.checklist.length || details?.files.length || details?.urls.length,
  );
}

export function hasDraftContent(
  draft: TaskDraft,
  details?: NewTaskDetailsDraft,
) {
  return Boolean(
    draft.title.trim() ||
    draft.description?.trim() ||
    draft.project_id ||
    draft.assignee_ids.length ||
    draft.due_date ||
    draft.category_ids.length ||
    hasTaskDetailsContent(details),
  );
}

export function hasDraftAutosaveContent(
  draft: TaskDraft,
  details?: NewTaskDetailsDraft,
) {
  return Boolean(
    draft.title.trim() ||
    draft.description?.trim() ||
    draft.start_date ||
    draft.due_date ||
    draft.due_time ||
    draft.reminder_at ||
    hasTaskDetailsContent(details),
  );
}
