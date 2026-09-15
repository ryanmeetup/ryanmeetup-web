import { normalizeHttpUrl } from "@ryanmeetup/utils";
import type { Category, Note, Project } from "./resource-types";
import type { Status, Task } from "@/lib/tasks/task-types";
import type { StoredTaskDraft } from "@/lib/tasks/task-drafts";

export const noteColumns =
  "id,title,body,category_id,created_by,converted_task_id,converted_project_id,created_at,updated_at,archived_at";
export const noteCommentColumns =
  "id,note_id,body,created_by,created_at,edited_at";

export function applyNoteDraft(
  note: Note,
  title: string,
  body: string,
  updatedAt = new Date().toISOString(),
): Note {
  return {
    ...note,
    title: title.trim(),
    body: body.trim(),
    updated_at: updatedAt,
  };
}

export type NoteLink = { label: string; url: string };

const markdownLinkPattern = /\[([^\]\n]+)\]\(\s*(<[^>\n]+>|[^)\s]+)[^)]*\)/g;
const bareLinkPattern = /(?:https?:\/\/|www\.)[^\s<>"'`\]]+/gi;
const trailingPunctuation = /[.,;:!?*_~"'`)\]}]+$/;

function noteLinkLabel(url: string) {
  const parsed = new URL(url);
  const path = `${parsed.pathname}${parsed.search}`.replace(/\/+$/, "");
  const label = `${parsed.hostname.replace(/^www\./, "")}${path}`;
  return label.length > 48 ? `${label.slice(0, 47)}\u2026` : label;
}

/**
 * Collects the links a note points at so a read-only note can offer them as
 * real navigation. Markdown links keep their written label; bare URLs fall
 * back to a readable host and path.
 */
export function noteLinks(note: Pick<Note, "body">): NoteLink[] {
  const links: NoteLink[] = [];
  const add = (candidate: string, label?: string) => {
    const url = normalizeHttpUrl(
      candidate.replace(/^<|>$/g, "").replace(trailingPunctuation, ""),
    );
    if (!url || links.some((link) => link.url === url)) return;
    links.push({ label: label?.trim() || noteLinkLabel(url), url });
  };
  for (const match of note.body.matchAll(markdownLinkPattern))
    add(match[2], match[1]);
  const bare = note.body.replace(markdownLinkPattern, " ");
  for (const match of bare.match(bareLinkPattern) ?? []) add(match);
  return links;
}

export function noteTitle(note: Pick<Note, "title" | "body">) {
  const explicit = note.title?.trim();
  if (explicit) return explicit;
  const firstLine = note.body
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return "Untitled note";
  return firstLine.length > 80 ? `${firstLine.slice(0, 79)}…` : firstLine;
}

export function noteTaskDescription(note: Pick<Note, "title" | "body">) {
  const title = note.title?.trim();
  if (title) return note.body.trim();
  const lines = note.body.trim().split("\n");
  return lines.length > 1 ? lines.slice(1).join("\n").trim() : note.body.trim();
}

export function filterNotes(notes: Note[], archived: boolean) {
  return notes.filter((note) => Boolean(note.archived_at) === archived);
}

export type NoteGroup = { category: Category | null; notes: Note[] };

export function groupNotesByCategory(
  notes: Note[],
  categories: Category[],
): NoteGroup[] {
  const byCategoryId = new Map<string | null, Note[]>();
  for (const note of notes) {
    const key = note.category_id;
    const group = byCategoryId.get(key);
    if (group) group.push(note);
    else byCategoryId.set(key, [note]);
  }
  const categorized = categories
    .filter((category) => byCategoryId.has(category.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((category) => ({
      category,
      notes: byCategoryId.get(category.id)!,
    }));
  const uncategorized = byCategoryId.get(null);
  return uncategorized
    ? [...categorized, { category: null, notes: uncategorized }]
    : categorized;
}

export function paginateNotes(notes: Note[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(notes.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  return {
    notes: notes.slice((safePage - 1) * pageSize, safePage * pageSize),
    page: safePage,
    pageCount,
    totalCount: notes.length,
  };
}

export function noteConversionDraft(
  note: Note,
  statuses: Status[],
  reporterId: string,
  updatedAt = new Date().toISOString(),
): StoredTaskDraft {
  return {
    id: `note-${note.id}`,
    updatedAt,
    draft: {
      title: noteTitle(note),
      description: noteTaskDescription(note),
      status_id:
        statuses.find((status) => status.name.toLowerCase() === "backlog")
          ?.id ??
        statuses.find((status) => status.is_default)?.id ??
        statuses[0]?.id ??
        "",
      project_id: null,
      assignee_ids: [],
      reported_by: reporterId,
      start_date: null,
      due_date: null,
      due_time: null,
      reminder_at: null,
      priority: "medium",
      category_ids: note.category_id ? [note.category_id] : [],
      category_tags: {},
      status_reason: "",
    },
  };
}

export function linkNoteToTask(
  note: Note,
  task: Pick<Task, "id">,
  updatedAt = new Date().toISOString(),
): Note {
  return { ...note, converted_task_id: task.id, updated_at: updatedAt };
}

export function noteConversionProjectDraft(note: Pick<Note, "title" | "body">) {
  return { name: noteTitle(note), description: noteTaskDescription(note) };
}

export function linkNoteToProject(
  note: Note,
  project: Pick<Project, "id">,
  updatedAt = new Date().toISOString(),
): Note {
  return { ...note, converted_project_id: project.id, updated_at: updatedAt };
}
