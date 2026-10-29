import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessPreview } from "@/lib/workspace/workspace-types";
import {
  WORKSPACE_AREA_KEYS,
  workspaceAreaIsWorkspaceWideOnly,
  workspaceAreaRequiresAccessCheck,
  type WorkspaceAreaKey,
} from "@/lib/access/workspace-areas";
import { effectiveMembershipGroupIds } from "@/lib/access/access-overview";
import { isMissingRelation } from "./supabase-errors";
import { requireQueryData } from "./workspace-loader";

type PreviewCategory = {
  id: string;
  access_mode: "open" | "restricted";
};

type PreviewCategoryGrant = { category_id: string; group_id: string };

type PreviewGroupCalendarAccess = {
  id: string;
  calendar_access?: boolean | null;
};

export function grantsCalendarAccessForPreview(
  groups: PreviewGroupCalendarAccess[],
  groupIds: string[],
) {
  const effectiveGroupIds = new Set(groupIds);
  return groups.some(
    (group) =>
      effectiveGroupIds.has(group.id) && group.calendar_access === true,
  );
}

type PreviewAreaRow = { area: string; access_mode: "open" | "restricted" };
type PreviewAreaGrant = { area: string; group_id: string };

/**
 * The same rule `can_view_workspace_area` applies, projected for the preview:
 * unconfigured pages are open, except the RY-D pages, which need an explicit
 * row; restricted pages need a selected group, and only app owners bypass them.
 * A guest skips open and unconfigured pages alike. RY-D Settings ignores rows
 * and grants: it opens to workspace-wide tiers and nobody else.
 * Diagnostic only — it never authorizes a request.
 */
export function accessibleAreasForPreview(
  areas: PreviewAreaRow[],
  grants: PreviewAreaGrant[],
  groupIds: string[],
  isAppOwner: boolean,
  guest = false,
  workspaceWide = false,
): WorkspaceAreaKey[] {
  if (isAppOwner) return [...WORKSPACE_AREA_KEYS];
  const configured = new Set(areas.map((area) => area.area));
  const restricted = new Set(
    areas
      .filter((area) => area.access_mode === "restricted")
      .map((area) => area.area),
  );
  const effectiveGroupIds = new Set(groupIds);
  const grantedAreas = new Set(
    grants
      .filter((grant) => effectiveGroupIds.has(grant.group_id))
      .map((grant) => grant.area),
  );
  return WORKSPACE_AREA_KEYS.filter((area) =>
    workspaceAreaIsWorkspaceWideOnly(area)
      ? workspaceWide
      : restricted.has(area)
        ? grantedAreas.has(area)
        : !guest &&
          (!workspaceAreaRequiresAccessCheck(area) || configured.has(area)),
  );
}

async function resolveAreaAccess(
  supabase: SupabaseClient,
  groupIds: string[],
  isAppOwner: boolean,
  guest = false,
  workspaceWide = false,
): Promise<{ accessibleAreas: WorkspaceAreaKey[] }> {
  if (isAppOwner) return { accessibleAreas: [...WORKSPACE_AREA_KEYS] };
  const [areasResult, grantsResult] = await Promise.all([
    supabase.from("workspace_area_access").select("area, access_mode"),
    supabase.from("workspace_area_group_grants").select("area, group_id"),
  ]);
  // Older pages retain their pre-migration open default. RY-D's privileged
  // reads require metadata, including in this diagnostic projection.
  if (
    isMissingRelation(areasResult.error?.code) ||
    isMissingRelation(grantsResult.error?.code)
  )
    return {
      accessibleAreas: guest
        ? []
        : WORKSPACE_AREA_KEYS.filter(
            (area) => !workspaceAreaRequiresAccessCheck(area),
          ),
    };
  return {
    accessibleAreas: accessibleAreasForPreview(
      requireQueryData("preview page access", areasResult),
      requireQueryData("preview page grants", grantsResult),
      groupIds,
      false,
      guest,
      workspaceWide,
    ),
  };
}

