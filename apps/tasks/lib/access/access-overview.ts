import {
  WORKSPACE_AREAS,
  type WorkspaceArea,
  type WorkspaceAreaKey,
} from "@/lib/access/workspace-areas";
import type { AccessGroup } from "@/lib/access/access-types";

export type Resource = {
  id: string;
  name: string;
  access_mode: "owners" | "open" | "restricted";
};

export type ResourceGrant = {
  resourceId: string;
  groupId: string;
};

export type AreaAccess = {
  area: string;
  accessMode: "open" | "restricted";
};

export type AreaGrant = {
  area: string;
  groupId: string;
};

export type ExplainedAccess = {
  id: string;
  name: string;
  reason: string;
};

export type AccessGroupOverview = {
  projects: ExplainedAccess[];
  projectCount: number;
  /** Everything the group cannot open, with the rule that keeps it out. */
  unavailableProjects: ExplainedAccess[];
  categories: ExplainedAccess[];
  categoryCount: number;
  unavailableCategories: ExplainedAccess[];
  pages: ExplainedAccess[];
  pageCount: number;
  unavailablePages: ExplainedAccess[];
  calendarReason: string | null;
};

export function inheritedGroupIds(
  group: Pick<AccessGroup, "id" | "kind" | "hierarchy_rank">,
  groups: Pick<AccessGroup, "id" | "kind" | "hierarchy_rank">[],
) {
  if (group.kind === "team") return [group.id];
  return groups
    .filter(
      (candidate) =>
        candidate.kind === "tier" &&
        (candidate.hierarchy_rank ?? 0) <= (group.hierarchy_rank ?? 0),
    )
    .map((candidate) => candidate.id);
}

export function effectiveMembershipGroupIds(
  directGroupIds: string[],
  groups: Pick<AccessGroup, "id" | "kind" | "hierarchy_rank">[],
) {
  const memberTier = groups.find(
    (group) => group.kind === "tier" && directGroupIds.includes(group.id),
  );
  return groups
    .filter(
      (group) =>
        directGroupIds.includes(group.id) ||
        (group.kind === "tier" &&
          memberTier?.hierarchy_rank !== null &&
          memberTier?.hierarchy_rank !== undefined &&
          (group.hierarchy_rank ?? 0) <= memberTier.hierarchy_rank),
    )
    .map((group) => group.id);
}

function grantReason(
  selectedGroupId: string,
  subjectGroupId: string,
  groupsById: Map<string, Pick<AccessGroup, "name">>,
) {
  return selectedGroupId === subjectGroupId
    ? "Selected directly"
    : `Inherited from ${groupsById.get(selectedGroupId)?.name ?? "a lower tier"}`;
}

function denialReason(hasAnyGrant: boolean) {
  return hasAnyGrant
    ? "Restricted to other groups"
    : "Restricted, with no groups selected";
}

function explainResources({
  group,
  resources,
  grants,
  effectiveGroupIds,
  groupsById,
  workspaceWide,
}: {
  group: Pick<AccessGroup, "id">;
  resources: Resource[];
  grants: ResourceGrant[];
  effectiveGroupIds: Set<string>;
  groupsById: Map<string, Pick<AccessGroup, "name">>;
  workspaceWide: boolean;
}) {
  const grantsByResource = new Map<string, string[]>();
  const grantedResourceIds = new Set<string>();
  for (const grant of grants) {
    grantedResourceIds.add(grant.resourceId);
    if (!effectiveGroupIds.has(grant.groupId)) continue;
    grantsByResource.set(grant.resourceId, [
      ...(grantsByResource.get(grant.resourceId) ?? []),
      grant.groupId,
    ]);
  }
  const available: ExplainedAccess[] = [];
  const unavailable: ExplainedAccess[] = [];
  for (const resource of resources) {
    const { id, name } = resource;
    if (workspaceWide) {
      available.push({ id, name, reason: "Workspace-wide manager access" });
      continue;
    }
    if (resource.access_mode === "open") {
      available.push({ id, name, reason: "Open to the workspace" });
      continue;
    }
    const selectedGroupId = grantsByResource.get(id)?.[0];
    if (selectedGroupId)
      available.push({
        id,
        name,
        reason: grantReason(selectedGroupId, group.id, groupsById),
      });
    else
      unavailable.push({
        id,
        name,
        reason:
          resource.access_mode === "owners"
            ? "Owners only"
            : denialReason(grantedResourceIds.has(id)),
      });
  }
  return { available, unavailable };
}

