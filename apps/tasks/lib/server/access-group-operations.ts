import "server-only";
import { isJsonObject, isUuid } from "@/lib/api-schema/shared";

export type AccessGroupOperation =
  | {
      action: "group.create";
      name: string;
      description: string | null;
      color: string;
      kind: "tier" | "team";
      hierarchyRank: number | null;
      grantsGlobalContent: boolean;
      calendarAccess: boolean;
      guest: boolean;
    }
  | {
      action: "group.update";
      id: string;
      name: string;
      description: string | null;
      color: string;
      kind: "tier" | "team";
      hierarchyRank: number | null;
      grantsGlobalContent: boolean;
      calendarAccess: boolean;
      guest: boolean;
    }
  | { action: "group.delete"; id: string }
  | {
      action: "member.set" | "tier.set" | "member.delete";
      groupId: string;
      profileId: string;
    }
  | {
      action: "profile.access.replace";
      profileId: string;
      tierId: string;
      teamIds: string[];
      appRole: "owner" | "member";
    }
  | { action: "tier.default.set"; groupId: string };

const hexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
// `guest` is optional so an older client's payload keeps meaning "not a guest".
const groupShape = (body: Record<string, unknown>) =>
  (body.guest === undefined || typeof body.guest === "boolean") &&
  ((body.kind === "team" &&
    body.hierarchyRank === null &&
    body.grantsGlobalContent === false &&
    body.guest !== true) ||
    (body.kind === "tier" &&
      Number.isInteger(body.hierarchyRank) &&
      Number(body.hierarchyRank) >= 0 &&
      typeof body.grantsGlobalContent === "boolean" &&
      !(body.guest === true && body.grantsGlobalContent === true)));

export function accessGroupOperationSchema(
  value: unknown,
): AccessGroupOperation | null {
  if (!isJsonObject(value)) return null;
  const body = value;
  if (
    (body.action === "group.create" || body.action === "group.update") &&
    (body.action === "group.create" || isUuid(body.id)) &&
    typeof body.name === "string" &&
    body.name.trim() &&
    body.name.length <= 100 &&
    hexColor(body.color) &&
    groupShape(body) &&
    typeof body.calendarAccess === "boolean" &&
    (body.description === null || typeof body.description === "string")
  ) {
    return {
      action: body.action,
      ...(body.action === "group.update" ? { id: body.id as string } : {}),
      name: body.name.trim().slice(0, 100),
      color: body.color.toLowerCase(),
      kind: body.kind as "tier" | "team",
      hierarchyRank: body.hierarchyRank as number | null,
      grantsGlobalContent: body.grantsGlobalContent as boolean,
      calendarAccess: body.calendarAccess,
      guest: body.guest === true,
      description: body.description
        ? String(body.description).trim().slice(0, 500)
        : null,
    } as AccessGroupOperation;
  }
  if (body.action === "group.delete" && isUuid(body.id))
    return { action: body.action, id: body.id };
  if (
    (body.action === "member.set" ||
      body.action === "member.delete" ||
      body.action === "tier.set") &&
    isUuid(body.groupId) &&
    isUuid(body.profileId)
  )
    return {
      action: body.action,
      groupId: body.groupId,
      profileId: body.profileId,
    };
  if (
    body.action === "profile.access.replace" &&
    isUuid(body.profileId) &&
    isUuid(body.tierId) &&
    Array.isArray(body.teamIds) &&
    body.teamIds.every(isUuid) &&
    (body.appRole === "owner" || body.appRole === "member")
  )
    return {
      action: body.action,
      profileId: body.profileId,
      tierId: body.tierId,
      teamIds: [...new Set(body.teamIds)],
      appRole: body.appRole,
    };
  if (body.action === "tier.default.set" && isUuid(body.groupId))
    return { action: body.action, groupId: body.groupId };
  return null;
}