export function accessibleCategoryIdsForPreview(
  categories: PreviewCategory[],
  grants: PreviewCategoryGrant[],
  groupIds: string[],
  hasGlobalAccess: boolean,
  guest = false,
) {
  if (hasGlobalAccess) return categories.map((category) => category.id);
  const grantedCategoryIds = new Set(
    grants
      .filter((grant) => groupIds.includes(grant.group_id))
      .map((grant) => grant.category_id),
  );
  return categories
    .filter(
      (category) =>
        (category.access_mode === "open" && !guest) ||
        grantedCategoryIds.has(category.id),
    )
    .map((category) => category.id);
}

async function resolveCategoryAccess(
  supabase: SupabaseClient,
  groupIds: string[],
  hasGlobalAccess: boolean,
  guest = false,
) {
  const [categoriesResult, grantsResult, taskCategoriesResult] =
    await Promise.all([
      supabase.from("work_groups").select("id, access_mode"),
      supabase.from("category_group_grants").select("category_id, group_id"),
      supabase.from("task_categories").select("task_id, category_id"),
    ]);
  const categories = requireQueryData("preview categories", categoriesResult);
  const grants = requireQueryData("preview category grants", grantsResult);
  const taskCategories = requireQueryData(
    "preview task categories",
    taskCategoriesResult,
  );
  const accessibleCategoryIds = accessibleCategoryIdsForPreview(
    categories,
    grants,
    groupIds,
    hasGlobalAccess,
    guest,
  );
  const accessibleCategoryIdSet = new Set(accessibleCategoryIds);
  return {
    accessibleCategoryIds,
    inaccessibleTaskIds: [
      ...new Set(
        taskCategories
          .filter((item) => !accessibleCategoryIdSet.has(item.category_id))
          .map((item) => item.task_id),
      ),
    ],
  };
}

type PreviewGroup = {
  id: string;
  name: string;
  kind: "tier" | "team";
  hierarchy_rank: number | null;
  grants_global_content: boolean;
  calendar_access?: boolean | null;
  guest?: boolean;
};

const PREVIEW_GROUP_COLUMNS =
  "id, name, kind, hierarchy_rank, grants_global_content, calendar_access, guest";

/**
 * The groups a group preview names: one group by id or name, or a
 * comma-separated combination such as `Guest,RY-D`. A whole-value match wins,
 * so a name containing a comma still previews on its own. A combination stands
 * in for one member, so like every member it holds at most one tier. Any name
 * that matches nothing voids the preview rather than quietly narrowing it.
 */
export function previewGroupSelection<Group extends PreviewGroup>(
  requested: string,
  groups: Group[],
): Group[] | null {
  const find = (value: string) =>
    groups.find((group) => group.id === value || group.name === value);
  const whole = find(requested.trim());
  if (whole) return [whole];
  const selected: Group[] = [];
  for (const part of requested.split(",")) {
    const value = part.trim();
    if (!value) continue;
    const group = find(value);
    if (!group) return null;
    if (!selected.includes(group)) selected.push(group);
  }
  if (selected.length === 0) return null;
  if (selected.filter((group) => group.kind === "tier").length > 1) return null;
  return selected;
}

/**
 * What a member holding exactly these groups reaches. A real person adds the
 * projects they own by name; a group preview has no person to own anything.
 */
