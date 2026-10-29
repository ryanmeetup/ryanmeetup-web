import {
  WORKSPACE_AREAS,
  workspaceAreaIsWorkspaceWideOnly,
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
  /**
   * The one change this group can make here: grant something it cannot open,
   * or remove a grant selected for it directly. Open, inherited, and
   * workspace-wide access come from another rule, so they offer nothing.
   */
  change?: AccessChangeTarget;
};

/** Enough of a resource's current rule to rewrite it with one group toggled. */
export type AccessChangeTarget = {
  action: "grant" | "revoke";
  accessMode: Resource["access_mode"];
  groupIds: string[];
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

type InheritanceGroup = Pick<AccessGroup, "id" | "kind" | "hierarchy_rank"> &
  Partial<Pick<AccessGroup, "guest">>;

/**
 * The groups whose grants a group's members receive. Tier inheritance never
 * crosses the guest boundary: a guest tier receives only its own grants, and
 * no other tier receives a guest tier's.
 */
export function inheritedGroupIds(
  group: InheritanceGroup,
  groups: InheritanceGroup[],
) {
  if (group.kind === "team" || group.guest) return [group.id];
  return groups
    .filter(
      (candidate) =>
        candidate.kind === "tier" &&
        !candidate.guest &&
        (candidate.hierarchy_rank ?? 0) <= (group.hierarchy_rank ?? 0),
    )
    .map((candidate) => candidate.id);
}

export function effectiveMembershipGroupIds(
  directGroupIds: string[],
  groups: InheritanceGroup[],
) {
  const memberTier = groups.find(
    (group) => group.kind === "tier" && directGroupIds.includes(group.id),
  );
  return groups
    .filter(
      (group) =>
        directGroupIds.includes(group.id) ||
        (group.kind === "tier" &&
          !group.guest &&
          !memberTier?.guest &&
          memberTier?.hierarchy_rank !== null &&
          memberTier?.hierarchy_rank !== undefined &&
          (group.hierarchy_rank ?? 0) <= memberTier.hierarchy_rank),
    )
    .map((group) => group.id);
}

const GUEST_SKIPS_OPEN = "Open to the workspace, which guests skip";
const WORKSPACE_WIDE_ONLY = "Workspace-wide tiers and app owners only";

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
  guest,
}: {
  group: Pick<AccessGroup, "id">;
  resources: Resource[];
  grants: ResourceGrant[];
  effectiveGroupIds: Set<string>;
  groupsById: Map<string, Pick<AccessGroup, "name">>;
  workspaceWide: boolean;
  guest: boolean;
}) {
  const grantedGroupIds = new Map<string, string[]>();
  for (const grant of grants)
    grantedGroupIds.set(grant.resourceId, [
      ...(grantedGroupIds.get(grant.resourceId) ?? []),
      grant.groupId,
    ]);
  const available: ExplainedAccess[] = [];
  const unavailable: ExplainedAccess[] = [];
  for (const resource of resources) {
    const { id, name } = resource;
    if (workspaceWide) {
      available.push({ id, name, reason: "Workspace-wide manager access" });
      continue;
    }
    if (resource.access_mode === "open") {
      // An open resource has no group set to add a guest tier to.
      if (guest) unavailable.push({ id, name, reason: GUEST_SKIPS_OPEN });
      else available.push({ id, name, reason: "Open to the workspace" });
      continue;
    }
    const groupIds = grantedGroupIds.get(id) ?? [];
    const current = { accessMode: resource.access_mode, groupIds };
    // A direct grant wins over an inherited one so it stays removable here.
    const selectedGroupId = groupIds.includes(group.id)
      ? group.id
      : groupIds.find((groupId) => effectiveGroupIds.has(groupId));
    if (selectedGroupId)
      available.push({
        id,
        name,
        reason: grantReason(selectedGroupId, group.id, groupsById),
        change:
          selectedGroupId === group.id
            ? { action: "revoke", ...current }
            : undefined,
      });
    else
      unavailable.push({
        id,
        name,
        reason:
          resource.access_mode === "owners"
            ? "Owners only"
            : denialReason(groupIds.length > 0),
        change: { action: "grant", ...current },
      });
  }
  return { available, unavailable };
}

/**
 * The request body that toggles one group on a resource, in the full-state
 * shape the access routes replace in one transaction. A project left with no
 * selected groups falls back to owners only, because a restricted project must
 * name at least one group.
 */
export function accessChangeRequest(
  kind: "project" | "category" | "page",
  groupId: string,
  target: AccessChangeTarget,
) {
  const groupIds =
    target.action === "grant"
      ? [...new Set([...target.groupIds, groupId])]
      : target.groupIds.filter((id) => id !== groupId);
  const accessMode: Resource["access_mode"] =
    kind === "project" && groupIds.length === 0 ? "owners" : "restricted";
  return { accessMode, groupIds };
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
  const guest = group.kind === "tier" && group.guest;
  const projectAccess = explainResources({
    group,
    resources: projects,
    grants: projectGrants,
    effectiveGroupIds,
    groupsById,
    workspaceWide,
    guest,
  });
  const categoryAccess = explainResources({
    group,
    resources: categories,
    grants: categoryGrants,
    effectiveGroupIds,
    groupsById,
    workspaceWide,
    guest,
  });
  const areaMode = new Map(
    areaAccess.map((area) => [area.area, area.accessMode]),
  );
  const pages: ExplainedAccess[] = [];
  const unavailablePages: ExplainedAccess[] = [];
  for (const area of areas) {
    const page = { id: area.key, name: area.label };
    // A fixed rule, so there is no grant here for this group to add or drop.
    if (workspaceAreaIsWorkspaceWideOnly(area.key)) {
      if (workspaceWide)
        pages.push({ ...page, reason: "Workspace-wide manager access" });
      else unavailablePages.push({ ...page, reason: WORKSPACE_WIDE_ONLY });
      continue;
    }
    if ((areaMode.get(area.key) ?? "open") === "open") {
      if (guest) unavailablePages.push({ ...page, reason: GUEST_SKIPS_OPEN });
      else pages.push({ ...page, reason: "Open to the workspace" });
      continue;
    }
    const groupIds = areaGrants
      .filter((grant) => grant.area === area.key)
      .map((grant) => grant.groupId);
    const current = { accessMode: "restricted" as const, groupIds };
    const selectedGroupId = groupIds.includes(group.id)
      ? group.id
      : groupIds.find((groupId) => effectiveGroupIds.has(groupId));
    if (selectedGroupId)
      pages.push({
        ...page,
        reason: grantReason(selectedGroupId, group.id, groupsById),
        change:
          selectedGroupId === group.id
            ? { action: "revoke", ...current }
            : undefined,
      });
    else
      unavailablePages.push({
        ...page,
        reason: denialReason(groupIds.length > 0),
        change: { action: "grant", ...current },
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
