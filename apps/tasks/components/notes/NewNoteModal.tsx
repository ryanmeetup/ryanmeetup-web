"use client";

import { useId, useState } from "react";
import { FiPlus } from "react-icons/fi";
import {
  DropdownSelect,
  Input,
  Modal,
  ModalActions,
  Textarea,
} from "@ryanmeetup/ui";
import type { Category } from "@/lib/resources/resource-types";

export type NewNoteDraft = { title: string; body: string; categoryId: string };

/** Captures a note in a dialog; resolves `onCreate` to true once it is saved. */
export function NewNoteModal({
  open,
  setOpen,
  categories,
  onCreate,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  categories: Category[];
  onCreate: (draft: NewNoteDraft) => Promise<boolean>;
}) {
  const formId = useId();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  function close() {
    if (saving) return;
    setOpen(false);
  }

  async function submit() {
    if (!title.trim() || !body.trim() || saving) return;
    setSaving(true);
    const saved = await onCreate({ title, body, categoryId });
    setSaving(false);
    if (!saved) return;
    setTitle("");
    setBody("");
    setCategoryId("");
    setOpen(false);
  }

  return (
    <Modal
      open={open}
      setIsOpen={(next) => (next ? setOpen(true) : close())}
      closable={!saving}
      title="New note"
      description="Name the thought, then capture the useful detail."
      formId={formId}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      actions={
        <ModalActions
          onCancel={close}
          confirmLabel="Save note"
          confirmForm={formId}
          confirmIcon={<FiPlus aria-hidden />}
          confirmDisabled={!title.trim() || !body.trim()}
          pending={saving}
          pendingLabel="Saving…"
        />
      }
    >
      <div className="space-y-4">
        <Input
          id="quick-note-title"
          label="Note title"
          required
          name="quick-note-title"
          value={title}
          maxLength={200}
          placeholder="Give this note a clear title"
          disabled={saving}
          autoFocus
          onChange={(event) => setTitle(event.target.value)}
        />
        <Textarea
          id="quick-note"
          label="Details"
          required
          name="quick-note"
          value={body}
          rows={6}
          maxLength={10000}
          placeholder="Add the context, idea, or decision…"
          disabled={saving}
          onChange={(event) => setBody(event.target.value)}
        />
        <DropdownSelect
          variant="field"
          label="Category"
          value={categoryId}
          onChange={setCategoryId}
          options={[
            { label: "Uncategorized", value: "" },
            ...categories
              .filter((category) => !category.archived_at)
              .map((category) => ({
                label: category.name,
                value: category.id,
                color: category.color,
              })),
          ]}
          disabled={saving}
        />
      </div>
    </Modal>
  );
}
