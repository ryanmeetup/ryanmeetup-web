"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  Button,
  DisclosureCard,
  IconButton,
  Input,
  Tooltip,
} from "@ryanmeetup/ui";
import {
  FiExternalLink,
  FiFile,
  FiLink,
  FiPaperclip,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { CountBadge } from "@/components/global";
import { SkeletonBar } from "@/components/global/SkeletonBar";
import { formatFileSize, formatMimeSubtype } from "@/lib/presentation";
import type { TaskAttachment } from "@/lib/tasks/task-types";

/** Mirrors an attachment's thumbnail, name, and details while they load. */
function TaskAttachmentSkeletons() {
  return ["w-1/2", "w-2/5"].map((width) => (
    <div
      key={width}
      aria-hidden="true"
      data-task-attachment-skeleton=""
      className="flex items-center gap-3 rounded-xl border border-black/10 p-2 dark:border-white/10"
    >
      <SkeletonBar className="h-12 w-12 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBar className={`h-4 ${width}`} />
        <SkeletonBar className="h-3 w-20" />
      </div>
    </div>
  ));
}

export function TaskAttachmentsPanel({
  addingUrl,
  attachmentUrl,
  attachments: loadedAttachments,
  loading,
  onAddUrl,
  onAttachmentUrlChange,
  onRemove,
  onUploadFiles,
  previewAttachment,
  setPreviewAttachment,
  taskId,
  uploadingFiles,
}: {
  addingUrl: boolean;
  attachmentUrl: string;
  attachments: TaskAttachment[];
  /** The task's attachments are being fetched, so any held here may be stale. */
  loading: boolean;
  onAddUrl: () => void;
  onAttachmentUrlChange: (value: string) => void;
  onRemove: (item: TaskAttachment) => void;
  onUploadFiles: (files: File[]) => void;
  previewAttachment: TaskAttachment | null;
  setPreviewAttachment: (item: TaskAttachment | null) => void;
  taskId: string;
  uploadingFiles: boolean;
}) {
  const [draggingFiles, setDraggingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setAttachmentUrl = onAttachmentUrlChange;
  const attachments = loading ? [] : loadedAttachments;
  return (
    <DisclosureCard
      defaultOpen
      className=""
      buttonClassName="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/25 dark:focus-visible:ring-white/30"
      panelClassName="space-y-3 pt-3"
      iconClassName="h-3.5 w-3.5"
      summary={
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
          <FiPaperclip aria-hidden /> Attachments
          {!loading && <CountBadge>{attachments.length}</CountBadge>}
        </span>
      }
    >
      {previewAttachment && (
        <div className="overflow-hidden rounded-xl border border-black/10 bg-black/[0.025] dark:border-white/10 dark:bg-white/[0.035]">
          <div className="relative aspect-[4/3] w-full bg-black/5 dark:bg-black/30">
            <Image
              src={previewAttachment.url}
              alt={`Preview of ${previewAttachment.name}`}
              fill
              unoptimized
              sizes="(min-width: 1024px) 40vw, 90vw"
              className="object-contain"
            />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-black/10 px-3 py-2 dark:border-white/10">
            <p className="min-w-0 truncate text-sm font-semibold">
              {previewAttachment.name}
            </p>
            <div className="flex shrink-0 gap-1">
              <Tooltip content="Open original">
                <a
                  href={previewAttachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${previewAttachment.name} in a new tab`}
                  className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:hover:bg-white/10 dark:focus-visible:ring-white/30"
                >
                  <FiExternalLink aria-hidden />
                </a>
              </Tooltip>
              <IconButton
                label="Close attachment preview"
                onClick={() => setPreviewAttachment(null)}
              >
                <FiX />
              </IconButton>
            </div>
          </div>
        </div>
      )}
      {loading && (
        <>
          <span className="sr-only" role="status">
            Loading attachments
          </span>
          <TaskAttachmentSkeletons />
        </>
      )}
      {attachments.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-xl border border-black/10 p-2 dark:border-white/10"
        >
          {item.mime_type?.startsWith("image/") && item.url !== "#" ? (
            <button
              type="button"
              aria-label={`Preview ${item.name}`}
              aria-pressed={previewAttachment?.id === item.id}
              onClick={() => setPreviewAttachment(item)}
              className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:bg-white/5 dark:focus-visible:ring-white/30"
            >
              <Image
                src={item.url}
                alt=""
                fill
                unoptimized
                sizes="48px"
                className="object-cover"
              />
            </button>
          ) : item.file_path === null && item.url !== "#" ? (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-black/5 text-black/55 dark:bg-white/5 dark:text-white/55">
              <FiLink aria-hidden />
            </span>
          ) : (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-black/5 text-black/55 dark:bg-white/5 dark:text-white/55">
              <FiFile aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{item.name}</p>
            <p className="mt-0.5 truncate text-xs text-black/50 dark:text-white/50">
              {[
                formatMimeSubtype(item.mime_type),
                formatFileSize(item.size_bytes),
              ]
                .filter(Boolean)
                .join(" · ") || "Attachment"}
            </p>
          </div>
          <Tooltip content="Open in new tab">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${item.name} in a new tab`}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:hover:bg-white/10 dark:focus-visible:ring-white/30"
            >
              <FiExternalLink aria-hidden />
            </a>
          </Tooltip>
          <IconButton
            label={`Remove “${item.name}”`}
            variant="danger"
            onClick={() => void onRemove(item)}
          >
            <FiTrash2 />
          </IconButton>
        </div>
      ))}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Input
          label="Attachment URL"
          name={`task-${taskId}-attachment-url`}
          type="url"
          value={attachmentUrl}
          placeholder="https://example.com/resource"
          disabled={addingUrl}
          onChange={(event) => setAttachmentUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            void onAddUrl();
          }}
        />
        <Button
          type="button"
          variant="action"
          size="field"
          leftIcon={<FiLink aria-hidden />}
          disabled={!attachmentUrl.trim()}
          loading={addingUrl}
          loadingText="Adding..."
          className="w-full sm:w-auto"
          onClick={() => void onAddUrl()}
        >
          Add URL
        </Button>
      </div>
      <div
        className={`rounded-xl border border-dashed p-3 text-center transition duration-200 ease-in-out sm:p-4 ${
          draggingFiles
            ? "border-black/50 bg-black/5 ring-2 ring-black/10 dark:border-white/60 dark:bg-white/10 dark:ring-white/15"
            : "border-black/20 bg-black/[0.02] dark:border-white/20 dark:bg-white/[0.03]"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (event.dataTransfer.types.includes("Files"))
            setDraggingFiles(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          const nextTarget = event.relatedTarget;
          if (
            !(nextTarget instanceof Node) ||
            !event.currentTarget.contains(nextTarget)
          ) {
            setDraggingFiles(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDraggingFiles(false);
          void onUploadFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <FiPaperclip className="mx-auto mb-1.5 h-5 w-5 text-black/45 dark:text-white/45 sm:mb-2" />
        <p className="text-sm font-semibold">
          <span className="sm:hidden">Add files</span>
          <span className="hidden sm:inline">Drop files here</span>
        </p>
        <p className="mt-1 text-xs text-black/50 dark:text-white/50">
          <span className="sm:hidden">Choose files · 10 MB maximum each</span>
          <span className="hidden sm:inline">
            Paste, drop, or choose files · 10 MB maximum per file
          </span>
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-3 w-full sm:w-auto"
          loading={uploadingFiles}
          loadingText="Uploading..."
          onClick={() => fileInputRef.current?.click()}
        >
          Choose files
        </Button>
        <input
          ref={fileInputRef}
          aria-label="Upload task attachments"
          type="file"
          multiple
          accept=".pdf,.txt,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            void onUploadFiles(files);
            event.target.value = "";
          }}
        />
      </div>
    </DisclosureCard>
  );
}