export function buildAccessGroupOverview({
  group,
  groups,
  projects,
  categories,
  projectGrants,
  categoryGrants,
  areaAccess,
  areaGrants,
  areas = WORKSPACE_AREAS,
}: {
  group: AccessGroup;
  groups: AccessGroup[];
  projects: Resource[];
  categories: Resource[];
  projectGrants: ResourceGrant[];
  categoryGrants: ResourceGrant[];
  areaAccess: AreaAccess[];
  areaGrants: AreaGrant[];
  /** The pages this instance has; see `enabledWorkspaceAreas`. */
  areas?: readonly WorkspaceArea[];
}): AccessGroupOverview {
  const groupIds = inheritedGroupIds(group, groups);
  const effectiveGroupIds = new Set(groupIds);
  const groupsById = new Map(
    groups.map((candidate) => [candidate.id, candidate]),
  );
  const workspaceWide = group.grants_global_content;
  const projectAccess = explainResources({
    group,
    resources: projects,
    grants: projectGrants,
    effectiveGroupIds,
    groupsById,
    workspaceWide,
  });
  const categoryAccess = explainResources({
    group,
    resources: categories,
    grants: categoryGrants,
    effectiveGroupIds,
    groupsById,
    workspaceWide,
  });
  const areaMode = new Map(
    areaAccess.map((area) => [area.area, area.accessMode]),
  );
  const pages: ExplainedAccess[] = [];
  const unavailablePages: ExplainedAccess[] = [];
  for (const area of areas) {
    const page = { id: area.key, name: area.label };
    if ((areaMode.get(area.key) ?? "open") === "open") {
      pages.push({ ...page, reason: "Open to the workspace" });
      continue;
    }
    const areaGrantsForPage = areaGrants.filter(
      (grant) => grant.area === area.key,
    );
    const selectedGroupId = areaGrantsForPage.find((grant) =>
      effectiveGroupIds.has(grant.groupId),
    )?.groupId;
    if (selectedGroupId)
      pages.push({
        ...page,
        reason: grantReason(selectedGroupId, group.id, groupsById),
      });
    else
      unavailablePages.push({
        ...page,
        reason: denialReason(areaGrantsForPage.length > 0),
      });
  }
  const calendarSource = groups.find(
    (candidate) =>
      effectiveGroupIds.has(candidate.id) && candidate.calendar_access,
  );
  const canOpenCalendar = pages.some(
    (area) => area.id === ("calendar" satisfies WorkspaceAreaKey),
  );

  return {
    projects: projectAccess.available,
    projectCount: projects.length,
    unavailableProjects: projectAccess.unavailable,
    categories: categoryAccess.available,
    categoryCount: categories.length,
    unavailableCategories: categoryAccess.unavailable,
    pages,
    pageCount: areas.length,
    unavailablePages,
    calendarReason:
      canOpenCalendar && calendarSource
        ? calendarSource.id === group.id
          ? "Enabled directly for this group"
          : `Inherited from ${calendarSource.name}`
        : null,
  };
}

/**
 * The same explanation for every group at once.
 *
 * The access page renders a card per group and each one summarises what that
 * group reaches, so the counts come from a single set of grants passed through
 * once rather than a query per card.
 */
export function buildAccessGroupOverviews(input: {
  groups: AccessGroup[];
  projects: Resource[];
  categories: Resource[];
  projectGrants: ResourceGrant[];
  categoryGrants: ResourceGrant[];
  areaAccess: AreaAccess[];
  areaGrants: AreaGrant[];
  areas?: readonly WorkspaceArea[];
}): Map<string, AccessGroupOverview> {
  return new Map(
    input.groups.map((group) => [
      group.id,
      buildAccessGroupOverview({ ...input, group }),
    ]),
  );
}
