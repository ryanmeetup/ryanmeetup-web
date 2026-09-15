"use client";

import { useState } from "react";
import {
  Avatar,
  Button,
  FormattedText,
  getFieldLabelClasses,
  Input,
  Modal,
  ModalActions,
  RichTextarea,
} from "@ryanmeetup/ui";
import { FiClock, FiEdit2 } from "react-icons/fi";
import { formatTimestamp } from "@/lib/date-format";
import { noteTitle } from "@/lib/resources/notes";
import type {
  Category,
  Note,
  NoteComment,
  Project,
} from "@/lib/resources/resource-types";
import type { Task } from "@/lib/tasks/task-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { NoteComments } from "./NoteComments";
import { NoteLinks } from "./NoteLinks";

export function NoteModal({
  note,
  category,
  profiles,
  demoMode,
  previewing,
  editing,
  setEditing,
  convertedTask,
  convertedProject,
  comments,
  currentProfileId,
  onCommentsChange,
  onSave,
  onClose,
}: {
  note: Note;
  category: Category | null;
  profiles: WorkspaceData["profiles"];
  demoMode: boolean;
  previewing: boolean;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  convertedTask?: Task;
  convertedProject?: Project;
  comments: NoteComment[];
  currentProfileId: string;
  onCommentsChange: (comments: NoteComment[]) => void;
  onSave: (title: string, body: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(note.title ?? "");
  const [body, setBody] = useState(note.body);
  const [saving, setSaving] = useState(false);
  const author = profiles.find((profile) => profile.id === note.created_by);
  const formId = `edit-note-form-${note.id}`;
  const archived = Boolean(note.archived_at);
  const changed = title.trim() !== (note.title ?? "") || body !== note.body;

  function startEditing() {
    setTitle(note.title ?? "");
    setBody(note.body);
    setEditing(true);
  }

  async function save() {
    if (!title.trim() || !body.trim() || saving) return;
    setSaving(true);
    const saved = await onSave(title, body);
    setSaving(false);
    if (saved) setEditing(false);
  }

  return (
    <Modal
      open
      setIsOpen={(open) => {
        if (!open && !saving) onClose();
      }}
      closable={!saving}
      title={editing ? `Edit ${noteTitle(note)}` : noteTitle(note)}
      description={
        editing
          ? "Give the note a title worth scanning and keep the details in the body."
          : undefined
      }
      size="lg"
      actions={
        editing ? (
          <ModalActions
            cancelLabel="Cancel"
            confirmDisabled={!title.trim() || !body.trim() || !changed}
            confirmForm={formId}
            confirmLabel="Save note"
            onCancel={() => setEditing(false)}
            pending={saving}
            pendingLabel="Saving…"
          />
        ) : previewing || archived ? (
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        ) : (
          <ModalActions
            cancelLabel="Close"
            confirmIcon={<FiEdit2 />}
            confirmLabel="Edit note"
            onCancel={onClose}
            onConfirm={startEditing}
          />
        )
      }
    >
      {editing ? (
        <form
          id={formId}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Input
            label="Note title"
            name={`note-title-${note.id}`}
            placeholder="Give this note a clear title"
            value={title}
            maxLength={200}
            disabled={saving}
            required
            autoFocus
            onChange={(event) => setTitle(event.target.value)}
          />
          <div className="flex flex-col gap-2">
            <label
              htmlFor={`note-body-${note.id}`}
              className={getFieldLabelClasses()}
            >
              Note{" "}
              <span className="text-red-500" aria-hidden="true">
                *
              </span>
            </label>
            <RichTextarea
              id={`note-body-${note.id}`}
              aria-label="Note"
              aria-required="true"
              required
              name={`note-body-${note.id}`}
              value={body}
              rows={10}
              maxLength={10000}
              disabled={saving}
              onChange={(event) => setBody(event.target.value)}
            />
            <p className="text-xs text-black/55 dark:text-white/55">
              Format with headings, lists, links, and other Markdown.
            </p>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-black/10 bg-black/[0.025] px-4 py-3 text-xs text-black/50 dark:border-white/10 dark:bg-white/[0.035] dark:text-white/50">
            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/65 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
              <i
                className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15"
                style={{ backgroundColor: category?.color ?? "#8a8a8a" }}
              />
              <span className="truncate">
                {category?.name ?? "Uncategorized"}
              </span>
            </span>
            <span className="inline-flex items-center gap-2 font-medium text-black/65 dark:text-white/65">
              <Avatar
                name={author?.full_name ?? "Unknown teammate"}
                src={author?.avatar_url}
                size="sm"
              />
              {author?.full_name ?? "Unknown teammate"}
            </span>
            <time
              dateTime={note.updated_at}
              className="inline-flex items-center gap-1.5"
            >
              <FiClock className="shrink-0" aria-hidden />
              Updated {formatTimestamp(note.updated_at)}
            </time>
          </div>
          <div className="min-h-20 rounded-xl border border-black/10 bg-white/55 p-4 shadow-sm shadow-black/[0.025] dark:border-white/10 dark:bg-black/10 dark:shadow-none sm:p-5">
            <FormattedText
              text={note.body}
              className="min-w-0 break-words text-[15px] leading-7 text-black/80 dark:text-white/80"
            />
          </div>
          <NoteLinks
            note={note}
            convertedTask={convertedTask}
            convertedProject={convertedProject}
          />
          <NoteComments
            noteId={note.id}
            comments={comments}
            currentProfileId={currentProfileId}
            profiles={profiles}
            demoMode={demoMode}
            previewing={previewing}
            onChange={onCommentsChange}
          />
        </div>
      )}
    </Modal>
  );
}
