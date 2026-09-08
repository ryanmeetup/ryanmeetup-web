"use client";

import Image from "next/image";
import { useId } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FormattedText, IconButton } from "@ryanmeetup/ui";
import {
  FiEdit2,
  FiExternalLink,
  FiFile,
  FiFileText,
  FiMove,
  FiTrash2,
} from "react-icons/fi";
import { formatFileSize } from "@/lib/presentation";
import type { ResourceAttachmentDraft } from "@/lib/resources/resource-management";

type DropEdge = "before" | "after";

function SortableAttachment({
  item,
  reorderable,
  children,
}: {
  item: ResourceAttachmentDraft;
  reorderable: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !reorderable });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-black/10 ${isDragging ? "relative z-10 border-blue-500/60 opacity-80 shadow-lg dark:border-blue-400/60" : ""}`}
    >
      {reorderable && (
        <button
          type="button"
          aria-label={`Drag to reorder “${item.name}”`}
          className="grid h-10 w-8 shrink-0 touch-none cursor-grab place-items-center rounded-lg border border-transparent text-black/40 transition hover:border-black/10 hover:bg-black/5 hover:text-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 active:cursor-grabbing dark:text-white/40 dark:hover:border-white/10 dark:hover:bg-white/10 dark:hover:text-white/70 dark:focus-visible:ring-white/30"
          {...attributes}
          {...listeners}
        >
          <FiMove aria-hidden />
        </button>
      )}
      {children}
    </div>
  );
}

export function AttachmentList({
  items,
  type,
  loading,
  disabled,
  onEdit,
  onRemove,
  onReorder,
}: {
  items: ResourceAttachmentDraft[];
  type: "note" | "file";
  loading: boolean;
  disabled: boolean;
  onEdit?: (item: ResourceAttachmentDraft) => void;
  onRemove: (item: ResourceAttachmentDraft) => void;
  onReorder?: (
    item: ResourceAttachmentDraft,
    targetId: string | undefined,
    edge: DropEdge,
  ) => void;
}) {
  // See ResourceLinksFields: an explicit id keeps dnd-kit's aria-describedby
  // stable across the server render and hydration.
  const dndId = useId();
  const reorderable = Boolean(onReorder) && !disabled && items.length > 1;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function finishReorder(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const fromIndex = items.findIndex((item) => item.id === event.active.id);
    const toIndex = items.findIndex((item) => item.id === event.over?.id);
    const draggedItem = items[fromIndex];
    if (draggedItem && toIndex >= 0)
      onReorder?.(
        draggedItem,
        items[toIndex]?.id,
        fromIndex < toIndex ? "after" : "before",
      );
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={finishReorder}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          className={
            items.length
              ? "max-h-[min(18rem,35dvh)] space-y-2 overflow-y-auto overscroll-contain pr-1"
              : undefined
          }
          aria-busy={loading}
        >
          {loading && (
            <p className="text-xs text-black/55 dark:text-white/55">
              Loading {type === "note" ? "notes" : "attachments"}...
            </p>
          )}
          {items.map((item) => (
            <SortableAttachment
              key={item.id}
              item={item}
              reorderable={reorderable}
            >
              {type === "file" &&
              item.mime_type?.startsWith("image/") &&
              item.url !== "#" ? (
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/5 dark:bg-white/5">
                  <Image
                    src={item.url}
                    alt=""
                    fill
                    unoptimized
                    sizes="48px"
                    className="object-cover"
                  />
                </span>
              ) : (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-black/5 text-black/55 dark:bg-white/5 dark:text-white/55">
                  {type === "note" ? (
                    <FiFileText aria-hidden />
                  ) : (
                    <FiFile aria-hidden />
                  )}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                {type === "note" ? (
                  <div className="mt-1 line-clamp-2 text-sm text-black/65 dark:text-white/65">
                    <FormattedText text={item.body ?? ""} />
                  </div>
                ) : (
                  <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">
                    {formatFileSize(item.size_bytes) || "File"}
                  </p>
                )}
              </div>
              {type === "note" && onEdit && (
                <IconButton
                  type="button"
                  label={`Edit “${item.name}”`}
                  variant="edit"
                  disabled={disabled}
                  onClick={() => onEdit(item)}
                >
                  <FiEdit2 />
                </IconButton>
              )}
              {type === "file" && item.url !== "#" && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${item.name} in a new tab`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:hover:bg-white/10 dark:focus-visible:ring-white/30"
                >
                  <FiExternalLink aria-hidden />
                </a>
              )}
              <IconButton
                type="button"
                label={`Remove “${item.name}”`}
                variant="danger"
                disabled={disabled}
                onClick={() => onRemove(item)}
              >
                <FiTrash2 />
              </IconButton>
            </SortableAttachment>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
