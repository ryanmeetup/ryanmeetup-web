"use client";
import { mutate } from "@/lib/mutation-client";
import {
  accessChangeRequest,
  type AccessChangeTarget,
} from "@/lib/access/access-overview";

export function accessMutation<T>(body: Record<string, unknown>) {
  return mutate<T>("/api/access-groups", { method: "POST", body: JSON.stringify(body) });
}

export type AccessResourceKind = "project" | "category" | "page";

const accessRoutes = {
  project: { path: "/api/project-access", idKey: "projectId" },
  category: { path: "/api/category-access", idKey: "categoryId" },
  page: { path: "/api/workspace-area-access", idKey: "area" },
} as const;

/** Grant or remove one group on a resource through its full-state route. */
export function toggleResourceGroupAccess(
  kind: AccessResourceKind,
  resourceId: string,
  groupId: string,
  target: AccessChangeTarget,
) {
  const { path, idKey } = accessRoutes[kind];
  return mutate(path, {
    method: "POST",
    body: JSON.stringify({
      [idKey]: resourceId,
      ...accessChangeRequest(kind, groupId, target),
    }),
  });
}
