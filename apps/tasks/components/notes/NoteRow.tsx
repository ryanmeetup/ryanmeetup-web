"use client";

import { FormattedTextPreview } from "@ryanmeetup/ui";
import {
  ResponsiveTableCell,
  ResponsiveTableRow,
  type ResponsiveTableColumn,
} from "@/components/global";
import {
  NoteActions,
  NoteAuthor,
  NoteCategory,
  NoteCommentCount,
  NoteTitle,
  type NoteItemProps,
} from "./NoteItemParts";
import { NoteLinks } from "./NoteLinks";

/** Sized by content (the table's auto layout): only the note's text wraps. */
export const noteColumns: ResponsiveTableColumn[] = [
  { label: "Note" },
  { label: "Category" },
  { label: "Author" },
  { label: "Comments" },
  { label: "Actions", hideLabel: true },
];

/** One note as a row of the notes table; its title opens the note. */
export function NoteRow(props: NoteItemProps) {
  const { note, convertedTask, convertedProject } = props;
  return (
    <ResponsiveTableRow>
      <ResponsiveTableCell>
        <div className="max-w-xl">
          <NoteTitle {...props} />
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
        </div>
      </ResponsiveTableCell>
      <ResponsiveTableCell>
        <NoteCategory {...props} />
      </ResponsiveTableCell>
      <ResponsiveTableCell>
        <NoteAuthor {...props} />
      </ResponsiveTableCell>
      <ResponsiveTableCell>
        <NoteCommentCount {...props} />
      </ResponsiveTableCell>
      <ResponsiveTableCell className="@min-[54rem]:w-px">
        <NoteActions {...props} />
      </ResponsiveTableCell>
    </ResponsiveTableRow>
  );
}
