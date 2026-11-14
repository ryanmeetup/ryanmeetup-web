"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryParamState } from "@ryanmeetup/hooks";
import { toast } from "@ryanmeetup/ui";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { mutate } from "@/lib/mutation-client";
import { errorMessage } from "@/lib/presentation";
import { savedTaskViewCreateSchema } from "@/lib/api-schema";
import {
  applySavedViewParams,
  normalizeSavedViewSettings,
  savedViewSettingsEqual,
  type SavedTaskView,
  type SavedTaskViewSettings,
  type SavedTaskViewsState,
} from "@/lib/tasks/saved-task-views";

export function useSavedTaskViews({
  initial,
  current,
  data,
  demoMode,
  clearSearch,
}: {
  initial: SavedTaskViewsState;
  current: SavedTaskViewSettings;
  data: WorkspaceData;
  demoMode: boolean;
  clearSearch: () => void;
}) {
  const [views, setViews] = useState(initial.views);
  const [ready, setReady] = useState(!demoMode);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const [selectedName, setSelectedName] = useQueryParamState("savedView");
  const selected = views.find((view) => view.name === selectedName) ?? null;
  const storageKey = `ryanmeetup.tasks.demo.saved-views.${data.currentProfile.id}`;

  useEffect(() => {
    if (!demoMode) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const stored: unknown = JSON.parse(
          localStorage.getItem(storageKey) ?? "[]",
        );
        if (!Array.isArray(stored)) throw new Error("Invalid saved views");
        const loaded = stored.flatMap((entry) => {
          if (!entry || typeof entry.id !== "string") return [];
          const parsed = savedTaskViewCreateSchema({
            name: entry.name,
            settings: entry.settings,
          });
          return parsed ? [{ id: entry.id, ...parsed }] : [];
        });
        setViews(loaded);
        setReady(true);
      } catch {
        setError("Saved views could not be loaded from this browser.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [demoMode, storageKey]);

  function select(view: SavedTaskView | null) {
    if (busy.current) return;
    try {
      const url = new URL(window.location.href);
      url.search = applySavedViewParams(
        url.searchParams,
        view,
        data,
      ).toString();
      clearSearch();
      window.history.pushState(window.history.state, "", url);
      setError(null);
    } catch (failure) {
      setError(errorMessage(failure, "This view could not be opened."));
    }
  }

  async function save(
    name: string,
    settings: SavedTaskViewSettings,
    existing?: SavedTaskView,
    renameOnly = false,
  ) {
    if (busy.current) return null;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const parsed = savedTaskViewCreateSchema({ name, settings });
      if (!parsed)
        throw new Error("Enter a view name of 80 characters or fewer.");
      if (
        views.some(
          (view) =>
            view.id !== existing?.id &&
            view.name.toLocaleLowerCase() === parsed.name.toLocaleLowerCase(),
        )
      )
        throw new Error(
          "You already have a view with that name. Choose another name.",
        );
      const saved = demoMode
        ? { id: existing?.id ?? crypto.randomUUID(), ...parsed }
        : (
            await mutate<{ view: SavedTaskView }>(
              existing
                ? `/api/saved-task-views/${existing.id}`
                : "/api/saved-task-views",
              {
                method: existing ? "PATCH" : "POST",
                body: JSON.stringify(
                  renameOnly ? { name: parsed.name } : parsed,
                ),
              },
            )
          ).view;
      const next = [
        ...views.filter((view) => view.id !== saved.id),
        saved,
      ].sort((a, b) => a.name.localeCompare(b.name));
      if (demoMode) localStorage.setItem(storageKey, JSON.stringify(next));
      setViews(next);
      if (!existing || selected?.id === existing.id)
        setSelectedName(saved.name);
      toast.success(
        renameOnly
          ? "View renamed."
          : existing
            ? "View updated."
            : "View saved.",
      );
      return saved;
    } catch (failure) {
      setError(
        errorMessage(failure, "Your view could not be saved. Try again."),
      );
      return null;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function remove(view: SavedTaskView) {
    if (busy.current) return false;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      if (!demoMode)
        await mutate(`/api/saved-task-views/${view.id}`, {
          method: "DELETE",
          body: "{}",
        });
      const next = views.filter((item) => item.id !== view.id);
      if (demoMode) localStorage.setItem(storageKey, JSON.stringify(next));
      setViews(next);
      if (selected?.id === view.id) setSelectedName("");
      toast.success("View deleted.");
      return true;
    } catch (failure) {
      setError(
        errorMessage(failure, "Your view could not be deleted. Try again."),
      );
      return false;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return {
    views,
    selected,
    pending,
    error,
    setError,
    select,
    save,
    remove,
    available: !data.accessPreview && initial.available && ready,
    unavailableReason: data.accessPreview
      ? ("access-preview" as const)
      : !initial.available
        ? ("workspace-setup" as const)
        : !ready
          ? error
            ? ("browser-storage" as const)
            : ("loading" as const)
          : null,
    modified: Boolean(
      selected && !savedViewSettingsEqual(selected.settings, current),
    ),
    snapshot: () => normalizeSavedViewSettings(current),
  };
}

export type SavedTaskViewsController = ReturnType<typeof useSavedTaskViews>;
