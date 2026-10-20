"use client";

import clsx from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import { FiCheck, FiCopy } from "react-icons/fi";
import { toast } from "./Toast";

export type CopyTextProps = {
  /** What lands on the clipboard. */
  value: string;
  /** Names the value for assistive tech, e.g. "order number". */
  label: string;
  /** What shows; defaults to the value. */
  children?: ReactNode;
  className?: string;
};

/**
 * A value that copies itself when clicked. The copy icon sits beside the text
 * and turns into a check for a moment once the value is on the clipboard.
 */
export function CopyText({ value, label, children, className }: CopyTextProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast.error(`The ${label} could not be copied.`);
    }
  }

  const Icon = copied ? FiCheck : FiCopy;
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label} ${value}`}
      title={copied ? "Copied" : `Copy ${label}`}
      className={clsx(
        "group inline-flex max-w-full items-center gap-1.5 rounded text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40",
        className,
      )}
    >
      <span className="min-w-0 truncate">{children ?? value}</span>
      <Icon
        aria-hidden
        className={clsx(
          "h-3.5 w-3.5 shrink-0 transition",
          copied
            ? "text-emerald-600 dark:text-emerald-400"
            : "opacity-50 group-hover:opacity-100 group-focus-visible:opacity-100",
        )}
      />
      <span className="sr-only" aria-live="polite">
        {copied ? `${label} copied` : ""}
      </span>
    </button>
  );
}
