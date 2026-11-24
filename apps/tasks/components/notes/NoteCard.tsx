"use client";

import { Card, FormattedTextPreview } from "@ryanmeetup/ui";
import {
  NoteActions,
  NoteAuthor,
  NoteCategory,
  NoteCommentCount,
  NoteTitle,
  type NoteItemProps,
} from "./NoteItemParts";
import { NoteLinks } from "./NoteLinks";

export function NoteCard(props: NoteItemProps) {
  const { note, convertedTask, convertedProject } = props;
  return (
    <Card className="flex h-full min-w-0 flex-col">
      <div className="mb-3 flex items-start justify-between gap-3">
        <NoteCategory {...props} />
        <NoteActions {...props} />
      </div>
      <NoteTitle {...props} />
      <FormattedTextPreview
        text={note.body}
        maxLines={6}
        maxLength={640}
        className="mt-3 min-w-0 break-words text-body text-black/70 dark:text-white/70"
      />
      <NoteLinks
        note={note}
        convertedTask={convertedTask}
        convertedProject={convertedProject}
        className="mt-3"
      />
      <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4 dark:border-white/10">
          <NoteAuthor {...props} />
          <NoteCommentCount {...props} />
        </div>
      </div>
    </Card>
  );
}
