import { FiLock } from "react-icons/fi";
import { ResourceOwnerSelect } from "@/components/global";
import { FormSection } from "@/components/resources";
import type { Profile } from "@/lib/workspace/workspace-types";
import type { Project } from "@/lib/resources/resource-types";
import {
  ProjectAccessFields,
  type ProjectAccessGroup,
} from "./ProjectAccessFields";

/**
 * Who can reach a project, and who owns it. Owners live in here rather than in
 * the generic field set because "who can use it" is the question they answer:
 * an owner keeps access no matter what the access mode says.
 */
export function ProjectAccessSection({
  groups,
  accessMode,
  groupIds,
  onAccessModeChange,
  onGroupIdsChange,
  profiles,
  ownerIds,
  onOwnerIdsChange,
  disabled,
  loaded,
  owner,
  column,
}: {
  groups: ProjectAccessGroup[];
  accessMode: Project["access_mode"];
  groupIds: string[];
  onAccessModeChange: (mode: Project["access_mode"]) => void;
  onGroupIdsChange: (groupIds: string[]) => void;
  profiles: Profile[];
  ownerIds: string[];
  onOwnerIdsChange: (ownerIds: string[]) => void;
  /** The form is saving. A pending access request no longer disables anything. */
  disabled: boolean;
  loaded: boolean;
  owner: boolean;
  /**
   * `true` when the section heads its own column instead of following the
   * fields above it. A section rule separates it from a predecessor it no
   * longer has, so drop it at the width where the columns actually split.
   */
  column?: boolean;
}) {
  return (
    <FormSection
      title="Who can use it"
      description="Project owners always retain access. Members of selected groups can see the project and work on its tasks."
      icon={<FiLock className="h-4 w-4" />}
      className={column ? "lg:border-t-0 lg:pt-0" : undefined}
    >
      <ProjectAccessFields
        groups={groups}
        accessMode={accessMode}
        groupIds={groupIds}
        onAccessModeChange={onAccessModeChange}
        onGroupIdsChange={onGroupIdsChange}
        disabled={disabled}
        loaded={loaded}
        owner={owner}
      />
      <ResourceOwnerSelect
        label="Project owners"
        profiles={profiles}
        value={ownerIds}
        onChange={onOwnerIdsChange}
        disabled={disabled}
      />
    </FormSection>
  );
}
