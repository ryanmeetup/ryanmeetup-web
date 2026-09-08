"use client";

import { useRef } from "react";
import { Button } from "@ryanmeetup/ui";
import { FiPlus } from "react-icons/fi";

export function AttachmentUploadControl({
  kind,
  disabled,
  saving,
  onFiles,
}: {
  kind: "category" | "project";
  disabled: boolean;
  saving: boolean;
  onFiles: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        leftIcon={<FiPlus aria-hidden />}
        className="w-full shrink-0 !normal-case tracking-normal sm:w-auto"
        loading={saving}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        Add files
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        accept=".pdf,.txt,image/jpeg,image/png,image/webp"
        aria-label={`Upload ${kind} attachments`}
        className="sr-only"
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
    </>
  );
}
