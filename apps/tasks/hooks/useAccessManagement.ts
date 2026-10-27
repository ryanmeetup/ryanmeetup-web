"use client";

import { useState } from "react";
import { accessMutation } from "@/lib/access/access-mutations";
import type { AccessGroup, GroupMember } from "@/lib/access/access-types";

export function useAccessManagement({
  initialGroups,
  initialMembers,
}: {
  initialGroups: AccessGroup[];
  initialMembers: GroupMember[];
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [members, setMembers] = useState(initialMembers);

  async function createGroup(
    input: Omit<
      AccessGroup,
      "id" | "created_by" | "created_at" | "updated_at" | "is_default"
    >,
  ) {
    const { group } = await accessMutation<{ group: AccessGroup }>({
      action: "group.create",
      name: input.name,
      description: input.description,
      color: input.color,
      kind: input.kind,
      hierarchyRank: input.hierarchy_rank,
      grantsGlobalContent: input.grants_global_content,
      calendarAccess: input.calendar_access,
      guest: input.guest,
    });
    setGroups((current) =>
      [...current.filter((item) => item.id !== group.id), group].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
    return group;
  }

  async function updateGroup(
    groupId: string,
    input: Omit<
      AccessGroup,
      "id" | "created_by" | "created_at" | "updated_at" | "is_default"
    >,
  ) {
    const { group } = await accessMutation<{ group: AccessGroup }>({
      action: "group.update",
      id: groupId,
      name: input.name,
      description: input.description,
      color: input.color,
      kind: input.kind,
      hierarchyRank: input.hierarchy_rank,
      grantsGlobalContent: input.grants_global_content,
      calendarAccess: input.calendar_access,
      guest: input.guest,
    });
    setGroups((current) =>
      current.map((item) => (item.id === group.id ? group : item)),
    );
    return group;
  }

  async function deleteGroup(groupId: string) {
    await accessMutation({ action: "group.delete", id: groupId });
    setGroups((current) => current.filter((item) => item.id !== groupId));
    setMembers((current) =>
      current.filter((item) => item.group_id !== groupId),
    );
  }

  async function setMember(groupId: string, profileId: string, tier = false) {
    const { member } = await accessMutation<{ member: GroupMember }>({
      action: tier ? "tier.set" : "member.set",
      groupId,
      profileId,
    });
    setMembers((current) => [
      ...current.filter((item) =>
        tier
          ? item.profile_id !== profileId ||
            !groups.some(
              (group) => group.kind === "tier" && group.id === item.group_id,
            )
          : item.profile_id !== profileId || item.group_id !== groupId,
      ),
      member,
    ]);
    return member;
  }

  async function removeMember(groupId: string, profileId: string) {
    await accessMutation({ action: "member.delete", groupId, profileId });
    setMembers((current) =>
      current.filter(
        (item) => item.group_id !== groupId || item.profile_id !== profileId,
      ),
    );
  }

  async function replaceProfileAccess(
    profileId: string,
    tierId: string,
    teamIds: string[],
    appRole: "owner" | "member",
  ) {
    const result = await accessMutation<{
      profile: { app_role: "owner" | "member" };
      members: GroupMember[];
    }>({
      action: "profile.access.replace",
      profileId,
      tierId,
      teamIds,
      appRole,
    });
    setMembers((current) => [
      ...current.filter((member) => member.profile_id !== profileId),
      ...result.members,
    ]);
    return result;
  }

  async function setDefaultTier(groupId: string) {
    const { group } = await accessMutation<{ group: AccessGroup }>({
      action: "tier.default.set",
      groupId,
    });
    setGroups((current) =>
      current.map((item) => ({
        ...item,
        is_default: item.id === group.id,
      })),
    );
    return group;
  }

  return {
    groups,
    members,
    setGroups,
    setMembers,
    createGroup,
    updateGroup,
    deleteGroup,
    setMember,
    removeMember,
    replaceProfileAccess,
    setDefaultTier,
  };
}
