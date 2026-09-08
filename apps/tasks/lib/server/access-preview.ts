import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessPreview } from "@/lib/workspace/workspace-types";
import {
  WORKSPACE_AREA_KEYS,
  type WorkspaceAreaKey,
} from "@/lib/access/workspace-areas";
import {
  effectiveMembershipGroupIds,
  inheritedGroupIds as groupIdsWithInheritance,
} from "@/lib/access/access-overview";
import { isMissingRelation } from "./supabase-errors";
import { requireQueryData, requireQueryResult } from "./workspace-loader";

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
 * a page with no restricted row is open, a restricted page needs a selected
 * group the subject reaches, and only app owners bypass page restrictions.
 * Diagnostic only — it never authorizes a request.
 */
export function accessibleAreasForPreview(
  areas: PreviewAreaRow[],
  grants: PreviewAreaGrant[],
  groupIds: string[],
  isAppOwner: boolean,
): WorkspaceAreaKey[] {
  if (isAppOwner) return [...WORKSPACE_AREA_KEYS];
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
  return WORKSPACE_AREA_KEYS.filter(
    (area) => !restricted.has(area) || grantedAreas.has(area),
  );
}

async function resolveAreaAccess(
  supabase: SupabaseClient,
  groupIds: string[],
  isAppOwner: boolean,
): Promise<{ accessibleAreas: WorkspaceAreaKey[] }> {
  if (isAppOwner) return { accessibleAreas: [...WORKSPACE_AREA_KEYS] };
  const [areasResult, grantsResult] = await Promise.all([
    supabase.from("workspace_area_access").select("area, access_mode"),
    supabase.from("workspace_area_group_grants").select("area, group_id"),
  ]);
  // Before the migration lands there is nothing restricting a page, so the
  // preview shows what the database would actually allow: all of them.
  if (
    isMissingRelation(areasResult.error?.code) ||
    isMissingRelation(grantsResult.error?.code)
  )
    return { accessibleAreas: [...WORKSPACE_AREA_KEYS] };
  return {
    accessibleAreas: accessibleAreasForPreview(
      requireQueryData("preview page access", areasResult),
      requireQueryData("preview page grants", grantsResult),
      groupIds,
      false,
    ),
  };
}

export function accessibleCategoryIdsForPreview(
  categories: PreviewCategory[],
  grants: PreviewCategoryGrant[],
  groupIds: string[],
  hasGlobalAccess: boolean,
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
        category.access_mode === "open" || grantedCategoryIds.has(category.id),
    )
    .map((category) => category.id);
}

async function resolveCategoryAccess(
  supabase: SupabaseClient,
  groupIds: string[],
  hasGlobalAccess: boolean,
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

export async function resolveAccessPreview(
  supabase: SupabaseClient,
  options: {
    groupId?: string;
    userName?: string;
    allProjectIds: string[];
  },
): Promise<{ preview: AccessPreview; projectIds: string[] } | null> {
  if (options.groupId) {
    const groupLookup = supabase
      .from("access_groups")
      .select(
        "id, name, kind, hierarchy_rank, grants_global_content, calendar_access",
      );
    const groupRequest =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        options.groupId,
      )
        ? groupLookup.eq("id", options.groupId)
        : groupLookup.eq("name", options.groupId);
    const [groupResult, groupsResult] = await Promise.all([
      groupRequest.maybeSingle(),
      supabase
        .from("access_groups")
        .select("id, kind, hierarchy_rank, calendar_access"),
    ]);
    const group = requireQueryResult("preview access group", groupResult);
    const groups = requireQueryData("preview access groups", groupsResult);
    if (!group) return null;
    const inheritedGroupIds = groupIdsWithInheritance(group, groups);
    const [grants, openProjects] = group.grants_global_content
      ? [[], []]
      : await Promise.all([
          supabase
            .from("project_group_grants")
            .select("project_id")
            .in("group_id", inheritedGroupIds)
            .then((result) =>
              requireQueryData("preview project grants", result),
            ),
          supabase
            .from("projects")
            .select("id")
            .eq("access_mode", "open")
            .then((result) =>
              requireQueryData("preview open projects", result),
            ),
        ]);
    const [categoryAccess, areaAccess] = await Promise.all([
      resolveCategoryAccess(
        supabase,
        inheritedGroupIds,
        group.grants_global_content,
      ),
      resolveAreaAccess(supabase, inheritedGroupIds, false),
    ]);
    return {
      preview: {
        kind: "group",
        subjectId: group.id,
        subjectName: group.name,
        calendarAccess: grantsCalendarAccessForPreview(
          groups,
          inheritedGroupIds,
        ),
        ...categoryAccess,
        ...areaAccess,
      },
      projectIds: group.grants_global_content
        ? options.allProjectIds
        : [
            ...new Set([
              ...grants.map((grant) => grant.project_id),
              ...openProjects.map((project) => project.id),
            ]),
          ],
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
    supabase
      .from("access_groups")
      .select(
        "id, kind, hierarchy_rank, grants_global_content, calendar_access",
      ),
  ]);
  const membershipRows = requireQueryData(
    "preview access memberships",
    memberships,
  );
  const groupRows = requireQueryData("preview access groups", groups);
  const directGroupIds = membershipRows.map(
    (membership) => membership.group_id,
  );
  const memberTier = groupRows.find(
    (group) => group.kind === "tier" && directGroupIds.includes(group.id),
  );
  const groupIds = effectiveMembershipGroupIds(directGroupIds, groupRows);
  const calendarAccess = grantsCalendarAccessForPreview(groupRows, groupIds);
  if (memberTier?.grants_global_content) {
    const categoryAccess = await resolveCategoryAccess(
      supabase,
      directGroupIds,
      true,
    );
    return {
      preview: {
        kind: "user",
        subjectId: profile.id,
        subjectName: profile.full_name,
        subjectProfile: profile,
        calendarAccess,
        ...categoryAccess,
        ...(await resolveAreaAccess(supabase, groupIds, false)),
      },
      projectIds: options.allProjectIds,
    };
  }
  const [grants, openProjects, ownedProjects] = await Promise.all([
    groupIds.length > 0
      ? supabase
          .from("project_group_grants")
          .select("project_id")
          .in("group_id", groupIds)
          .then((result) => requireQueryData("preview project grants", result))
      : Promise.resolve([]),
    supabase
      .from("projects")
      .select("id")
      .eq("access_mode", "open")
      .then((result) => requireQueryData("preview open projects", result)),
    supabase
      .from("project_owners")
      .select("project_id")
      .eq("profile_id", profile.id)
      .then((result) => requireQueryData("preview owned projects", result)),
  ]);
  const projectIds = [
    ...new Set([
      ...grants.map((grant) => grant.project_id),
      ...openProjects.map((project) => project.id),
      ...ownedProjects.map((owner) => owner.project_id),
    ]),
  ];
  const [categoryAccess, areaAccess] = await Promise.all([
    resolveCategoryAccess(supabase, groupIds, false),
    resolveAreaAccess(supabase, groupIds, false),
  ]);
  return {
    preview: {
      kind: "user",
      subjectId: profile.id,
      subjectName: profile.full_name,
      subjectProfile: profile,
      calendarAccess,
      ...categoryAccess,
      ...areaAccess,
    },
    projectIds,
  };
}
