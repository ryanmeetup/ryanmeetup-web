"use client";

import { useState, type ReactNode } from "react";
import { Button, toast } from "@ryanmeetup/ui";
import { FiCheck, FiCopy } from "react-icons/fi";

/**
 * Copies a value to the clipboard. Bare, it is a small icon button for one
 * line of setup material; with `children`, a labelled button for a block of
 * text such as an email draft.
 */
export function CopyButton({
  value,
  label,
  children,
}: {
  value: string;
  label: string;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(`${label} could not be copied.`);
    }
  }

  const icon = copied ? (
    <FiCheck
      aria-hidden
      className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
    />
  ) : (
    <FiCopy aria-hidden className="h-3.5 w-3.5" />
  );

  if (children)
    return (
      <Button
        type="button"
        size="xs"
        variant="secondary"
        leftIcon={icon}
        onClick={copy}
        aria-label={copied ? `${label} copied` : undefined}
      >
        {copied ? "Copied" : children}
      </Button>
    );

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className="shrink-0 rounded-md border border-black/10 bg-white/70 p-1.5 text-black/50 transition hover:border-black/30 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/15 dark:bg-white/[0.06] dark:text-white/50 dark:hover:border-white/40 dark:hover:text-white dark:focus-visible:ring-white/30"
    >
      {icon}
    </button>
  );
}
