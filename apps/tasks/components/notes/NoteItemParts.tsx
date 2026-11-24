"use client";

import Link from "next/link";
import {
  Avatar,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuItems,
  DropdownMenuSeparator,
} from "@ryanmeetup/ui";
import {
  FiArchive,
  FiBriefcase,
  FiCheck,
  FiClock,
  FiEdit2,
  FiMessageSquare,
  FiRotateCcw,
  FiTrash2,
} from "react-icons/fi";
import {
  ResponsiveTableMenuButton,
  type EditorTriggers,
} from "@/components/global";
import { formatShortTimestamp } from "@/lib/date-format";
import { noteEditPath, notePath, noteTitle } from "@/lib/resources/notes";
import type { Category, Note, Project } from "@/lib/resources/resource-types";
import type { Task } from "@/lib/tasks/task-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";

export type NoteItemProps = {
  triggers: EditorTriggers;
  note: Note;
  category: Category | null;
  profiles: WorkspaceData["profiles"];
  canConvertToProject: boolean;
  commentCount: number;
  convertedTask?: Task;
  convertedProject?: Project;
  onOpen: (note: Note) => void;
  onEdit: (note: Note) => void;
  onArchive: (note: Note) => void;
  onConvert: (note: Note) => void;
  onConvertToProject: (note: Note) => void;
  onDelete: (note: Note) => void;
};

export function NoteTitle({
  note,
  triggers,
  onOpen,
}: Pick<NoteItemProps, "note" | "triggers" | "onOpen">) {
  const title = noteTitle(note);
  return (
    <h3 className="text-card-title font-semibold wrap-anywhere">
      {triggers.route && (
        <Link
          href={notePath(note.id)}
          className={`rounded underline decoration-black/25 decoration-1 underline-offset-4 transition-colors hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:decoration-white/30 dark:focus-visible:ring-white/30 ${triggers.routeClassName}`}
        >
          {title}
        </Link>
      )}
      {triggers.dialog && (
        <button
          type="button"
          // The title is inline text, so its dialog half only hides on a
          // phone; the shared class would turn it into an inline-flex box.
          className={`cursor-pointer rounded text-left underline decoration-black/25 decoration-1 underline-offset-4 transition-colors hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:decoration-white/30 dark:focus-visible:ring-white/30 ${triggers.dialogClassName ? "max-sm:hidden" : ""}`}
          onClick={() => onOpen(note)}
        >
          {title}
        </button>
      )}
    </h3>
  );
}

export function NoteActions({
  note,
  canConvertToProject,
  onEdit,
  onArchive,
  onConvert,
  onConvertToProject,
  onDelete,
  triggers,
}: NoteItemProps) {
  const title = noteTitle(note);
  const archived = Boolean(note.archived_at);
  const convertible =
    !note.converted_task_id && !note.converted_project_id && !archived;
  return (
    <DropdownMenu>
      <ResponsiveTableMenuButton label={`More actions for “${title}”`} />
      <DropdownMenuItems align="end">
        {convertible && (
          <>
            <DropdownMenuItem onClick={() => onConvert(note)}>
              <FiCheck aria-hidden /> Convert to task
            </DropdownMenuItem>
            {canConvertToProject && (
              <DropdownMenuItem onClick={() => onConvertToProject(note)}>
                <FiBriefcase aria-hidden /> Convert to project
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </>
        )}
        {!archived && triggers.route && (
          <DropdownMenuItem.Link
            href={noteEditPath(note.id)}
            className={triggers.routeClassName}
          >
            <FiEdit2 aria-hidden /> Edit note
          </DropdownMenuItem.Link>
        )}
        {!archived && triggers.dialog && (
          <DropdownMenuItem
            className={triggers.dialogClassName}
            onClick={() => onEdit(note)}
          >
            <FiEdit2 aria-hidden /> Edit note
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onArchive(note)}>
          {archived ? <FiRotateCcw aria-hidden /> : <FiArchive aria-hidden />}
          {archived ? "Restore note" : "Archive note"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onClick={() => onDelete(note)}>
          <FiTrash2 aria-hidden /> Delete note
        </DropdownMenuItem>
      </DropdownMenuItems>
    </DropdownMenu>
  );
}

export function NoteCategory({ category }: Pick<NoteItemProps, "category">) {
  return (
    <span className="inline-flex items-center min-w-0 gap-2 text-xs font-semibold text-black/70 dark:text-white/70">
      <i
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15"
        style={{ backgroundColor: category?.color ?? "#8a8a8a" }}
      />
      <span className="wrap-anywhere">{category?.name ?? "Uncategorized"}</span>
    </span>
  );
}

export function NoteAuthor({
  note,
  profiles,
}: Pick<NoteItemProps, "note" | "profiles">) {
  const author = profiles.find((profile) => profile.id === note.created_by);
  return (
    <div className="flex items-center min-w-0 gap-2.5">
      <Avatar
        name={author?.full_name ?? "Unknown teammate"}
        src={author?.avatar_url}
        size="sm"
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold wrap-anywhere">
          {author?.full_name ?? "Unknown teammate"}
        </p>
        <time
          dateTime={note.updated_at}
          className="mt-0.5 flex items-center gap-1 text-xs text-black/60 dark:text-white/60"
        >
          <FiClock className="shrink-0" aria-hidden />
          Updated {formatShortTimestamp(note.updated_at)}
        </time>
      </div>
    </div>
  );
}

export function NoteCommentCount({
  commentCount,
}: Pick<NoteItemProps, "commentCount">) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-black/70 dark:text-white/70">
      <FiMessageSquare className="shrink-0" aria-hidden />
      {commentCount}
      <span className="sr-only">
        {commentCount === 1 ? "comment" : "comments"}
      </span>
    </span>
  );
}
