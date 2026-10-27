"use client";

import { useSyncExternalStore } from "react";
import { Button, IconButton } from "@ryanmeetup/ui";
import { FiUpload, FiX } from "react-icons/fi";
import { rydUploadDueLabel } from "@/lib/ryd/upload-reminder";

const dismissalKey = "ryanmeetup.tasks.ryd.upload-due.dismissed.v1";
const dismissalEvent = "ryanmeetup:ryd-upload-due-dismissed";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(dismissalEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(dismissalEvent, onStoreChange);
  };
}

function readDismissed() {
  return localStorage.getItem(dismissalKey);
}

/**
 * The dismissal stores the upload day that was waved away rather than a flag,
 * so next week's reminder still appears.
 */
export function RydUploadDueNotice({
  since,
  timeZone,
  onUpload,
}: {
  since: string;
  timeZone: string;
  onUpload: () => void;
}) {
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => null);

  if (dismissed === since) return null;

  function dismiss() {
    localStorage.setItem(dismissalKey, since);
    window.dispatchEvent(new Event(dismissalEvent));
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-start gap-2">
        <FiUpload aria-hidden className="mt-0.5 shrink-0" />
        <span>
          <span className="font-semibold">It&apos;s upload day.</span> Nothing
          has been uploaded since {rydUploadDueLabel(since, timeZone)}. Check
          for fulfillment&apos;s new order file and add it here.
        </span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="flex-1 sm:flex-none"
          leftIcon={<FiUpload aria-hidden />}
          onClick={onUpload}
        >
          Upload orders
        </Button>
        <IconButton
          type="button"
          variant="subtle"
          label="Dismiss upload reminder"
          onClick={dismiss}
        >
          <FiX aria-hidden />
        </IconButton>
      </div>
    </div>
  );
}
