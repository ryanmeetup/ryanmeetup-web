"use client";

import { mutate } from "@/lib/mutation-client";
import { applyNoteDraft } from "@/lib/resources/notes";
import type { Note } from "@/lib/resources/resource-types";

/** Save a note's title and body, from the notes list's dialog or the note's own page. */
export async function saveNoteDraft(
  note: Note,
  title: string,
  body: string,
  demoMode: boolean,
): Promise<Note> {
  if (demoMode) return applyNoteDraft(note, title, body);
  return (
    await mutate<{ note: Note }>("/api/notes", {
      method: "PATCH",
      body: JSON.stringify({ id: note.id, title: title.trim() || null, body }),
    })
  ).note;
}
