"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Button,
  DisclosureCard,
  IconButton,
  Input,
  toast,
} from "@ryanmeetup/ui";
import {
  FiCheck,
  FiFile,
  FiLink,
  FiPaperclip,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import { MAX_ATTACHMENT_SIZE } from "@/lib/tasks/task-attachments";
import { attachmentUrlName } from "@/lib/tasks/task-attachment-urls";
import { CountBadge } from "@/components/global";
import { normalizeHttpUrl } from "@ryanmeetup/utils";
import { formatFileSize } from "@/lib/presentation";
import type { NewTaskDetailsDraft } from "@/lib/tasks/task-types";

export function NewTaskDetails({
  value,
  onChange,
  disabled,
}: {
  value: NewTaskDetailsDraft;
  onChange: Dispatch<SetStateAction<NewTaskDetailsDraft>>;
  disabled: boolean;
}) {
  const [checklistTitle, setChecklistTitle] = useState("");
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  function addChecklistItem() {
    const title = checklistTitle.trim();
    if (!title) return;
    onChange((current) => ({
      ...current,
      checklist: [
        ...current.checklist,
        { id: crypto.randomUUID(), title, completed: false },
      ],
    }));
    setChecklistTitle("");
  }

  function addFiles(files: File[]) {
    const accepted = files.filter((file) => {
      if (file.size > 0 && file.size <= MAX_ATTACHMENT_SIZE) return true;
      toast.error(`${file.name} must be between 1 byte and 10 MB.`);
      return false;
    });
    onChange((current) => ({
      ...current,
      files: [...current.files, ...accepted],
    }));
  }

  useEffect(() => {
    if (disabled) return;

    const handlePaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.items ?? []).flatMap(
        (item) => {
          if (item.kind !== "file") return [];
          const file = item.getAsFile();
          return file ? [file] : [];
        },
      );

      if (files.length === 0) return;
      event.preventDefault();
      addFiles(files);
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  });

  function addUrl() {
    const url = normalizeHttpUrl(attachmentUrl);
    if (!url) {
      toast.error("Enter a valid web address.");
      return;
    }
    if (value.urls.some((item) => item.url === url)) {
      toast.error("That URL is already attached.");
      return;
    }
    onChange((current) => ({
      ...current,
      urls: [...current.urls, { id: crypto.randomUUID(), url }],
    }));
    setAttachmentUrl("");
  }

  return (
    <div className="space-y-6">
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
            <CountBadge>{value.checklist.length}</CountBadge>
          </span>
        }
      >
        {value.checklist.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <button
              type="button"
              role="checkbox"
              aria-checked={item.completed}
              disabled={disabled}
              onClick={() =>
                onChange((current) => ({
                  ...current,
                  checklist: current.checklist.map((candidate) =>
                    candidate.id === item.id
                      ? { ...candidate, completed: !candidate.completed }
                      : candidate,
                  ),
                }))
              }
              className="group flex min-w-0 flex-1 items-center gap-2 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed"
            >
              <span
                aria-hidden
                className={`grid h-5 w-5 shrink-0 place-items-center rounded border transition ${item.completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-black/20 group-hover:border-black/40 dark:border-white/25 dark:group-hover:border-white/50"}`}
              >
                {item.completed && <FiCheck aria-hidden />}
              </span>
              <span
                className={`min-w-0 flex-1 text-sm ${item.completed ? "text-black/45 line-through dark:text-white/45" : ""}`}
              >
                {item.title}
              </span>
            </button>
            <IconButton
              type="button"
              label={`Remove “${item.title}”`}
              variant="danger"
              disabled={disabled}
              onClick={() =>
                onChange((current) => ({
                  ...current,
                  checklist: current.checklist.filter(
                    (candidate) => candidate.id !== item.id,
                  ),
                }))
              }
            >
              <FiTrash2 />
            </IconButton>
          </div>
        ))}
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Input
            label="Checklist item"
            name="new-task-checklist-item"
            hideLabel
            value={checklistTitle}
            placeholder="Add a checklist item..."
            disabled={disabled}
            onChange={(event) => setChecklistTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              addChecklistItem();
            }}
          />
          <Button
            type="button"
            variant="action"
            size="field"
            leftIcon={<FiPlus aria-hidden />}
            disabled={disabled || !checklistTitle.trim()}
            onClick={addChecklistItem}
          >
            Add
          </Button>
        </div>
      </DisclosureCard>

      <section className="space-y-3 border-t border-black/10 pt-5 dark:border-white/10">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
          <FiPaperclip aria-hidden /> Attachments
          {value.files.length + value.urls.length > 0 && (
            <CountBadge>{value.files.length + value.urls.length}</CountBadge>
          )}
        </h3>
        {value.files.map((file, index) => (
          <div
            key={`${file.name}-${file.size}-${index}`}
            className="flex items-center gap-3 rounded-xl border border-black/10 p-2 dark:border-white/10"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-black/5 text-black/55 dark:bg-white/5 dark:text-white/55">
              <FiFile aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{file.name}</p>
              <p className="text-xs text-black/50 dark:text-white/50">
                {formatFileSize(file.size)}
              </p>
            </div>
            <IconButton
              type="button"
              label={`Remove “${file.name}”`}
              variant="danger"
              disabled={disabled}
              onClick={() =>
                onChange((current) => ({
                  ...current,
                  files: current.files.filter(
                    (_, fileIndex) => fileIndex !== index,
                  ),
                }))
              }
            >
              <FiTrash2 />
            </IconButton>
          </div>
        ))}
        {value.urls.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-black/10 p-2 dark:border-white/10"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-black/5 text-black/55 dark:bg-white/5 dark:text-white/55">
              <FiLink aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {attachmentUrlName(item.url)}
              </p>
              <p className="truncate text-xs text-black/50 dark:text-white/50">
                {item.url}
              </p>
            </div>
            <IconButton
              type="button"
              label={`Remove “${item.url}”`}
              variant="danger"
              disabled={disabled}
              onClick={() =>
                onChange((current) => ({
                  ...current,
                  urls: current.urls.filter(
                    (candidate) => candidate.id !== item.id,
                  ),
                }))
              }
            >
              <FiTrash2 />
            </IconButton>
          </div>
        ))}
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Input
            label="Attachment URL"
            name="new-task-attachment-url"
            type="url"
            value={attachmentUrl}
            placeholder="https://example.com/resource"
            disabled={disabled}
            onChange={(event) => setAttachmentUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              addUrl();
            }}
          />
          <Button
            type="button"
            variant="action"
            size="field"
            leftIcon={<FiLink aria-hidden />}
            disabled={disabled || !attachmentUrl.trim()}
            onClick={addUrl}
          >
            Add URL
          </Button>
        </div>
        <div
          className={`rounded-xl border border-dashed p-4 text-center transition duration-200 ease-in-out ${draggingFiles ? "border-black/50 bg-black/5 ring-2 ring-black/10 dark:border-white/60 dark:bg-white/10 dark:ring-white/15" : "border-black/20 bg-black/[0.02] dark:border-white/20 dark:bg-white/[0.03]"}`}
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
            const target = event.relatedTarget;
            if (
              !(target instanceof Node) ||
              !event.currentTarget.contains(target)
            )
              setDraggingFiles(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDraggingFiles(false);
            addFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <FiPaperclip className="mx-auto mb-2 h-5 w-5 text-black/45 dark:text-white/45" />
          <p className="text-sm font-semibold">Drop files here</p>
          <p className="mt-1 text-xs text-black/50 dark:text-white/50">
            Paste, drop, or choose files · 10 MB maximum per file
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            disabled={disabled}
            onClick={() => fileInput.current?.click()}
          >
            Choose files
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          aria-label="Add files to the new task"
          accept=".pdf,.txt,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </section>
    </div>
  );
}
