"use client";

import { useState } from "react";
import { Input, Modal, ModalActions, Textarea, toast } from "@ryanmeetup/ui";
import type { Status } from "@/lib/tasks/task-types";
import { errorMessage } from "@/lib/presentation";
import { mutate } from "@/lib/mutation-client";

const FORM_ID = "create-status-form";

/**
 * Adds a shared status. It opens from the Statuses page header rather than
 * sitting under the list, so the form never competes with the columns it adds
 * to and the list stays the whole page.
 */
export function StatusCreateModal({
  open,
  setOpen,
  statuses,
  onStatusesChange,
  demoMode,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  statuses: Status[];
  onStatusesChange: (update: (current: Status[]) => Status[]) => void;
  demoMode: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#ee1a25");
  const [saving, setSaving] = useState(false);

  function close() {
    setOpen(false);
    setName("");
    setDescription("");
  }

  async function add() {
    const nextName = name.trim();
    if (!nextName || saving) return;
    setSaving(true);
    let item: Status = {
      id: crypto.randomUUID(),
      name: nextName,
      description: description.trim() || null,
      color,
      sort_order: statuses.length,
      order_revision: statuses[0]?.order_revision ?? 0,
      is_default: false,
      outcome: "open",
      requires_reason: false,
    };
    try {
      if (!demoMode) {
        const result = await mutate<{ status: typeof item }>("/api/statuses", {
          method: "POST",
          body: JSON.stringify({
            name: item.name,
            description: item.description,
            color: item.color,
          }),
        });
        item = result.status;
      }
      onStatusesChange((current) => [...current, item]);
      close();
      toast.success(`${item.name} added.`);
    } catch (error) {
      toast.error(errorMessage(error, "The status could not be added."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      setIsOpen={(nextOpen) => {
        if (saving) return;
        if (nextOpen) setOpen(true);
        else close();
      }}
      title="New status"
      description="Adds a column to every board in the workspace."
      size="md"
      closable={!saving}
      actions={
        <ModalActions
          confirmForm={FORM_ID}
          confirmLabel="Add status"
          confirmDisabled={!name.trim()}
          onCancel={close}
          pending={saving}
          pendingLabel="Adding..."
        />
      }
    >
      <form
        id={FORM_ID}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <Input
            label="Status name"
            required
            name="setting-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Blocked"
            disabled={saving}
            autoFocus
            maxLength={80}
          />
          <label className="date-field">
            <span>
              Color <span className="text-red-500">*</span>
            </span>
            <input
              type="color"
              aria-label="Color for the new status"
              className="color-input !h-11 !w-11"
              value={color}
              required
              disabled={saving}
              onChange={(event) => setColor(event.target.value)}
            />
          </label>
        </div>
        <Textarea
          id="setting-description"
          label="Brief description"
          name="setting-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What belongs in this column?"
          disabled={saving}
          maxLength={240}
          rows={2}
        />
      </form>
    </Modal>
  );
}
