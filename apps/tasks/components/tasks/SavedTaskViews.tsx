"use client";

import { useState, type FormEvent } from "react";
import {
  Button,
  DropdownSelect,
  DropdownMenu,
  DropdownMenuButton,
  DropdownMenuItem,
  DropdownMenuItems,
  getIconButtonClasses,
  IconButton,
  Input,
  Modal,
  ModalActions,
  Pill,
  Text,
  Tooltip,
} from "@ryanmeetup/ui";
import {
  FiBookmark,
  FiEdit2,
  FiMoreHorizontal,
  FiRefreshCw,
  FiRotateCcw,
  FiSettings,
  FiTrash2,
} from "react-icons/fi";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import {
  savedViewNameMaxLength,
  savedViewSortLabels,
  savedViewSummary,
  savedViewUnavailable,
  type SavedTaskView,
  type SavedTaskViewSettings,
} from "@/lib/tasks/saved-task-views";
import type { SavedTaskViewsController } from "./useSavedTaskViews";

type Dialog =
  | { kind: "save"; settings: SavedTaskViewSettings }
  | { kind: "manage" }
  | { kind: "rename" | "delete"; view: SavedTaskView };
const formId = "saved-task-view-form";

export function SavedTaskViews({
  controller,
  data,
}: {
  controller: SavedTaskViewsController;
  data: WorkspaceData;
}) {
  const {
    views,
    selected,
    modified,
    pending,
    available,
    unavailableReason,
    error,
    setError,
  } = controller;
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [name, setName] = useState("");
  function open(next: Dialog) {
    setError(null);
    setName(next.kind === "rename" ? next.view.name : "");
    setDialog(next);
  }
  function close() {
    if (pending) return;
    setError(null);
    setDialog(null);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (dialog?.kind !== "save" && dialog?.kind !== "rename") return;
    const saved =
      dialog.kind === "save"
        ? await controller.save(name, dialog.settings)
        : await controller.save(name, dialog.view.settings, dialog.view, true);
    if (saved) setDialog(dialog.kind === "rename" ? { kind: "manage" } : null);
  }
  const summarySettings = dialog?.kind === "save" ? dialog.settings : null;
  const availability = unavailableReason
    ? {
        "access-preview": {
          label: "Preview only",
          description: "Exit access preview to use your personal saved views.",
        },
        "workspace-setup": {
          label: "Setup needed",
          description:
            "Saved views haven't been set up for this workspace yet. Ask an app owner to finish setup, then retry.",
        },
        "browser-storage": {
          label: "Storage blocked",
          description:
            "This browser couldn't load your demo saved views. Allow browser storage, then retry.",
        },
        loading: {
          label: "Loading…",
          description: "Loading your saved views.",
        },
      }[unavailableReason]
    : null;
  return (
    <section aria-label="Saved task views" className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <DropdownSelect
          label="Views"
          variant="compact"
          className="h-8 w-full min-w-0 disabled:!opacity-60 sm:w-auto sm:max-w-xs"
          value={selected?.id ?? "__current"}
          options={[
            { value: "__current", label: "Unsaved view" },
            { value: "", label: "All tasks" },
            ...views.map((view) => ({ value: view.id, label: view.name })),
          ]}
          onChange={(id) => {
            if (id !== "__current")
              controller.select(views.find((view) => view.id === id) ?? null);
          }}
          disabled={!available || pending}
          active={Boolean(selected)}
        />
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {modified && (
            <Pill variant="neutral" size="sm">
              Modified
            </Pill>
          )}
          <Button
            variant="filter"
            className="flex-1 sm:flex-none"
            leftIcon={modified ? undefined : <FiBookmark aria-hidden />}
            disabled={!available || pending}
            loading={pending}
            onClick={() => {
              if (modified && selected) {
                void controller.save(
                  selected.name,
                  controller.snapshot(),
                  selected,
                );
              } else {
                open({ kind: "save", settings: controller.snapshot() });
              }
            }}
          >
            {modified && selected
              ? "Update view"
              : selected
                ? "Save as new"
                : "Save view"}
          </Button>
          <DropdownMenu>
            <DropdownMenuButton
              unstyled
              aria-label="Saved view actions"
              className={getIconButtonClasses("sm", "filter")}
              disabled={!available || pending || views.length === 0}
            >
              <FiMoreHorizontal aria-hidden />
            </DropdownMenuButton>
            <DropdownMenuItems>
              {modified && selected && (
                <>
                  <DropdownMenuItem onClick={() => controller.select(selected)}>
                    <FiRotateCcw aria-hidden /> Reset changes
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      open({ kind: "save", settings: controller.snapshot() })
                    }
                  >
                    <FiBookmark aria-hidden /> Save as new
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => open({ kind: "manage" })}>
                <FiSettings aria-hidden /> Manage saved views
              </DropdownMenuItem>
            </DropdownMenuItems>
          </DropdownMenu>
          {availability && (
            <Tooltip content={availability.description}>
              <span
                tabIndex={0}
                className="rounded text-xs text-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:text-white/70 dark:focus-visible:ring-white/30"
              >
                {availability.label}
              </span>
            </Tooltip>
          )}
          {(unavailableReason === "workspace-setup" ||
            unavailableReason === "browser-storage") && (
            <IconButton
              label="Retry saved views"
              variant="filter"
              onClick={() => window.location.reload()}
            >
              <FiRefreshCw aria-hidden />
            </IconButton>
          )}
        </div>
      </div>
      {error && !dialog && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <Modal
        open={Boolean(dialog)}
        setIsOpen={(next) => {
          if (!next) close();
        }}
        closable={!pending}
        title={
          dialog?.kind === "manage"
            ? "Saved views"
            : dialog?.kind === "rename"
              ? "Rename view"
              : dialog?.kind === "delete"
                ? "Delete view"
                : "Save view"
        }
        description={
          dialog?.kind === "save"
            ? "Save these filters and layout to your account. Text searches are left out."
            : dialog?.kind === "manage"
              ? `${views.length} personal ${views.length === 1 ? "view" : "views"}.`
              : undefined
        }
        actions={
          dialog?.kind === "manage" ? (
            <Button size="sm" onClick={close}>
              Done
            </Button>
          ) : (
            <ModalActions
              onCancel={close}
              confirmLabel={
                dialog?.kind === "delete"
                  ? "Delete view"
                  : dialog?.kind === "rename"
                    ? "Save name"
                    : "Save view"
              }
              confirmForm={dialog?.kind === "delete" ? undefined : formId}
              onConfirm={
                dialog?.kind === "delete"
                  ? async () => {
                      if (await controller.remove(dialog.view))
                        setDialog({ kind: "manage" });
                    }
                  : undefined
              }
              destructive={dialog?.kind === "delete"}
              pending={pending}
              confirmDisabled={dialog?.kind !== "delete" && !name.trim()}
            />
          )
        }
      >
        <div className="space-y-4">
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          {(dialog?.kind === "save" || dialog?.kind === "rename") && (
            <form id={formId} onSubmit={submit}>
              <Input
                label="View name"
                name="saved-view-name"
                required
                autoFocus
                maxLength={savedViewNameMaxLength}
                value={name}
                disabled={pending}
                onChange={(event) => setName(event.target.value)}
                placeholder="Life improvements"
              />
            </form>
          )}
          {summarySettings && (
            <div className="space-y-3">
              <Text className="text-sm">
                {summarySettings.view === "board" ? "Board" : "List"} ·{" "}
                {summarySettings.visibility === "active"
                  ? "Active tasks"
                  : "Archived tasks"}
                {summarySettings.view === "list"
                  ? ` · ${savedViewSortLabels[summarySettings.sort]}`
                  : ""}
              </Text>
              <dl className="space-y-3 text-sm text-black dark:text-white">
                {savedViewSummary(summarySettings, data).map((row) => (
                  <div key={row.label}>
                    <dt className="font-semibold">{row.label}</dt>
                    <dd className="break-words text-black/70 dark:text-white/70">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {savedViewSummary(summarySettings, data).length === 0 && (
                <Text className="text-sm">
                  All tasks, with no filter exclusions.
                </Text>
              )}
            </div>
          )}
          {dialog?.kind === "manage" &&
            (views.length ? (
              <ul className="divide-y divide-black/10 dark:divide-white/10">
                {views.map((view) => (
                  <li
                    key={view.id}
                    className="flex items-center gap-3 py-3 first:pt-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-black dark:text-white">
                        {view.name}
                      </p>
                      <p className="text-sm text-black/70 dark:text-white/70">
                        {savedViewUnavailable(view.settings, data)
                          ? "Some saved selections are unavailable."
                          : `${view.settings.view === "board" ? "Board" : "List"} · ${view.settings.visibility === "active" ? "Active tasks" : "Archived tasks"}`}
                      </p>
                    </div>
                    <IconButton
                      label={`Rename ${view.name}`}
                      onClick={() => open({ kind: "rename", view })}
                    >
                      <FiEdit2 aria-hidden />
                    </IconButton>
                    <IconButton
                      label={`Delete ${view.name}`}
                      onClick={() => open({ kind: "delete", view })}
                    >
                      <FiTrash2 aria-hidden />
                    </IconButton>
                  </li>
                ))}
              </ul>
            ) : (
              <Text className="text-sm">
                No saved views yet. Set your filters and choose Save view.
              </Text>
            ))}
          {dialog?.kind === "delete" && (
            <Text>
              Delete “{dialog.view.name}”? Your tasks and current filters will
              stay as they are.
            </Text>
          )}
        </div>
      </Modal>
    </section>
  );
}
