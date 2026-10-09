"use client";

import { useState } from "react";
import {
  Button,
  DisclosureCard,
  IconButton,
  Input,
  toast,
  Tooltip,
} from "@ryanmeetup/ui";
import {
  FiCheck,
  FiCopy,
  FiEdit2,
  FiPlus,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { CountBadge } from "@/components/global";
import {
  isChecklistPaste,
  parseChecklistPaste,
  type ChecklistPasteItem,
} from "@/lib/tasks/checklist-paste";
import type { Subtask } from "@/lib/tasks/task-types";

export function TaskChecklistPanel({
  items,
  newItemTitle,
  onAdd,
  onAddPasted,
  onDelete,
  onNewItemTitleChange,
  onRename,
  onToggle,
  saving,
}: {
  items: Subtask[];
  newItemTitle: string;
  onAdd: () => void;
  onAddPasted: (pasted: ChecklistPasteItem[]) => void;
  onDelete: (item: Subtask) => void;
  onNewItemTitleChange: (value: string) => void;
  /** Resolves true once saved, so the row knows to close its editor. */
  onRename: (item: Subtask, title: string) => Promise<boolean>;
  onToggle: (item: Subtask) => void;
  saving: boolean;
}) {
  const completed = items.filter((item) => item.is_completed).length;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [renaming, setRenaming] = useState(false);

  function beginEdit(item: Subtask) {
    setEditingId(item.id);
    setEditingTitle(item.title);
  }

  async function saveEdit(item: Subtask) {
    if (!editingTitle.trim()) return;
    setRenaming(true);
    if (await onRename(item, editingTitle)) setEditingId(null);
    setRenaming(false);
  }

  // The title doubles as the toggle, so selecting its text to copy it is
  // fiddly; this hands it over without changing the item.
  async function copy(item: Subtask) {
    try {
      await navigator.clipboard.writeText(item.title);
      toast.success("Checklist item copied.");
    } catch {
      toast.error("The checklist item could not be copied.");
    }
  }

  return (
    <DisclosureCard
      defaultOpen
      className=""
      buttonClassName="flex w-full items-center justify-between gap-3 py-1 text-left"
      panelClassName="space-y-3 pt-3"
      iconClassName="h-3.5 w-3.5"
      summary={
        <span className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em]">
            Checklist
          </span>
          <CountBadge>{items.length}</CountBadge>
        </span>
      }
    >
      {items.length > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${(completed / items.length) * 100}%` }}
          />
        </div>
      )}
      {items.length > 0 && (
        <div className="max-h-[min(11.7rem,22.75svh)] space-y-3 overflow-y-auto overscroll-contain pr-2">
          {items.map((item) =>
            editingId === item.id ? (
              <form
                key={item.id}
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveEdit(item);
                }}
              >
                <div className="min-w-0 flex-1">
                  <Input
                    label={`Rename “${item.title}”`}
                    hideLabel
                    name={`subtask-title-${item.id}`}
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setEditingId(null);
                      }
                    }}
                    disabled={renaming}
                    autoFocus
                    required
                    maxLength={1000}
                  />
                </div>
                <IconButton
                  type="submit"
                  label="Save checklist item"
                  variant="archive"
                  disabled={renaming || !editingTitle.trim()}
                >
                  <FiCheck />
                </IconButton>
                <IconButton
                  label="Cancel editing"
                  disabled={renaming}
                  onClick={() => setEditingId(null)}
                >
                  <FiX />
                </IconButton>
              </form>
            ) : (
              <div key={item.id} className="flex items-center gap-2">
                {/* The title toggles too, so the whole row is a hit target. */}
                <Tooltip
                  content={`${item.is_completed ? "Reopen" : "Complete"} ${item.title}`}
                  triggerClassName="min-w-0 flex-1"
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={item.is_completed}
                    onClick={() => onToggle(item)}
                    className="group flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span
                      aria-hidden
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded border transition ${item.is_completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-black/20 group-hover:border-black/40 dark:border-white/25 dark:group-hover:border-white/50"}`}
                    >
                      {item.is_completed && <FiCheck aria-hidden />}
                    </span>
                    <span
                      className={`min-w-0 flex-1 text-sm ${item.is_completed ? "text-black/45 line-through dark:text-white/45" : ""}`}
                    >
                      {item.title}
                    </span>
                  </button>
                </Tooltip>
                <IconButton
                  label={`Copy “${item.title}”`}
                  onClick={() => void copy(item)}
                >
                  <FiCopy />
                </IconButton>
                <IconButton
                  label={`Edit “${item.title}”`}
                  variant="edit"
                  onClick={() => beginEdit(item)}
                >
                  <FiEdit2 />
                </IconButton>
                <IconButton
                  label={`Delete “${item.title}”`}
                  variant="danger"
                  onClick={() => onDelete(item)}
                >
                  <FiTrash2 />
                </IconButton>
              </div>
            ),
          )}
        </div>
      )}
      <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 flex-1">
          <Input
            label="New checklist item"
            hideLabel
            name="new-subtask"
            value={newItemTitle}
            onChange={(event) => onNewItemTitleChange(event.target.value)}
            placeholder="Add a checklist item, or paste a list…"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAdd();
              }
            }}
            onPaste={(event) => {
              // A single-line input drops the newlines, so a pasted list has
              // to be claimed here or it collapses into one run-on item.
              const pasted = parseChecklistPaste(
                event.clipboardData.getData("text/plain"),
              );
              if (!isChecklistPaste(pasted)) return;
              event.preventDefault();
              onAddPasted(pasted);
            }}
          />
        </div>
        <Button
          type="button"
          variant="action"
          size="field"
          leftIcon={<FiPlus />}
          onClick={onAdd}
          loading={saving}
          disabled={saving || !newItemTitle.trim()}
          className="w-full sm:w-auto"
        >
          Add
        </Button>
      </div>
    </DisclosureCard>
  );
}
