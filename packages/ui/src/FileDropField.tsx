"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FiFile, FiUploadCloud } from "react-icons/fi";

// Types
import type { DragEvent, ReactNode } from "react";
import { getFieldLabelClasses } from "./fieldStyles";

type FileDropFieldBaseProps = {
  label: string;
  name: string;
  /** Same syntax as the native attribute; also checked for dropped files. */
  accept?: string;
  required?: boolean;
  disabled?: boolean;
  /** Short note under the prompt, such as the expected format. */
  hint?: ReactNode;
  /** Shown when a dropped file does not match `accept`. */
  rejectMessage?: string;
  /** Checked for both picker selections and dropped files. */
  maxFileSize?: number;
  maxFiles?: number;
  compact?: boolean;
  className?: string;
};

export type FileDropFieldProps = FileDropFieldBaseProps & (
  | { multiple?: false; file: File | null; onFileChange: (file: File | null) => void }
  | { multiple: true; files: File[]; onFilesChange: (files: File[]) => void }
);

/** Whether a file satisfies an `accept` list of extensions and MIME types. */
export function fileMatchesAccept(file: File, accept?: string) {
  if (!accept?.trim()) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .some((token) => {
      if (token.startsWith(".")) return name.endsWith(token);
      if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
      return type === token;
    });
}

const hasFiles = (event: DragEvent) =>
  Array.from(event.dataTransfer.types).includes("Files");

/**
 * A file picker that also takes a drag and drop. The native input stays
 * underneath so keyboard users get the OS picker and `required` still gates
 * the form; a dropped file is written back into it.
 */
export function FileDropField(props: FileDropFieldProps) {
  const {
    label,
    name,
    accept,
    required = false,
    disabled = false,
    hint,
    rejectMessage = "That file type isn't accepted here.",
    maxFileSize,
    maxFiles,
    compact = false,
    className,
  } = props;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState("");
  const fileSelection = props.multiple ? props.files : props.file;
  const selected = Array.isArray(fileSelection) ? fileSelection : fileSelection ? [fileSelection] : [];

  // A drop that misses the zone would otherwise open the file in the tab and
  // throw away whatever the page was holding.
  useEffect(() => {
    const ignore = (event: globalThis.DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    window.addEventListener("dragover", ignore);
    window.addEventListener("drop", ignore);
    return () => {
      window.removeEventListener("dragover", ignore);
      window.removeEventListener("drop", ignore);
    };
  }, []);

  // Keep the native required state in sync, including additions/removals made
  // outside the picker. Replaced/prepared files must also reach native forms.
  useEffect(() => {
    if (!input.current) return;
    const transfer = new DataTransfer();
    const files = Array.isArray(fileSelection) ? fileSelection : fileSelection ? [fileSelection] : [];
    files.forEach((file) => transfer.items.add(file));
    input.current.files = transfer.files;
  }, [fileSelection]);

  const choose = (incoming: File[]) => {
    if (!incoming.length || disabled) return;
    const next = props.multiple ? [...props.files, ...incoming] : incoming.slice(0, 1);
    const invalidType = incoming.some((file) => !fileMatchesAccept(file, accept));
    const tooLarge = maxFileSize !== undefined && incoming.some((file) => file.size > maxFileSize);
    const tooMany = maxFiles !== undefined && next.length > maxFiles;
    const error = invalidType ? rejectMessage
      : tooLarge ? `Each file must be ${Math.round(maxFileSize! / 1024 / 1024)} MB or smaller.`
      : tooMany ? `Choose up to ${maxFiles} files.` : "";
    setRejected(error);
    const transfer = new DataTransfer();
    (error ? selected : next).forEach((file) => transfer.items.add(file));
    if (input.current) input.current.files = transfer.files;
    if (error) return;
    if (props.multiple) props.onFilesChange(next);
    else props.onFileChange(next[0] ?? null);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    choose(Array.from(event.dataTransfer.files));
  };

  const tone = rejected
    ? "border-red-500 bg-red-500/5 dark:border-red-400"
    : dragging
      ? "border-black/60 bg-black/[0.06] dark:border-white/60 dark:bg-white/10"
      : "border-black/20 bg-white hover:border-black/40 hover:bg-black/[0.03] dark:border-white/20 dark:bg-white/[0.04] dark:hover:border-white/40 dark:hover:bg-white/[0.07]";

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <span className={getFieldLabelClasses()} id={`${id}-label`}>
        <span>{label}</span>
        {required && <span className="shrink-0 text-red-500">*</span>}
      </span>
      <label
        htmlFor={id}
        onDragEnter={(event) => {
          if (!hasFiles(event) || disabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          if (!hasFiles(event) || disabled) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null))
            return;
          setDragging(false);
        }}
        onDrop={onDrop}
        className={`flex items-center rounded-xl border-2 border-dashed px-4 text-sm text-black transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-black/30 dark:text-white dark:has-[:focus-visible]:ring-white/40 ${compact ? "gap-3 py-3 text-left" : "flex-col gap-2 py-6 text-center"} ${tone} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <input
          ref={input}
          id={id}
          name={name}
          type="file"
          accept={accept}
          multiple={props.multiple}
          required={required}
          aria-required={required || undefined}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-status`}
          aria-invalid={Boolean(rejected) || undefined}
          disabled={disabled}
          onChange={(event) => choose(Array.from(event.target.files ?? []))}
          className="sr-only"
        />
        {selected.length ? (
          <FiFile aria-hidden className="text-2xl" />
        ) : (
          <FiUploadCloud aria-hidden className="text-2xl" />
        )}
        <span id={`${id}-status`} className="min-w-0 max-w-full space-y-1">
          {selected.length ? (
            <>
              <span className="block truncate font-semibold">{props.multiple ? `${selected.length} file${selected.length === 1 ? "" : "s"} selected` : selected[0].name}</span>
              <span className="block text-xs text-black/70 dark:text-white/70">
                {props.multiple ? "Drop more here or click to add" : "Drop another file or click to replace it"}
              </span>
            </>
          ) : (
            <>
              <span className="block font-semibold">
                {dragging
                  ? "Drop it here"
                  : props.multiple ? "Drag files here or click to choose" : "Drag a file here or click to choose"}
              </span>
              {hint && (
                <span className="block text-xs text-black/70 dark:text-white/70">
                  {hint}
                </span>
              )}
            </>
          )}
          {rejected && (
            <span
              role="alert"
              className="block text-xs font-semibold text-red-600 dark:text-red-400"
            >
              {rejected}
            </span>
          )}
        </span>
      </label>
    </div>
  );
}
