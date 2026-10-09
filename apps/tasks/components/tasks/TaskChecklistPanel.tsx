"use client";

import { useEffect, useRef, useState } from "react";
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
import { SkeletonBar } from "@/components/global/SkeletonBar";
import {
  isChecklistPaste,
  parseChecklistPaste,
  type ChecklistPasteItem,
} from "@/lib/tasks/checklist-paste";
import type { Subtask } from "@/lib/tasks/task-types";

const expandedStorageKey = "ryanmeetup.tasks.checklist-expanded";

/** Mirrors an item's checkbox and title while the checklist loads. */
function TaskChecklistSkeletons() {
  return (
    <div
      aria-hidden="true"
      data-task-checklist-skeleton=""
      className="space-y-3 border-y border-black/10 py-3 pr-2 pl-1 dark:border-white/10"
    >
      {["w-3/5", "w-2/5", "w-1/2"].map((width) => (
        <div key={width} className="flex h-9 items-center gap-2">
          <SkeletonBar className="h-5 w-5 shrink-0" />
          <SkeletonBar className={`h-4 ${width}`} />
        </div>
      ))}
    </div>
  );
}

export function TaskChecklistPanel({
  items: loadedItems,
  loading,
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
  /** The task's items are being fetched, so any held here may be stale. */
  loading: boolean;
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
  const items = loading ? [] : loadedItems;
  const completed = items.filter((item) => item.is_completed).length;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const capRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasItems = items.length > 0;

  // Whether the list is shown in full is a per-viewer habit, not task state.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(expandedStorageKey) === "true";
      queueMicrotask(() => setExpanded(saved));
    } catch {
      // Storage can be blocked; the capped list is a fine default.
    }
  }, []);

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    try {
      localStorage.setItem(expandedStorageKey, String(next));
    } catch {
      // Storage can be blocked; the toggle still works for this visit.
    }
  }

  // The cap is partly viewport-relative, so whether the list outgrows it is
  // measured against a probe at the cap's height. Measuring the list itself
  // would stop working once it is expanded and no longer capped.
  useEffect(() => {
    const cap = capRef.current;
    const content = contentRef.current;
    if (!cap || !content) return;
    const measure = () =>
      // The probe includes the list's border and padding; the content does not.
      setOverflowing(content.offsetHeight + 26 > cap.offsetHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(cap);
    observer.observe(content);
    return () => observer.disconnect();
  }, [hasItems]);

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
          {!loading && <CountBadge>{items.length}</CountBadge>}
        </span>
      }
    >
      {loading && (
        <>
          <span className="sr-only" role="status">
            Loading checklist
          </span>
          <TaskChecklistSkeletons />
        </>
      )}
      {items.length > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${(completed / items.length) * 100}%` }}
          />
        </div>
      )}
      {items.length > 0 && (
        // Clipped so the probe can never add scroll height of its own.
        <div className="relative overflow-hidden">
          <div
            ref={capRef}
            aria-hidden
            className="pointer-events-none invisible absolute top-0 left-0 h-[min(13.2rem,calc(22.75svh+1.5rem))] w-px"
          />
          <div
            id="task-checklist-items"
            // Desktop has the room to show the whole list, so only smaller
            // screens cap it behind the toggle.
            className={`${expanded ? "" : "max-h-[min(13.2rem,calc(22.75svh+1.5rem))] overflow-y-auto overscroll-contain lg:max-h-none lg:overflow-visible"} border-y border-black/10 py-3 pr-2 pl-1 dark:border-white/10`}
          >
            <div ref={contentRef} className="space-y-3">
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
                        onChange={(event) =>
                          setEditingTitle(event.target.value)
                        }
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
          </div>
        </div>
      )}
      {(overflowing || expanded) && items.length > 0 && (
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls="task-checklist-items"
          className="cursor-pointer text-xs font-semibold text-black/55 lg:hidden underline decoration-black/25 underline-offset-2 transition hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:text-white/55 dark:decoration-white/25 dark:hover:text-white dark:focus-visible:ring-white/40"
        >
          {expanded ? "Show fewer" : `Show all ${items.length} items`}
        </button>
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
