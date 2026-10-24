"use client";

import { useMemo, useRef, useState } from "react";
import { Card, DropdownSelect, MultiSelect, toast } from "@ryanmeetup/ui";
import { FiGlobe, FiLock } from "react-icons/fi";
import {
  enabledWorkspaceAreas,
  type WorkspaceAreaKey,
} from "@/lib/access/workspace-areas";
import type { AccessGroup } from "@/lib/access/access-types";
import { useInstance } from "@/components/global";
import { mutate } from "@/lib/mutation-client";
import { errorMessage } from "@/lib/presentation";

/**
 * The badge that says whether a page is locked, at a glance.
 *
 * A padlock next to an open padlock is the same silhouette twice at 10px, so
 * the two states carry different shapes — a globe for "everyone", a padlock for
 * "some groups" — and only the locked one is tinted. Three neutral cards with
 * one amber badge answers "what did I lock?" without reading a word.
 */
const badgeState = {
  open: {
    icon: FiGlobe,
    label: "Open",
    className:
      "border-black/10 bg-black/5 text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60",
  },
  restricted: {
    icon: FiLock,
    label: "Restricted",
    className:
      "border-amber-500/35 bg-amber-500/15 text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/15 dark:text-amber-100",
  },
} as const;

export type WorkspaceAreaAccess = {
  area: WorkspaceAreaKey;
  accessMode: "open" | "restricted";
  groupIds: string[];
};

/**
 * Who can open Notes, Contacts, and the Calendar.
 *
 * One card per page rather than a checkbox per group, so "who can see
 * Contacts?" is answered by reading one row instead of opening every group.
 * Each card saves the moment it changes, on its own: locking a page must not
 * ride along with an unrelated edit elsewhere on the screen.
 */
export function WorkspaceAreaAccessPanel({
  groups,
  initialAccess,
  enforced,
  onSaved,
}: {
  groups: AccessGroup[];
  initialAccess: WorkspaceAreaAccess[];
  /** False until the migration that creates the page-access tables is applied. */
  enforced: boolean;
  /**
   * Reports the persisted entry after a successful save, so the group cards
   * above can restate what each group reaches only once it is in force.
   */
  onSaved?: (entry: WorkspaceAreaAccess) => void;
}) {
  const instance = useInstance();
  const areas = useMemo(() => enabledWorkspaceAreas(instance), [instance]);
  const [access, setAccess] = useState<WorkspaceAreaAccess[]>(() =>
    areas.map(
      (area) =>
        initialAccess.find((entry) => entry.area === area.key) ?? {
          area: area.key,
          accessMode: "open" as const,
          groupIds: [],
        },
    ),
  );
  const [saving, setSaving] = useState<
    Partial<Record<WorkspaceAreaKey, number>>
  >({});
  const persisted = useRef(new Map(access.map((entry) => [entry.area, entry])));
  const latest = useRef(new Map<WorkspaceAreaKey, WorkspaceAreaAccess>());
  const queues = useRef(new Map<WorkspaceAreaKey, Promise<void>>());

  const entryFor = (key: WorkspaceAreaKey) =>
    access.find((entry) => entry.area === key)!;
  const replace = (next: WorkspaceAreaAccess) =>
    setAccess((current) =>
      current.map((entry) => (entry.area === next.area ? next : entry)),
    );
  const track = (key: WorkspaceAreaKey, delta: number) =>
    setSaving((current) => ({
      ...current,
      [key]: (current[key] ?? 0) + delta,
    }));

  /**
   * Show the change at once and save it behind any save already running for
   * that page. A save superseded by a newer change is skipped rather than sent,
   * so a slow response can never put back a choice the owner moved past.
   */
  function update(key: WorkspaceAreaKey, patch: Partial<WorkspaceAreaAccess>) {
    const entry = { ...entryFor(key), ...patch };
    const next: WorkspaceAreaAccess = {
      ...entry,
      groupIds: entry.accessMode === "restricted" ? entry.groupIds : [],
    };
    replace(entry);
    latest.current.set(key, next);
    track(key, 1);
    const label = areas.find((area) => area.key === key)?.label ?? key;
    const queued = (queues.current.get(key) ?? Promise.resolve()).then(
      async () => {
        if (latest.current.get(key) !== next) return;
        try {
          await mutate("/api/workspace-area-access", {
            method: "POST",
            body: JSON.stringify({
              area: next.area,
              accessMode: next.accessMode,
              groupIds: next.groupIds,
            }),
          });
          persisted.current.set(key, next);
          onSaved?.(next);
        } catch (error) {
          toast.error(
            errorMessage(error, `${label} access could not be saved.`),
          );
          if (latest.current.get(key) !== next) return;
          const restored = persisted.current.get(key)!;
          latest.current.set(key, restored);
          replace(restored);
        } finally {
          track(key, -1);
        }
      },
    );
    queues.current.set(key, queued);
  }

  return (
    <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
      {areas.map((area) => {
        const entry = entryFor(area.key);
        const restricted = entry.accessMode === "restricted";
        const Icon = area.icon;
        const badge = badgeState[entry.accessMode];
        const BadgeIcon = badge.icon;
        return (
          <Card key={area.key} className="flex h-full flex-col gap-4 p-5">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold leading-tight">
                <Icon aria-hidden className="shrink-0" />
                {area.label}
                <span
                  className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badge.className}`}
                  aria-label={
                    restricted
                      ? `${area.label} is restricted`
                      : `${area.label} is open to everyone`
                  }
                >
                  <BadgeIcon aria-hidden size={12} className="shrink-0" />
                  {badge.label}
                </span>
              </h3>
              <p className="mt-1 text-sm text-black/65 dark:text-white/65">
                {area.description}
              </p>
            </div>
            <DropdownSelect
              variant="field"
              label={`Who can open ${area.label}?`}
              value={entry.accessMode}
              onChange={(value) =>
                update(area.key, {
                  accessMode: value as WorkspaceAreaAccess["accessMode"],
                })
              }
              options={[
                { label: "Everyone in the workspace", value: "open" },
                { label: "Selected access groups", value: "restricted" },
              ]}
              disabled={!enforced}
              required
            />
            {restricted && (
              <>
                <MultiSelect
                  label="Access groups"
                  options={groups.map((group) => ({
                    label: group.grants_global_content
                      ? `${group.name} (manager tier)`
                      : group.name,
                    value: group.id,
                  }))}
                  value={entry.groupIds}
                  onChange={(groupIds) => update(area.key, { groupIds })}
                  placeholder="Choose access groups"
                  searchable
                  searchPlaceholder="Search access groups"
                  disabled={!enforced}
                />
                {entry.groupIds.length === 0 && (
                  <p className="text-sm text-black/65 dark:text-white/65">
                    With no group selected, only app owners can open{" "}
                    {area.label}.
                  </p>
                )}
              </>
            )}
            {enforced && (
              <p
                role="status"
                className="mt-auto text-xs font-semibold uppercase tracking-wider text-black/55 dark:text-white/55"
              >
                {saving[area.key] ? "Saving…" : "Saved automatically"}
              </p>
            )}
          </Card>
        );
      })}
      {!enforced && (
        <p
          role="status"
          className="text-sm text-black/65 md:col-span-2 xl:col-span-3 dark:text-white/65"
        >
          Page access is not available yet on this workspace. Apply the pending
          database migrations and reload.
        </p>
      )}
    </div>
  );
}
