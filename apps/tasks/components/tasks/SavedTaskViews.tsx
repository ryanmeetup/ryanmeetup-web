"use client";

import { useState, type FormEvent } from "react";
import {
  Button,
  DropdownSelect,
  IconButton,
  Input,
  Modal,
  ModalActions,
  Pill,
  Text,
} from "@ryanmeetup/ui";
import { FiBookmark, FiEdit2, FiSettings, FiTrash2 } from "react-icons/fi";
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
  const { views, selected, modified, pending, available, error, setError } =
    controller;
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
  return (
    <section aria-label="Saved task views" className="mb-3 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <DropdownSelect
          label="Views"
          variant="compact"
          className="w-full sm:w-auto sm:max-w-sm"
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
          stackLabelOnMobile
        />
        {modified && (
          <Pill
            variant="neutral"
            size="sm"
            className="self-start sm:self-center"
          >
            Modified
          </Pill>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {modified && selected && (
            <>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending || !available}
                loading={pending}
                onClick={() =>
                  void controller.save(
                    selected.name,
                    controller.snapshot(),
                    selected,
                  )
                }
              >
                Update view
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => controller.select(selected)}
              >
                Reset changes
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 sm:flex-none"
            leftIcon={<FiBookmark aria-hidden />}
            disabled={!available || pending}
            onClick={() =>
              open({ kind: "save", settings: controller.snapshot() })
            }
          >
            {selected ? "Save as new" : "Save view"}
          </Button>
          <IconButton
            label="Manage saved views"
            disabled={!available || pending || views.length === 0}
            onClick={() => open({ kind: "manage" })}
          >
            <FiSettings aria-hidden />
          </IconButton>
        </div>
      </div>
      {!available && (
        <Text className="text-sm">Saved views are currently unavailable.</Text>
      )}
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
