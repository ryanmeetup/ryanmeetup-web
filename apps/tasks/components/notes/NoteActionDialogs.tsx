"use client";

import type { Dispatch, SetStateAction } from "react";
import { ConfirmationDialog } from "@ryanmeetup/ui";
import { NewTaskModal } from "@/components/tasks";
import { ProjectsModal } from "@/components/projects";
import {
  noteConversionDraft,
  noteConversionProjectDraft,
} from "@/lib/resources/notes";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import type { useNoteActions } from "./useNoteActions";

export function NoteActionDialogs({
  actions,
  data,
  setData,
  demoMode,
}: {
  actions: ReturnType<typeof useNoteActions>;
  data: WorkspaceData;
  setData: Dispatch<SetStateAction<WorkspaceData>>;
  demoMode: boolean;
}) {
  const { convertTarget, convertProjectTarget } = actions;
  return (
    <>
      <ConfirmationDialog
        open={Boolean(actions.deleteTarget)}
        setOpen={(open) =>
          !open && !actions.pending && actions.setDeleteTarget(null)
        }
        title="Delete this note?"
        description="This permanently removes the shared note. This cannot be undone."
        confirmLabel="Delete note"
        pending={actions.pending}
        pendingLabel="Deleting…"
        destructive
        onConfirm={() => void actions.deleteNote()}
      />
      {convertTarget && (
        <NewTaskModal
          key={convertTarget.id}
          data={data}
          setData={setData}
          demoMode={demoMode}
          open
          setOpen={(open) => !open && actions.setConvertTarget(null)}
          initialDraft={noteConversionDraft(
            convertTarget,
            data.statuses,
            data.currentProfile.id,
          )}
          onCreated={actions.markConverted}
        />
      )}
      {convertProjectTarget && (
        <ProjectsModal
          key={convertProjectTarget.id}
          modal={{
            open: true,
            setOpen: (open) => !open && actions.setConvertProjectTarget(null),
          }}
          workspace={{ data, setData, demoMode }}
          options={{
            createOnly: true,
            initialDraft: noteConversionProjectDraft(convertProjectTarget),
          }}
          events={{ onCreated: actions.markConvertedProject }}
        />
      )}
    </>
  );
}
