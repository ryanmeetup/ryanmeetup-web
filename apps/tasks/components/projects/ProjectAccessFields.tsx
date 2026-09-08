import {
  DropdownSelect,
  MultiSelect,
  getFieldLabelClasses,
} from "@ryanmeetup/ui";
import type { Project } from "@/lib/resources/resource-types";

export type ProjectAccessGroup = {
  id: string;
  name: string;
  kind: "tier" | "team";
  hierarchy_rank: number | null;
  grants_global_content: boolean;
};

/**
 * Reserves the group picker's own height while its catalogue is in flight.
 * Sized off `MultiSelect`'s field: a `gap-2` column under the same label, then
 * a control of `py-2.5` around a 20px line plus its hairline border. Guessing
 * shorter would let the dialog jump the moment the request lands.
 */
function AccessGroupsPending() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex min-w-0 flex-col gap-2"
    >
      <span className={getFieldLabelClasses()}>Access groups</span>
      <span
        aria-hidden
        className="h-[42px] w-full animate-pulse rounded-lg border border-black/10 bg-black/[0.05] motion-reduce:animate-none dark:border-white/10 dark:bg-white/[0.07]"
      />
      <span className="sr-only">Loading access groups…</span>
    </div>
  );
}

export function ProjectAccessFields({
  groups,
  accessMode,
  groupIds,
  onAccessModeChange,
  onGroupIdsChange,
  disabled,
  loaded,
  owner,
}: {
  groups: ProjectAccessGroup[];
  accessMode: Project["access_mode"];
  groupIds: string[];
  onAccessModeChange: (mode: Project["access_mode"]) => void;
  onGroupIdsChange: (groupIds: string[]) => void;
  disabled: boolean;
  loaded: boolean;
  owner: boolean;
}) {
  if (!owner) {
    return (
      <p className="text-sm text-black/70 dark:text-white/70">
        App owners manage who can access this project.
      </p>
    );
  }

  return (
    <>
      {/*
        The mode is already on the project record the editor opened from, so it
        renders straight away rather than waiting on `/api/project-access`.
        Only the group catalogue and this project's grants need that request.
      */}
      <DropdownSelect
        variant="field"
        label="Who can access this project?"
        value={accessMode}
        onChange={(value) =>
          onAccessModeChange(value as Project["access_mode"])
        }
        options={[
          { label: "Project owners only", value: "owners" },
          { label: "Everyone in the workspace", value: "open" },
          { label: "Selected access groups", value: "restricted" },
        ]}
        disabled={disabled}
        required
      />
      {accessMode === "restricted" &&
        (loaded ? (
          <MultiSelect
            label="Access groups"
            options={groups.map((group) => ({
              label: group.grants_global_content
                ? `${group.name} (workspace-wide access)`
                : group.name,
              value: group.id,
            }))}
            value={groupIds}
            onChange={onGroupIdsChange}
            placeholder="Choose access groups"
            searchable
            searchPlaceholder="Search access groups"
            disabled={disabled}
          />
        ) : (
          <AccessGroupsPending />
        ))}
    </>
  );
}
