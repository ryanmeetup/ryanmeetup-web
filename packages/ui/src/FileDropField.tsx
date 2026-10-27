"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FiFile, FiUploadCloud } from "react-icons/fi";

// Types
import type { DragEvent, ReactNode } from "react";
import { getFieldLabelClasses } from "./fieldStyles";

export type FileDropFieldProps = {
  label: string;
  name: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Same syntax as the native attribute; also checked for dropped files. */
  accept?: string;
  required?: boolean;
  disabled?: boolean;
  /** Short note under the prompt, such as the expected format. */
  hint?: ReactNode;
  /** Shown when a dropped file does not match `accept`. */
  rejectMessage?: string;
  className?: string;
};

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
export function FileDropField({
  label,
  name,
  file,
  onFileChange,
  accept,
  required = false,
  disabled = false,
  hint,
  rejectMessage = "That file type isn't accepted here.",
  className,
}: FileDropFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState(false);

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

  // Clearing the selection from outside must clear the native input too, or
  // `required` keeps passing on a file the form no longer holds.
  useEffect(() => {
    if (!file && input.current) input.current.value = "";
  }, [file]);

  const choose = (next: File | null) => {
    setRejected(false);
    onFileChange(next);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = event.dataTransfer.files[0];
    if (!dropped) return;
    if (!fileMatchesAccept(dropped, accept)) {
      setRejected(true);
      return;
    }
    if (input.current) {
      const transfer = new DataTransfer();
      transfer.items.add(dropped);
      input.current.files = transfer.files;
    }
    choose(dropped);
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
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm text-black transition focus-within:ring-2 focus-within:ring-black/30 dark:text-white dark:focus-within:ring-white/40 ${tone} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <input
          ref={input}
          id={id}
          name={name}
          type="file"
          accept={accept}
          required={required}
          aria-required={required || undefined}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-status`}
          aria-invalid={rejected || undefined}
          disabled={disabled}
          onChange={(event) => choose(event.target.files?.[0] ?? null)}
          className="sr-only"
        />
        {file ? (
          <FiFile aria-hidden className="text-2xl" />
        ) : (
          <FiUploadCloud aria-hidden className="text-2xl" />
        )}
        <span id={`${id}-status`} className="min-w-0 max-w-full space-y-1">
          {file ? (
            <>
              <span className="block truncate font-semibold">{file.name}</span>
              <span className="block text-xs text-black/70 dark:text-white/70">
                Drop another file or click to replace it
              </span>
            </>
          ) : (
            <>
              <span className="block font-semibold">
                {dragging
                  ? "Drop it here"
                  : "Drag a file here or click to choose"}
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
              {rejectMessage}
            </span>
          )}
        </span>
      </label>
    </div>
  );
}
