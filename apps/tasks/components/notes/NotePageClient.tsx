"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@ryanmeetup/ui";
import {
  editorPageContentClassName,
  WorkspacePageShell,
} from "@/components/global";
import { errorMessage } from "@/lib/presentation";
import { noteEditPath, notePath } from "@/lib/resources/notes";
import type { Note, NoteComment } from "@/lib/resources/resource-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { NoteModal } from "./NoteModal";
import { NoteActionDialogs } from "./NoteActionDialogs";
import { useNoteActions } from "./useNoteActions";
import { saveNoteDraft } from "./note-requests";

/**
 * `/notes/[id]` and `/notes/[id]/edit` — the note dialog as the note's own
 * page. Switching between reading and editing keeps the address in step
 * without a round trip, so a reload or a shared link lands in the same mode.
 */
export function NotePageClient({
  initialData,
  note: initialNote,
  initialComments,
  demoMode,
  initialEditing,
}: {
  initialData: WorkspaceData;
  note: Note;
  initialComments: NoteComment[];
  demoMode: boolean;
  initialEditing: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [note, setNote] = useState(initialNote);
  const [comments, setComments] = useState(initialComments);
  const [editing, setEditingState] = useState(
    initialEditing && !initialNote.archived_at,
  );
  const router = useRouter();
  const noteActions = useNoteActions({
    demoMode,
    canConvertToProject: demoMode || data.currentProfile.app_role === "owner",
    onUpdate: setNote,
    onRemove: (_removed, reason) => {
      if (reason === "deleted") router.push("/notes");
    },
  });

  function setEditing(next: boolean) {
    setEditingState(next);
    window.history.replaceState(
      null,
      "",
      next ? noteEditPath(note.id) : notePath(note.id),
    );
  }

  return (
    <WorkspacePageShell
      data={data}
      demoMode={demoMode}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      setData={setData}
      contentClassName={editorPageContentClassName}
    >
      <NoteModal
        presentation="page"
        note={note}
        actions={noteActions.menuActions}
        category={
          data.categories.find(
            (category) => category.id === note.category_id,
          ) ?? null
        }
        profiles={data.profiles}
        demoMode={demoMode}
        editing={editing && !note.archived_at}
        setEditing={setEditing}
        convertedTask={data.tasks.find(
          (task) => task.id === note.converted_task_id,
        )}
        convertedProject={data.projects.find(
          (project) => project.id === note.converted_project_id,
        )}
        comments={comments}
        currentProfileId={data.currentProfile.id}
        onCommentsChange={setComments}
        onSave={async (title, body) => {
          try {
            setNote(await saveNoteDraft(note, title, body, demoMode));
            toast.success("Note saved.");
            return true;
          } catch (error) {
            toast.error(errorMessage(error, "The note could not be saved."));
            return false;
          }
        }}
        onClose={() => router.push("/notes")}
      />
      <NoteActionDialogs
        actions={noteActions}
        data={data}
        setData={setData}
        demoMode={demoMode}
      />
    </WorkspacePageShell>
  );
}
