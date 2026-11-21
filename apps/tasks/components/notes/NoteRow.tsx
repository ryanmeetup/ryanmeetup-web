"use client";

import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuButton,
  DropdownMenuItem,
  DropdownMenuItems,
  FormattedTextPreview,
  IconButton,
} from "@ryanmeetup/ui";
import {
  FiArchive,
  FiBriefcase,
  FiCheck,
  FiChevronDown,
  FiClock,
  FiEdit2,
  FiMessageSquare,
  FiRotateCcw,
  FiTrash2,
} from "react-icons/fi";
import {
  ResponsiveTableCell,
  ResponsiveTableRow,
  type ResponsiveTableColumn,
} from "@/components/global";
import { formatShortTimestamp } from "@/lib/date-format";
import { noteTitle } from "@/lib/resources/notes";
import type { Category, Note, Project } from "@/lib/resources/resource-types";
import type { Task } from "@/lib/tasks/task-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { NoteLinks } from "./NoteLinks";

export const noteColumns: ResponsiveTableColumn[] = [
  { label: "Note" },
  { label: "Category", width: "w-32" },
  { label: "Author", width: "w-44" },
  { label: "Comments", width: "w-24" },
  { label: "Actions", width: "w-64", hideLabel: true },
];

/** One note as a row of the notes table; its title opens the note. */
export function NoteRow({
  note,
  category,
  profiles,
  canConvertToProject,
  commentCount,
  convertedTask,
  convertedProject,
  onOpen,
  onEdit,
  onArchive,
  onConvert,
  onConvertToProject,
  onDelete,
}: {
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
}) {
  const author = profiles.find((profile) => profile.id === note.created_by);
  const title = noteTitle(note);
  const archived = Boolean(note.archived_at);
  return (
    <ResponsiveTableRow>
      <ResponsiveTableCell>
        <h3 className="text-card-title font-semibold wrap-anywhere">
          <button
            type="button"
            className="rounded text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/30"
            onClick={() => onOpen(note)}
          >
            {title}
          </button>
        </h3>
        <FormattedTextPreview
          text={note.body}
          maxLines={3}
          maxLength={240}
          className="mt-1 min-w-0 break-words text-secondary text-black/70 dark:text-white/70"
        />
        <NoteLinks
          note={note}
          convertedTask={convertedTask}
          convertedProject={convertedProject}
          className="mt-2"
        />
      </ResponsiveTableCell>
      <ResponsiveTableCell>
        <span className="inline-flex min-w-0 max-w-full items-center gap-2 text-xs font-semibold text-black/70 dark:text-white/70">
          <i
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15"
            style={{ backgroundColor: category?.color ?? "#8a8a8a" }}
          />
          <span className="truncate">{category?.name ?? "Uncategorized"}</span>
        </span>
      </ResponsiveTableCell>
      <ResponsiveTableCell>
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar
            name={author?.full_name ?? "Unknown teammate"}
            src={author?.avatar_url}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">
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
      </ResponsiveTableCell>
      <ResponsiveTableCell>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-black/70 dark:text-white/70">
          <FiMessageSquare className="shrink-0" aria-hidden />
          {commentCount}
          <span className="sr-only">
            {commentCount === 1 ? "comment" : "comments"}
          </span>
        </span>
      </ResponsiveTableCell>
      <ResponsiveTableCell>
        <div className="flex flex-wrap items-center gap-2 @min-[54rem]:flex-nowrap @min-[54rem]:justify-end">
          {/* Converting is the row's call to action; the icon buttons manage the note itself. */}
          <div className="flex items-center gap-2">
            {!note.converted_task_id &&
              !note.converted_project_id &&
              !archived &&
              (canConvertToProject ? (
                <DropdownMenu>
                  <DropdownMenuButton
                    unstyled
                    className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:focus-visible:ring-white/30"
                  >
                    Convert
                    <FiChevronDown aria-hidden />
                  </DropdownMenuButton>
                  <DropdownMenuItems align="end">
                    <DropdownMenuItem onClick={() => onConvert(note)}>
                      <FiCheck aria-hidden /> Convert to task
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onConvertToProject(note)}>
                      <FiBriefcase aria-hidden /> Convert to project
                    </DropdownMenuItem>
                  </DropdownMenuItems>
                </DropdownMenu>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={() => onConvert(note)}
                >
                  Convert to task
                </Button>
              ))}
          </div>
          <div className="flex items-center gap-2">
            {!archived && (
              <IconButton
                label={`Edit “${title}”`}
                variant="edit"
                onClick={() => onEdit(note)}
              >
                <FiEdit2 />
              </IconButton>
            )}
            <IconButton
              label={archived ? `Restore “${title}”` : `Archive “${title}”`}
              variant="archive"
              onClick={() => onArchive(note)}
            >
              {archived ? <FiRotateCcw /> : <FiArchive />}
            </IconButton>
            <IconButton
              label={`Delete “${title}”`}
              variant="danger"
              onClick={() => onDelete(note)}
            >
              <FiTrash2 />
            </IconButton>
          </div>
        </div>
      </ResponsiveTableCell>
    </ResponsiveTableRow>
  );
}