async function resolveMembershipAccess(
  supabase: SupabaseClient,
  options: {
    directGroupIds: string[];
    groups: PreviewGroup[];
    allProjectIds: string[];
    profileId?: string;
  },
): Promise<{
  preview: Omit<
    AccessPreview,
    "kind" | "subjectId" | "subjectName" | "subjectProfile"
  >;
  projectIds: string[];
}> {
  const { directGroupIds, groups, profileId } = options;
  const memberTier = groups.find(
    (group) => group.kind === "tier" && directGroupIds.includes(group.id),
  );
  const groupIds = effectiveMembershipGroupIds(directGroupIds, groups);
  const calendarAccess = grantsCalendarAccessForPreview(groups, groupIds);
  if (memberTier?.grants_global_content) {
    const [categoryAccess, areaAccess] = await Promise.all([
      resolveCategoryAccess(supabase, groupIds, true),
      resolveAreaAccess(supabase, groupIds, false, false, true),
    ]);
    return {
      preview: {
        canManageCategories: true,
        calendarAccess,
        ...categoryAccess,
        ...areaAccess,
      },
      projectIds: options.allProjectIds,
    };
  }
  const guest = memberTier?.guest === true;
  const [grants, openProjects, ownedProjects] = await Promise.all([
    groupIds.length > 0
      ? supabase
          .from("project_group_grants")
          .select("project_id")
          .in("group_id", groupIds)
          .then((result) => requireQueryData("preview project grants", result))
      : Promise.resolve([]),
    guest
      ? Promise.resolve([])
      : supabase
          .from("projects")
          .select("id")
          .eq("access_mode", "open")
          .then((result) => requireQueryData("preview open projects", result)),
    profileId
      ? supabase
          .from("project_owners")
          .select("project_id")
          .eq("profile_id", profileId)
          .then((result) => requireQueryData("preview owned projects", result))
      : Promise.resolve([]),
  ]);
  const [categoryAccess, areaAccess] = await Promise.all([
    resolveCategoryAccess(supabase, groupIds, false, guest),
    resolveAreaAccess(supabase, groupIds, false, guest),
  ]);
  return {
    preview: { calendarAccess, guest, ...categoryAccess, ...areaAccess },
    projectIds: [
      ...new Set([
        ...grants.map((grant) => grant.project_id),
        ...openProjects.map((project) => project.id),
        ...ownedProjects.map((owner) => owner.project_id),
      ]),
    ],
  };
}

export async function resolveAccessPreview(
  supabase: SupabaseClient,
  options: {
    /** One group's id or name, or a comma-separated combination of them. */
    groupId?: string;
    userName?: string;
    allProjectIds: string[];
  },
): Promise<{ preview: AccessPreview; projectIds: string[] } | null> {
  if (options.groupId) {
    const groups = requireQueryData(
      "preview access groups",
      await supabase.from("access_groups").select(PREVIEW_GROUP_COLUMNS),
    ) as PreviewGroup[];
    const selected = previewGroupSelection(options.groupId, groups);
    if (!selected) return null;
    const access = await resolveMembershipAccess(supabase, {
      directGroupIds: selected.map((group) => group.id),
      groups,
      allProjectIds: options.allProjectIds,
    });
    return {
      preview: {
        kind: "group",
        subjectId: selected.map((group) => group.id).join(","),
        subjectName: selected.map((group) => group.name).join(","),
        groupNames: selected.map((group) => group.name),
        ...access.preview,
      },
      projectIds: access.projectIds,
    };
  }

  if (!options.userName) return null;
  const profiles = requireQueryData(
    "preview profiles",
    await supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, onboarding_completed, task_details_open_by_default, assign_new_tasks_to_self, editor_surface, calendar_default_view, app_role, favorite_project_ids",
      )
      .eq("full_name", options.userName)
      .limit(2),
  );
  // Full names are not constrained unique. Never guess if two users share one.
  if (profiles.length !== 1) return null;
  const [profile] = profiles;
  if (profile.app_role === "owner") {
    const categoryAccess = await resolveCategoryAccess(supabase, [], true);
    return {
      preview: {
        kind: "user",
        subjectId: profile.id,
        subjectName: profile.full_name,
        subjectProfile: profile,
        calendarAccess: true,
        canManageCategories: true,
        ...categoryAccess,
        ...(await resolveAreaAccess(supabase, [], true)),
      },
      projectIds: options.allProjectIds,
    };
  }

  const [memberships, groups] = await Promise.all([
    supabase
      .from("access_group_members")
      .select("group_id")
      .eq("profile_id", profile.id),
    supabase.from("access_groups").select(PREVIEW_GROUP_COLUMNS),
  ]);
  const access = await resolveMembershipAccess(supabase, {
    directGroupIds: requireQueryData(
      "preview access memberships",
      memberships,
    ).map((membership) => membership.group_id),
    groups: requireQueryData("preview access groups", groups) as PreviewGroup[],
    allProjectIds: options.allProjectIds,
    profileId: profile.id,
  });
  return {
    preview: {
      kind: "user",
      subjectId: profile.id,
      subjectName: profile.full_name,
      subjectProfile: profile,
      ...access.preview,
    },
    projectIds: access.projectIds,
  };
}
