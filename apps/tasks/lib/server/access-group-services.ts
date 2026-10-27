import "server-only";

import type { PrivilegedContext } from "@/lib/server/privileged-api";
import type { AccessGroupOperation } from "@/lib/server/access-group-operations";

type ServiceResult = {
  result: unknown;
  targetId: string | null;
  error: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  } | null;
};

export async function mutateAccessGroup(
  context: PrivilegedContext,
  operation: Extract<
    AccessGroupOperation,
    { action: "group.create" | "group.update" | "group.delete" }
  >,
): Promise<ServiceResult> {
  if (operation.action === "group.delete") {
    const response = await context.admin
      .from("access_groups")
      .delete()
      .eq("id", operation.id);
    return {
      result: { id: operation.id },
      targetId: operation.id,
      error: response.error,
    };
  }
  const values = {
    name: operation.name,
    description: operation.description,
    color: operation.color,
    kind: operation.kind,
    hierarchy_rank: operation.hierarchyRank,
    grants_global_content: operation.grantsGlobalContent,
    calendar_access: operation.calendarAccess,
    guest: operation.guest,
    ...(operation.action === "group.create"
      ? { created_by: context.user.id }
      : {}),
  };
  const query =
    operation.action === "group.create"
      ? context.admin.from("access_groups").insert(values)
      : context.admin
          .from("access_groups")
          .update(values)
          .eq("id", operation.id);
  const response = await query.select("*").single();
  return {
    result: { group: response.data },
    targetId:
      operation.action === "group.update"
        ? operation.id
        : (response.data?.id ?? null),
    error: response.error,
  };
}

export async function mutateAccessMember(
  context: PrivilegedContext,
  operation: Extract<
    AccessGroupOperation,
    { action: "member.set" | "tier.set" | "member.delete" }
  >,
): Promise<ServiceResult> {
  if (operation.action === "tier.set") {
    const response = await context.supabase.rpc("set_profile_access_tier", {
      requested_profile_id: operation.profileId,
      requested_group_id: operation.groupId,
    });
    return {
      result: { member: response.data },
      targetId: operation.groupId,
      error: response.error,
    };
  }
  if (operation.action === "member.delete") {
    const response = await context.admin
      .from("access_group_members")
      .delete()
      .eq("group_id", operation.groupId)
      .eq("profile_id", operation.profileId);
    return {
      result: { profileId: operation.profileId },
      targetId: operation.groupId,
      error: response.error,
    };
  }
  const response = await context.admin
    .from("access_group_members")
    .upsert({
      group_id: operation.groupId,
      profile_id: operation.profileId,
      added_by: context.user.id,
    })
    .select("*")
    .single();
  return {
    result: { member: response.data },
    targetId: operation.groupId,
    error: response.error,
  };
}

async function replaceProfileAccess(
  context: PrivilegedContext,
  operation: Extract<
    AccessGroupOperation,
    { action: "profile.access.replace" }
  >,
): Promise<ServiceResult> {
  const response = await context.supabase.rpc("replace_profile_access", {
    requested_profile_id: operation.profileId,
    requested_tier_id: operation.tierId,
    requested_team_ids: operation.teamIds,
    requested_app_role: operation.appRole,
  });
  return {
    result: response.data,
    targetId: operation.profileId,
    error: response.error,
  };
}

async function setDefaultTier(
  context: PrivilegedContext,
  operation: Extract<AccessGroupOperation, { action: "tier.default.set" }>,
): Promise<ServiceResult> {
  const response = await context.supabase.rpc("set_default_access_tier", {
    requested_group_id: operation.groupId,
  });
  return {
    result: { group: response.data },
    targetId: operation.groupId,
    error: response.error,
  };
}

export function dispatchAccessGroupOperation(
  context: PrivilegedContext,
  operation: AccessGroupOperation,
) {
  if (operation.action === "profile.access.replace")
    return replaceProfileAccess(context, operation);
  if (operation.action === "tier.default.set")
    return setDefaultTier(context, operation);
  if (operation.action.startsWith("group."))
    return mutateAccessGroup(
      context,
      operation as Extract<
        AccessGroupOperation,
        { action: "group.create" | "group.update" | "group.delete" }
      >,
    );
  return mutateAccessMember(
    context,
    operation as Extract<
      AccessGroupOperation,
      { action: "member.set" | "tier.set" | "member.delete" }
    >,
  );
}
