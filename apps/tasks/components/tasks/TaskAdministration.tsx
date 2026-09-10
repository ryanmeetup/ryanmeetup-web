"use client";

import { useState } from "react";
import {
  Button,
  ConfirmationDialog,
  DropdownSelect,
  IconButton,
  Input,
  Pill,
  Textarea,
  Tooltip,
  toast,
} from "@ryanmeetup/ui";
import {
  FiChevronDown,
  FiEdit2,
  FiMessageSquare,
  FiTrash2,
} from "react-icons/fi";
import {
  statusOutcome,
  statusOutcomeOptions,
  type StatusOutcome,
} from "@/lib/tasks/status-outcome";
import type { Status } from "@/lib/tasks/task-types";
import { errorMessage } from "@/lib/presentation";
import { mutate } from "@/lib/mutation-client";

/**
 * Owner-only status management, rendered as a page section at /admin/statuses.
 * The list is the whole page: adding a status happens in `StatusCreateModal`,
 * opened from the page header.
 */
export function StatusSettings({
  statuses,
  onStatusesChange,
  onStatusOutcomeChange,
  demoMode,
}: {
  statuses: Status[];
  onStatusesChange: (update: (current: Status[]) => Status[]) => void;
  onStatusOutcomeChange: (id: string, outcome: StatusOutcome) => void;
  demoMode: boolean;
}) {
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingStatusName, setEditingStatusName] = useState("");
  const [editingStatusDescription, setEditingStatusDescription] = useState("");
  const [editingStatusColor, setEditingStatusColor] = useState("#ee1a25");
  const [statusToDelete, setStatusToDelete] = useState<Status | null>(null);
  const [settingActionPending, setSettingActionPending] = useState(false);

  async function statusRequest<T>(
    method: "PATCH" | "DELETE",
    body: Record<string, unknown>,
  ) {
    return mutate<T>("/api/statuses", {
      method,
      body: JSON.stringify(body),
    });
  }

  function beginEdit(item: Status) {
    setEditingStatusId(item.id);
    setEditingStatusName(item.name);
    setEditingStatusDescription(item.description ?? "");
    setEditingStatusColor(item.color);
  }

  function cancelEdit() {
    setEditingStatusId(null);
    setEditingStatusName("");
    setEditingStatusDescription("");
  }

  /** Saves only the fields the owner actually changed. */
  async function saveSetting(current: Status) {
    const nextName = editingStatusName.trim();
    if (!nextName || settingActionPending) return;
    const nextDescription = editingStatusDescription.trim() || null;
    const changes = {
      ...(nextName !== current.name ? { name: nextName } : {}),
      ...(nextDescription !== (current.description ?? null)
        ? { description: nextDescription }
        : {}),
      ...(editingStatusColor !== current.color
        ? { color: editingStatusColor }
        : {}),
    };
    if (Object.keys(changes).length === 0) {
      cancelEdit();
      return;
    }
    setSettingActionPending(true);
    try {
      if (!demoMode) {
        await statusRequest("PATCH", { id: current.id, ...changes });
      }
      onStatusesChange((statuses) =>
        statuses.map((item) =>
          item.id === current.id
            ? {
                ...item,
                name: nextName,
                description: nextDescription,
                color: editingStatusColor,
              }
            : item,
        ),
      );
      cancelEdit();
      toast.success(`${nextName} updated.`);
    } catch (error) {
      toast.error(errorMessage(error, "The status could not be saved."));
    } finally {
      setSettingActionPending(false);
    }
  }

  async function deleteSetting(id: string) {
    setSettingActionPending(true);
    try {
      if (!demoMode) await statusRequest("DELETE", { id });
      onStatusesChange((current) =>
        current.filter((item) => item.id !== id),
      );
      setStatusToDelete(null);
      toast.success("Status deleted.");
    } catch (error) {
      toast.error(
        errorMessage(error, "The status could not be deleted."),
      );
    } finally {
      setSettingActionPending(false);
    }
  }

  async function changeStatusOutcome(id: string, outcome: StatusOutcome) {
    setSettingActionPending(true);
    try {
      if (!demoMode) {
        await statusRequest("PATCH", { id, outcome });
      }
      onStatusOutcomeChange(id, outcome);
      toast.success(
        outcome === "open"
          ? "This is now an active status."
          : outcome === "delivered"
            ? "Tasks here count as completed and archive after 14 days."
            : "Tasks here archive after 14 days without counting as completed.",
      );
    } catch (error) {
      toast.error(
        errorMessage(error, "The status could not be updated."),
      );
    } finally {
      setSettingActionPending(false);
    }
  }

  async function toggleRequiresReason(id: string, requiresReason: boolean) {
    setSettingActionPending(true);
    try {
      if (!demoMode) {
        await statusRequest("PATCH", { id, requiresReason });
      }
      onStatusesChange((current) =>
        current.map((item) =>
          item.id === id ? { ...item, requires_reason: requiresReason } : item,
        ),
      );
      toast.success(
        requiresReason
          ? "Moving a task here now requires a reason."
          : "Tasks can move here without a reason.",
      );
    } catch (error) {
      toast.error(errorMessage(error, "The status could not be updated."));
    } finally {
      setSettingActionPending(false);
    }
  }

  async function moveStatus(id: string, direction: -1 | 1) {
    if (settingActionPending) return;
    const ordered = [...statuses].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    const index = ordered.findIndex((item) => item.id === id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return;
    [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
    const next = ordered.map((item, sort_order) => ({ ...item, sort_order }));
    setSettingActionPending(true);
    try {
      if (!demoMode) {
        const result = await statusRequest<{
          statuses: Status[];
        }>("PATCH", {
          orderedIds: next.map((item) => item.id),
          expectedRevision: ordered[0]?.order_revision ?? 0,
        });
        const savedById = new Map(
          result.statuses.map((status) => [status.id, status]),
        );
        next.splice(
          0,
          next.length,
          ...next.map((status) => savedById.get(status.id) ?? status),
        );
      }
      onStatusesChange(() => next);
    } catch (error) {
      toast.error(
        errorMessage(error, "The status order could not be saved."),
      );
    } finally {
      setSettingActionPending(false);
    }
  }
  return (
    <div className="space-y-6">
      <p className="text-sm leading-6 text-black/70 dark:text-white/70">
        Completion statuses mark tasks complete when they enter the column and
        automatically archive them after 14 days. Moving a task back to an
        active status reopens it. A status that requires a reason asks whoever
        moves a task into it to say why, and keeps that answer as a comment on
        the task — “Will Not Do” does by default.
      </p>

      <div className="space-y-3">
        {[...statuses]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((item, index, ordered) => (
            <div
              key={item.id}
              className="rounded-xl border border-black/10 bg-black/[0.015] p-4 dark:border-white/10 dark:bg-white/[0.025]"
            >
              {editingStatusId === item.id ? (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveSetting(item);
                  }}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                    <Input
                      label="Status name"
                      name={`status-name-${item.id}`}
                      value={editingStatusName}
                      onChange={(event) =>
                        setEditingStatusName(event.target.value)
                      }
                      disabled={settingActionPending}
                      autoFocus
                      required
                      maxLength={80}
                    />
                    <label className="date-field">
                      <span>
                        Color <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="color"
                        aria-label={`Color for ${item.name}`}
                        className="color-input !h-11 !w-11"
                        value={editingStatusColor}
                        disabled={settingActionPending}
                        required
                        onChange={(event) =>
                          setEditingStatusColor(event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <Textarea
                    id={`status-description-${item.id}`}
                    label="Brief description"
                    name={`status-description-${item.id}`}
                    value={editingStatusDescription}
                    onChange={(event) =>
                      setEditingStatusDescription(event.target.value)
                    }
                    placeholder="What belongs in this column?"
                    disabled={settingActionPending}
                    maxLength={240}
                    rows={2}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={cancelEdit}
                      disabled={settingActionPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!editingStatusName.trim()}
                      loading={settingActionPending}
                      loadingText="Saving..."
                    >
                      Save changes
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                  <span
                    aria-hidden
                    className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-inset ring-black/10 dark:ring-white/20"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 font-semibold">{item.name}</span>
                      {"is_default" in item && item.is_default && (
                        <Tooltip content="Built-in status. Tasks must be moved before it can be deleted.">
                          <span className="inline-flex">
                            <Pill
                              variant="neutral"
                              size="sm"
                              className="!px-2 !py-0.5 !text-[10px] font-medium !tracking-[0.12em]"
                            >
                              Default
                            </Pill>
                          </span>
                        </Tooltip>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-sm text-black/60 dark:text-white/60">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Tooltip
                      content={
                        statusOutcomeOptions.find(
                          (option) => option.value === item.outcome,
                        )?.description ?? ""
                      }
                    >
                      <span className="inline-flex">
                        <DropdownSelect
                          label="Outcome"
                          value={item.outcome}
                          disabled={settingActionPending}
                          options={statusOutcomeOptions.map((option) => ({
                            label: option.label,
                            value: option.value,
                          }))}
                          onChange={(value) =>
                            void changeStatusOutcome(
                              item.id,
                              statusOutcome(value),
                            )
                          }
                        />
                      </span>
                    </Tooltip>
                    <Tooltip
                      content={
                        item.requires_reason
                          ? "Moving a task here asks for a reason, saved as a comment. Select to stop requiring one."
                          : "Select to require a reason whenever a task moves here."
                      }
                    >
                      <button
                        type="button"
                        aria-label={`${item.name} ${item.requires_reason ? "currently requires a reason when a task moves here" : "accepts tasks without a reason"}`}
                        aria-pressed={item.requires_reason}
                        disabled={settingActionPending}
                        onClick={() =>
                          void toggleRequiresReason(
                            item.id,
                            !item.requires_reason,
                          )
                        }
                        className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition focus:outline-none focus:ring-2 focus:ring-black/20 disabled:opacity-50 dark:focus:ring-white/30 ${item.requires_reason ? "border-amber-500/35 bg-amber-500/15 text-amber-800 dark:text-amber-200" : "border-black/10 text-black/50 hover:border-black/25 hover:text-black dark:border-white/10 dark:text-white/50 dark:hover:border-white/25 dark:hover:text-white"}`}
                      >
                        <FiMessageSquare aria-hidden className="h-3.5 w-3.5" />
                        {item.requires_reason
                          ? "Requires a reason"
                          : "No reason needed"}
                      </button>
                    </Tooltip>
                    <span
                      aria-hidden
                      className="h-6 w-px bg-black/10 dark:bg-white/10"
                    />
                    <div className="flex items-center gap-1.5">
                      <IconButton
                        className="disabled:opacity-40"
                        label={`Move “${item.name}” up`}
                        disabled={settingActionPending || index === 0}
                        onClick={() => void moveStatus(item.id, -1)}
                      >
                        <FiChevronDown className="rotate-180" />
                      </IconButton>
                      <IconButton
                        className="disabled:opacity-40"
                        label={`Move “${item.name}” down`}
                        disabled={
                          settingActionPending || index === ordered.length - 1
                        }
                        onClick={() => void moveStatus(item.id, 1)}
                      >
                        <FiChevronDown />
                      </IconButton>
                      <IconButton
                        label={`Edit “${item.name}”`}
                        variant="edit"
                        disabled={settingActionPending}
                        onClick={() => beginEdit(item)}
                      >
                        <FiEdit2 />
                      </IconButton>
                      <IconButton
                        label={`Delete “${item.name}”`}
                        variant="danger"
                        disabled={settingActionPending}
                        onClick={() => setStatusToDelete(item)}
                      >
                        <FiTrash2 />
                      </IconButton>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>

      <ConfirmationDialog
        open={Boolean(statusToDelete)}
        setOpen={(nextOpen) => {
          if (!nextOpen) setStatusToDelete(null);
        }}
        title="Delete Status?"
        description={
          statusToDelete &&
          "is_default" in statusToDelete &&
          statusToDelete.is_default
            ? "This is a default status. Tasks using it must be moved before it can be deleted."
            : "This shared status will be permanently deleted."
        }
        confirmLabel="Delete status"
        pendingLabel="Deleting..."
        pending={settingActionPending}
        destructive
        onConfirm={() => {
          if (statusToDelete) void deleteSetting(statusToDelete.id);
        }}
      />
    </div>
  );
}
