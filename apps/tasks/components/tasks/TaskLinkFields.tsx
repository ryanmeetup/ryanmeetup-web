"use client";

import type { KeyboardEvent } from "react";
import { Button, Input } from "@ryanmeetup/ui";
import { FiLink } from "react-icons/fi";
import { TASK_LINK_TITLE_MAX_LENGTH } from "@/lib/tasks/task-attachment-urls";

export function TaskLinkFields({
  url,
  title,
  namePrefix,
  disabled = false,
  adding = false,
  onUrlChange,
  onTitleChange,
  onAdd,
}: {
  url: string;
  title: string;
  namePrefix: string;
  disabled?: boolean;
  adding?: boolean;
  onUrlChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onAdd: () => void;
}) {
  function addOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!disabled && !adding && url.trim()) onAdd();
  }

  // These fields compose an attachment with Add URL; they do not make the
  // surrounding task form require an attachment when it is submitted.
  return (
    <div className="space-y-3">
      <Input
        label="Link title"
        name={`${namePrefix}-title`}
        value={title}
        maxLength={TASK_LINK_TITLE_MAX_LENGTH}
        placeholder="Project brief"
        disabled={disabled || adding}
        onChange={(event) => onTitleChange(event.target.value)}
        onKeyDown={addOnEnter}
      />
      <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-end">
        <Input
          label="Attachment URL"
          name={`${namePrefix}-url`}
          type="url"
          value={url}
          placeholder="https://example.com/resource"
          disabled={disabled || adding}
          onChange={(event) => onUrlChange(event.target.value)}
          onKeyDown={addOnEnter}
        />
        <Button
          type="button"
          variant="action"
          size="field"
          leftIcon={<FiLink aria-hidden />}
          disabled={disabled || !url.trim()}
          loading={adding}
          loadingText="Adding..."
          className="w-full sm:w-auto sm:justify-self-start"
          onClick={onAdd}
        >
          Add URL
        </Button>
      </div>
    </div>
  );
}
