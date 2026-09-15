"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId, useState, type CSSProperties, type KeyboardEvent } from "react";
import { FiMove, FiX } from "react-icons/fi";
import { getFieldLabelClasses } from "./fieldStyles";

export type TagInputProps = {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  maxTags?: number;
  maxTagLength?: number;
};

function SortableTag({
  id,
  tag,
  reorderable,
  disabled,
  onRemove,
}: {
  id: string;
  tag: string;
  reorderable: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !reorderable });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <span
      ref={setNodeRef}
      style={style}
      data-tag-value={tag}
      className={`inline-flex max-w-full items-center rounded-full border border-black/15 bg-black/5 py-1 pr-1 text-xs font-semibold text-black/75 dark:border-white/15 dark:bg-white/10 dark:text-white/80 ${reorderable ? "pl-1" : "pl-2.5"} ${isDragging ? "relative z-10 border-blue-500/60 opacity-80 shadow-lg dark:border-blue-400/60" : ""}`}
    >
      {reorderable && (
        <button
          type="button"
          aria-label={`Drag to reorder “${tag}”`}
          className="grid h-5 w-5 shrink-0 touch-none cursor-grab place-items-center rounded-full text-black/40 transition hover:bg-black/10 hover:text-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 active:cursor-grabbing dark:text-white/40 dark:hover:bg-white/15 dark:hover:text-white/75 dark:focus-visible:ring-white/30"
          {...attributes}
          {...listeners}
        >
          <FiMove aria-hidden className="h-3 w-3" />
        </button>
      )}
      <span className="truncate px-1">{tag}</span>
      <button
        type="button"
        aria-label={`Remove ${tag}`}
        onClick={onRemove}
        disabled={disabled}
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:cursor-not-allowed dark:hover:bg-white/15 dark:focus-visible:ring-white/30"
      >
        <FiX aria-hidden className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export function TagInput({
  label,
  value,
  onChange,
  placeholder = "Type a tag, then press Enter",
  disabled = false,
  maxTags,
  maxTagLength = 40,
}: TagInputProps) {
  const inputId = useId();
  const dndId = useId();
  const [draft, setDraft] = useState("");
  const itemIds = value;
  const reorderable = !disabled && value.length > 1;
  const atLimit = maxTags !== undefined && value.length >= maxTags;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function addDraft() {
    const tag = draft.trim().replace(/,$/, "").trim();
    if (!tag || atLimit) return;
    if (!value.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      onChange([...value, tag]);
    }
    setDraft("");
  }

  function finishReorder(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const fromIndex = itemIds.indexOf(String(event.active.id));
    const toIndex = itemIds.indexOf(String(event.over.id));
    if (fromIndex >= 0 && toIndex >= 0) {
      onChange(arrayMove(value, fromIndex, toIndex));
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === "Enter" || event.key === "Tab") && draft.trim()) {
      event.preventDefault();
      addDraft();
    } else if (event.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className={getFieldLabelClasses()} htmlFor={inputId}>
        <span>{label}</span>
      </label>
      <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-black/20 bg-white px-3 py-2 shadow-sm transition focus-within:ring-2 focus-within:ring-black/30 dark:border-white/20 dark:bg-white/10 dark:focus-within:ring-white/30">
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={finishReorder}
        >
          <SortableContext items={itemIds} strategy={rectSortingStrategy}>
            {value.map((tag, index) => (
              <SortableTag
                key={itemIds[index]}
                id={itemIds[index]}
                tag={tag}
                reorderable={reorderable}
                disabled={disabled}
                onRemove={() =>
                  onChange(value.filter((_, itemIndex) => itemIndex !== index))
                }
              />
            ))}
          </SortableContext>
        </DndContext>
        <input
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addDraft}
          placeholder={value.length === 0 ? placeholder : "Add another…"}
          disabled={disabled || atLimit}
          maxLength={maxTagLength}
          className="min-w-36 flex-1 bg-transparent px-1 py-1 text-sm text-black outline-none placeholder:text-black/45 disabled:cursor-not-allowed disabled:opacity-60 dark:text-white dark:placeholder:text-white/45"
        />
      </div>
      <p className="text-xs text-black/50 dark:text-white/50">
        {value.length > 1 && "Drag tags to reorder. "}Press Enter or Tab to add
        a tag.{maxTags !== undefined && ` ${value.length}/${maxTags}`}
      </p>
    </div>
  );
}
