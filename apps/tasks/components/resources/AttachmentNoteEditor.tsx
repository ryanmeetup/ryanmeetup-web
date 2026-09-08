"use client";

import { useState } from "react";
import {
  Button,
  getFieldLabelClasses,
  Input,
  RichTextarea,
  toast,
} from "@ryanmeetup/ui";
import { errorMessage } from "@/lib/presentation";

export function AttachmentNoteEditor({
  kind,
  resourceId,
  saving,
  initialTitle = "",
  initialBody = "",
  submitLabel = "Save note",
  onCancel,
  onSave,
}: {
  kind: "category" | "project";
  resourceId?: string;
  saving: boolean;
  initialTitle?: string;
  initialBody?: string;
  submitLabel?: string;
  onCancel: () => void;
  onSave: (title: string, body: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  async function save() {
    try {
      await onSave(title, body);
      setTitle("");
      setBody("");
    } catch (error) {
      toast.error(errorMessage(error, "The note could not be attached."));
    }
  }
  return (
    <div className="mb-3 space-y-3 rounded-xl border border-blue-500/20 bg-blue-50/50 p-3 dark:border-blue-400/20 dark:bg-blue-950/20">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
        {initialTitle ? "Edit note" : "New note"}
      </p>
      <Input
        autoFocus
        label="Note title"
        required
        name={`${kind}-note-title-${resourceId ?? "new"}`}
        value={title}
        maxLength={200}
        disabled={saving}
        onChange={(event) => setTitle(event.target.value)}
      />
      <div className="flex flex-col gap-2">
        <label
          htmlFor={`${kind}-note-body-${resourceId ?? "new"}`}
          className={getFieldLabelClasses()}
        >
          Note{" "}
          <span className="text-red-500" aria-hidden="true">
            *
          </span>
        </label>
        <RichTextarea
          id={`${kind}-note-body-${resourceId ?? "new"}`}
          aria-label="Note"
          aria-required="true"
          required
          name={`${kind}-note-body-${resourceId ?? "new"}`}
          value={body}
          maxLength={10000}
          rows={4}
          disabled={saving}
          onChange={(event) => setBody(event.target.value)}
        />
        <p className="text-xs text-black/55 dark:text-white/55">
          Format with headings, lists, links, and other Markdown.
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          loading={saving}
          loadingText="Saving..."
          disabled={!title.trim() || !body.trim()}
          onClick={() => void save()}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
