"use client";

import { useId, useState } from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";
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
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, IconButton, Input } from "@ryanmeetup/ui";
import { ensureHttpUrlScheme } from "@ryanmeetup/utils";
import {
  FiCheck,
  FiEdit2,
  FiExternalLink,
  FiMove,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import { CountBadge } from "@/components/global";
import type { ResourceLink } from "@/lib/resources/resource-types";
import { LinkPreviewThumbnail } from "./LinkPreviewThumbnail";

function linkDestination(url: string) {
  try {
    return new URL(ensureHttpUrlScheme(url)).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SortableLinkRow({
  id,
  link,
  reorderable,
  disabled,
  onEdit,
  onRemove,
}: {
  id: string;
  link: ResourceLink;
  reorderable: boolean;
  disabled: boolean;
  onEdit: () => void;
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
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 rounded-xl border border-black/10 bg-white/70 p-2 dark:border-white/10 dark:bg-black/10 ${isDragging ? "relative z-10 border-blue-500/60 opacity-80 shadow-lg dark:border-blue-400/60" : ""}`}
    >
      {reorderable && (
        <button
          type="button"
          aria-label={`Drag to reorder “${link.label || "link"}”`}
          className="grid h-9 w-7 shrink-0 touch-none cursor-grab place-items-center rounded-lg text-black/35 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 active:cursor-grabbing dark:text-white/35 dark:hover:bg-white/10 dark:hover:text-white/65 dark:focus-visible:ring-white/30"
          {...attributes}
          {...listeners}
        >
          <FiMove aria-hidden />
        </button>
      )}
      <a
        href={ensureHttpUrlScheme(link.url)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 transition hover:bg-black/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:hover:bg-white/[0.04] dark:focus-visible:ring-white/30"
      >
        <LinkPreviewThumbnail url={link.url} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {link.label}
          </span>
          <span className="block truncate text-xs text-black/50 dark:text-white/50">
            {linkDestination(link.url)}
          </span>
        </span>
        <FiExternalLink
          aria-hidden
          className="mr-1 shrink-0 text-black/45 dark:text-white/45"
        />
      </a>
      <IconButton
        type="button"
        label={`Edit “${link.label}”`}
        variant="edit"
        disabled={disabled}
        onClick={onEdit}
      >
        <FiEdit2 />
      </IconButton>
      <IconButton
        type="button"
        label={`Remove “${link.label}”`}
        variant="danger"
        disabled={disabled}
        onClick={onRemove}
      >
        <FiTrash2 />
      </IconButton>
    </div>
  );
}

export function ResourceLinksFields({
  links,
  setLinks,
  disabled,
  namePrefix,
  className = "rounded-xl border border-black/10 bg-black/[0.015] p-4 dark:border-white/10 dark:bg-white/[0.025]",
  title = "Useful links",
  hint = "Attach docs, designs, folders, or any other helpful web page.",
  addLabel = "Add link",
  labelPlaceholder = "Design file",
  urlPlaceholder = "example.com",
}: {
  links: ResourceLink[];
  setLinks: Dispatch<SetStateAction<ResourceLink[]>>;
  disabled: boolean;
  namePrefix: string;
  className?: string;
  title?: string;
  hint?: string;
  addLabel?: string;
  labelPlaceholder?: string;
  urlPlaceholder?: string;
}) {
  const dndId = useId();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [linkDraft, setLinkDraft] = useState<ResourceLink | null>(null);
  const itemIds = links.map((_, index) => `${namePrefix}-link-${index}`);
  const reorderable = !disabled && editingIndex === null && links.length > 1;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function finishReorder(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const fromIndex = itemIds.indexOf(String(event.active.id));
    const toIndex = itemIds.indexOf(String(event.over.id));
    if (fromIndex >= 0 && toIndex >= 0)
      setLinks((current) => arrayMove(current, fromIndex, toIndex));
  }

  function update(field: keyof ResourceLink, value: string) {
    setLinkDraft((current) =>
      current ? { ...current, [field]: value } : current,
    );
  }

  function addLink() {
    setEditingIndex(links.length);
    setLinkDraft({ label: "", url: "" });
  }

  function editLink(index: number) {
    setEditingIndex(index);
    setLinkDraft({ ...links[index] });
  }

  function cancelEdit() {
    setEditingIndex(null);
    setLinkDraft(null);
  }

  const editorComplete = Boolean(
    linkDraft?.label.trim() && linkDraft.url.trim(),
  );

  return (
    <section
      className={className}
      aria-labelledby={`${namePrefix}-links-title`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3
              id={`${namePrefix}-links-title`}
              className="text-sm font-semibold"
            >
              {title}
            </h3>
            {links.length > 0 && <CountBadge>{links.length}</CountBadge>}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-black/55 dark:text-white/55">
            {hint}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leftIcon={<FiPlus aria-hidden />}
          className="w-full shrink-0 !normal-case tracking-normal sm:w-auto"
          disabled={disabled || links.length >= 10 || editingIndex !== null}
          onClick={addLink}
        >
          {addLabel}
        </Button>
      </div>

      {editingIndex !== null && linkDraft && (
        <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-50/50 p-3 dark:border-blue-400/20 dark:bg-blue-950/20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
            {editingIndex < links.length ? "Edit link" : "New link"}
          </p>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
            <Input
              autoFocus
              label="Label"
              name={`${namePrefix}-link-label-${editingIndex}`}
              value={linkDraft.label}
              placeholder={labelPlaceholder}
              maxLength={80}
              required
              disabled={disabled}
              onChange={(event) => update("label", event.target.value)}
            />
            <Input
              label="URL"
              name={`${namePrefix}-link-url-${editingIndex}`}
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              value={linkDraft.url}
              placeholder={urlPlaceholder}
              required
              disabled={disabled}
              onChange={(event) => update("url", event.target.value)}
              onBlur={(event) =>
                update("url", ensureHttpUrlScheme(event.target.value))
              }
            />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={cancelEdit}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              leftIcon={<FiCheck aria-hidden />}
              disabled={disabled || !editorComplete}
              onClick={() => {
                const nextLink = {
                  ...linkDraft,
                  url: ensureHttpUrlScheme(linkDraft.url),
                };
                setLinks((current) =>
                  editingIndex < current.length
                    ? current.map((link, index) =>
                        index === editingIndex ? nextLink : link,
                      )
                    : [...current, nextLink],
                );
                setEditingIndex(null);
                setLinkDraft(null);
              }}
            >
              Done
            </Button>
          </div>
        </div>
      )}

      {links.length > 0 ? (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={finishReorder}
        >
          <SortableContext
            items={itemIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="mt-4 max-h-[min(18rem,35dvh)] space-y-2 overflow-y-auto overscroll-contain pr-1">
              {links.map((link, index) =>
                index === editingIndex ? null : (
                  <SortableLinkRow
                    key={itemIds[index]}
                    id={itemIds[index]}
                    link={link}
                    reorderable={reorderable}
                    disabled={disabled || editingIndex !== null}
                    onEdit={() => editLink(index)}
                    onRemove={() =>
                      setLinks((current) =>
                        current.filter((_, linkIndex) => linkIndex !== index),
                      )
                    }
                  />
                ),
              )}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        editingIndex === null && (
          <p className="mt-4 rounded-xl border border-dashed border-black/10 px-3 py-5 text-center text-xs text-black/45 dark:border-white/10 dark:text-white/45">
            No links attached yet.
          </p>
        )
      )}
    </section>
  );
}
