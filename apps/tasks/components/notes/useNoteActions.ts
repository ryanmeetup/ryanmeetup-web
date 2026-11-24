"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@ryanmeetup/ui";
import { mutate } from "@/lib/mutation-client";
import { errorMessage } from "@/lib/presentation";
import { linkNoteToProject } from "@/lib/resources/notes";
import type { Note, Project } from "@/lib/resources/resource-types";
import { taskPath } from "@/lib/tasks/task-key";
import type { Task } from "@/lib/tasks/task-types";
import type { NoteActionsProps } from "./NoteItemParts";

export type NoteActionHandlers = Omit<
  NoteActionsProps,
  "note" | "triggers" | "onEdit"
>;

/** The list and note detail surfaces share these mutations and conversion outcomes. */
export function useNoteActions({
  demoMode,
  canConvertToProject,
  onUpdate,
  onRemove,
}: {
  demoMode: boolean;
  canConvertToProject: boolean;
  onUpdate: (note: Note) => void;
  onRemove: (note: Note, reason: "deleted" | "converted") => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [convertTarget, setConvertTarget] = useState<Note | null>(null);
  const [convertProjectTarget, setConvertProjectTarget] = useState<Note | null>(
    null,
  );

  async function toggleArchived(note: Note) {
    if (pending) return;
    setPending(true);
    const next = {
      ...note,
      archived_at: note.archived_at ? null : new Date().toISOString(),
    };
    onUpdate(next);
    try {
      if (!demoMode) {
        const result = await mutate<{ note: Note }>("/api/notes", {
          method: "PATCH",
          body: JSON.stringify({
            id: note.id,
            archived: Boolean(next.archived_at),
          }),
        });
        onUpdate(result.note);
      }
      toast.success(next.archived_at ? "Note archived." : "Note restored.");
    } catch (error) {
      onUpdate(note);
      toast.error(errorMessage(error, "The note could not be updated."));
    } finally {
      setPending(false);
    }
  }

  async function deleteNote() {
    if (!deleteTarget || pending) return;
    setPending(true);
    try {
      if (!demoMode)
        await mutate("/api/notes", {
          method: "DELETE",
          body: JSON.stringify({ id: deleteTarget.id }),
        });
      onRemove(deleteTarget, "deleted");
      setDeleteTarget(null);
      toast.success("Note deleted.");
    } catch (error) {
      toast.error(errorMessage(error, "The note could not be deleted."));
    } finally {
      setPending(false);
    }
  }

  async function markConverted(task: Task) {
    if (!convertTarget) return;
    const note = convertTarget;
    try {
      if (!demoMode)
        await mutate("/api/notes", {
          method: "DELETE",
          body: JSON.stringify({ id: note.id }),
        });
      onRemove(note, "converted");
      toast.success("Note converted to a task and deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `The task was created, but the note could not be deleted: ${error.message}`
          : "The task was created, but the note could not be deleted.",
      );
    } finally {
      setConvertTarget(null);
      router.push(taskPath(task));
    }
  }

  async function markConvertedProject(project: Project) {
    if (!convertProjectTarget) return;
    try {
      const updated = demoMode
        ? linkNoteToProject(convertProjectTarget, project)
        : (
            await mutate<{ note: Note }>("/api/notes", {
              method: "PATCH",
              body: JSON.stringify({
                id: convertProjectTarget.id,
                convertedProjectId: project.id,
              }),
            })
          ).note;
      onUpdate(updated);
      toast.success("Note converted to a project.");
    } catch {
      toast.error(
        "The project was created, but the note could not be linked to it.",
      );
    } finally {
      setConvertProjectTarget(null);
    }
  }

  const menuActions: NoteActionHandlers = {
    canConvertToProject,
    disabled: pending,
    onArchive: (note) => void toggleArchived(note),
    onDelete: setDeleteTarget,
    onConvert: setConvertTarget,
    onConvertToProject: setConvertProjectTarget,
  };

  return {
    menuActions,
    pending,
    deleteTarget,
    setDeleteTarget,
    deleteNote,
    convertTarget,
    setConvertTarget,
    markConverted,
    convertProjectTarget,
    setConvertProjectTarget,
    markConvertedProject,
  };
}
