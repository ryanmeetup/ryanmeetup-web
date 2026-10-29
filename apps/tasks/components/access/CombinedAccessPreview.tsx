import { useState } from "react";
import { Button, Card, DropdownSelect, MultiSelect } from "@ryanmeetup/ui";
import { FiEye } from "react-icons/fi";
import { accessPreviewHref } from "@/lib/access/access-preview";
import type { AccessGroup } from "@/lib/access/access-types";

/**
 * A group card previews one group, but nobody is only a team: every person has
 * one tier and any number of teams. This previews that whole combination, as a
 * member holding exactly those groups would see the workspace.
 */
export function CombinedAccessPreview({
  tiers,
  teams,
}: {
  /** Highest rank first, as the tier section lists them. */
  tiers: AccessGroup[];
  teams: AccessGroup[];
}) {
  const [tierId, setTierId] = useState(
    () => (tiers.find((tier) => tier.is_default) ?? tiers[0])?.id ?? "",
  );
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const tier = tiers.find((group) => group.id === tierId);
  const selectedTeams = teams.filter((team) => teamIds.includes(team.id));

  return (
    <Card className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
      <DropdownSelect
        label="Organizational tier"
        variant="field"
        value={tierId}
        onChange={setTierId}
        options={tiers.map((group) => ({
          label: group.name,
          value: group.id,
          color: group.color,
        }))}
        required
      />
      <MultiSelect
        label="Teams"
        options={teams.map((group) => ({
          label: group.name,
          value: group.id,
        }))}
        value={teamIds}
        onChange={setTeamIds}
        placeholder={
          teams.length > 0 ? "No teams, just the tier" : "No teams yet"
        }
        disabled={teams.length === 0}
      />
      {tier && (
        <Button.Link
          href={accessPreviewHref(
            tier.name,
            ...selectedTeams.map((team) => team.name),
          )}
          variant="secondary"
          leftIcon={<FiEye />}
          className="w-full sm:w-auto"
        >
          View as combination
        </Button.Link>
      )}
    </Card>
  );
}
