import { notFound } from "next/navigation";
import { NotePageClient } from "@/components/notes";
import { isUuid } from "@/lib/api-schema/shared";
import { redirectAccessPreviewAway } from "@/lib/server/editor-page-loader";
import { requireQueryData } from "@/lib/server/workspace-loader";
import {
  isWorkspaceDemo,
  loadWorkspacePage,
} from "@/lib/server/workspace-page-loader";
import {
  demoData,
  demoNoteComments,
  demoNotes,
} from "@/lib/workspace/demo-data";
import { noteColumns, noteCommentColumns } from "@/lib/resources/notes";

/**
 * The note's own page, shared by `/notes/[id]` and `/notes/[id]/edit`. The
 * notes list keeps its dialog from `sm` up; a phone opens this instead.
 */
export async function NotePage({
  id,
  query,
  editing,
}: {
  id: string;
  query: Record<string, string | string[] | undefined>;
  editing: boolean;
}) {
  redirectAccessPreviewAway(query, "/notes");

  if (await isWorkspaceDemo()) {
    const note = demoNotes.find((item) => item.id === id);
    if (!note) notFound();
    return (
      <NotePageClient
        initialData={demoData}
        note={note}
        initialComments={demoNoteComments.filter(
          (comment) => comment.note_id === id,
        )}
        demoMode
        initialEditing={editing}
      />
    );
  }

  if (!isUuid(id)) notFound();
  const { data, supabase } = await loadWorkspacePage(
    ["profiles", "statuses", "categories", "projects", "tasks", "taskCategories"],
    { area: "notes" },
  );
  const [noteResult, commentsResult] = await Promise.all([
    supabase.from("notes").select(noteColumns).eq("id", id).maybeSingle(),
    supabase
      .from("note_comments")
      .select(noteCommentColumns)
      .eq("note_id", id)
      .order("created_at", { ascending: true }),
  ]);
  const note = requireQueryData("note", noteResult);
  if (!note) notFound();
  return (
    <NotePageClient
      initialData={data}
      note={note}
      initialComments={requireQueryData("note comments", commentsResult)}
      demoMode={false}
      initialEditing={editing}
    />
  );
}
