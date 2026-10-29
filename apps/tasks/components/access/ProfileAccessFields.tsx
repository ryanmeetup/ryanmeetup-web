"use client";

import { DropdownSelect, MultiSelect } from "@ryanmeetup/ui";

export type AccessGroupOption = {
  id: string;
  name: string;
  color: string;
  kind: "tier" | "team";
  hierarchy_rank?: number | null;
  is_default: boolean;
};

/**
 * A person's app role, tier, and teams: the three values
 * `replace_profile_access` saves together. Shared by Manage and Invite so a
 * teammate's access is chosen the same way before and after they join.
 */
export function ProfileAccessFields({
  appRole,
  groups,
  pending,
  selections,
  setAppRole,
  setSelections,
}: {
  appRole: "owner" | "member";
  groups: AccessGroupOption[];
  pending: boolean;
  selections: string[];
  setAppRole: (role: "owner" | "member") => void;
  setSelections: (update: (current: string[]) => string[]) => void;
}) {
  const tierGroups = groups.filter((group) => group.kind === "tier");
  const teamGroups = groups.filter((group) => group.kind === "team");
  return (
    <>
      <DropdownSelect
        label="App role"
        variant="field"
        value={appRole}
        onChange={(value) => setAppRole(value as "owner" | "member")}
        options={[
          { label: "Team member", value: "member" },
          { label: "App owner", value: "owner" },
        ]}
        disabled={pending}
        required
      />
      <p className="text-sm text-black/65 dark:text-white/65">
        App owners manage people, groups, settings, and all content. The last
        app owner cannot be demoted or removed.
      </p>
      <DropdownSelect
        label="Organizational tier"
        variant="field"
        value={
          selections.find((groupId) =>
            tierGroups.some((group) => group.id === groupId),
          ) ?? ""
        }
        onChange={(tierId) =>
          setSelections((current) => [
            tierId,
            ...current.filter((groupId) =>
              teamGroups.some((group) => group.id === groupId),
            ),
          ])
        }
        options={[...tierGroups]
          .sort((a, b) => (a.hierarchy_rank ?? 0) - (b.hierarchy_rank ?? 0))
          .map((group) => ({
            label: group.is_default
              ? `${group.name} (default for new members)`
              : group.name,
            value: group.id,
          }))}
        disabled={pending}
        required
      />
      <MultiSelect
        label="Teams"
        options={teamGroups.map((group) => ({
          label: group.name,
          value: group.id,
          color: group.color,
        }))}
        value={selections.filter((groupId) =>
          teamGroups.some((group) => group.id === groupId),
        )}
        onChange={(teamIds) =>
          setSelections((current) => [
            ...current.filter((groupId) =>
              tierGroups.some((group) => group.id === groupId),
            ),
            ...teamIds,
          ])
        }
        placeholder={
          groups.length > 0 ? "Select access groups" : "No groups available"
        }
        disabled={pending || groups.length === 0}
      />
    </>
  );
}
