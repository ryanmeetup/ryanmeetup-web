import { NextResponse } from "next/server";
import { isJsonObject, isUuid } from "@/lib/api-schema/shared";
import {
  isWorkspaceAreaKey,
  workspaceAreaIsWorkspaceWideOnly,
  workspaceAreaLabel,
} from "@/lib/access/workspace-areas";
import { databaseFailure } from "@/lib/server/api-response";
import {
  apiError,
  auditPrivilegedAction,
  privilegedContext,
  readJson,
  recordWorkspaceActivity,
} from "@/lib/server/privileged-api";
import { isRejectedResourceValue } from "@/lib/server/supabase-errors";

/**
 * Lock a whole page behind access groups, or open it again.
 *
 * The page and its complete selected-group set are replaced in one
 * transaction by `set_workspace_area_access`; a partial write must never leave
 * a page restricted with stale grants. The set of pages comes from the
 * application registry, so an unknown key is rejected here rather than written
 * as a row nothing will ever read.
 */
export async function POST(request: Request) {
  const parsed = await readJson(request, (value) => {
    if (!isJsonObject(value)) return null;
    const body = value;
    if (
      !isWorkspaceAreaKey(body.area) ||
      // A fixed rule has no selection to save; the database refuses it too.
      workspaceAreaIsWorkspaceWideOnly(body.area) ||
      (body.accessMode !== "open" && body.accessMode !== "restricted") ||
      !Array.isArray(body.groupIds) ||
      !body.groupIds.every(isUuid)
    )
      return null;
    return {
      area: body.area,
      accessMode: body.accessMode,
      // An open page has no selected groups. Normalizing here means the audit
      // record and the row agree, rather than preserving a set the transaction
      // is about to discard.
      groupIds:
        body.accessMode === "restricted" ? [...new Set(body.groupIds)] : [],
    };
  });
  if ("response" in parsed) return parsed.response;
  const context = await privilegedContext({ owner: true });
  if ("response" in context) return context.response;

  const { error } = await context.supabase.rpc("set_workspace_area_access", {
    requested_area: parsed.data.area,
    requested_access_mode: parsed.data.accessMode,
    requested_group_ids: parsed.data.groupIds,
  });
  if (error)
    return isRejectedResourceValue(error.code)
      ? apiError(400, "INVALID_REQUEST", error.message)
      : databaseFailure(request, "workspace-area-access.update", error, {
          error: "Page access could not be updated.",
        });

  const label = workspaceAreaLabel(parsed.data.area);
  const audited = await auditPrivilegedAction(context.admin, context.user, {
    action: "workspace_area.access.update",
    targetType: "workspace_area",
    metadata: {
      area: parsed.data.area,
      accessMode: parsed.data.accessMode,
      groupIds: parsed.data.groupIds,
    },
  });
  if (!audited)
    return apiError(
      500,
      "AUDIT_FAILED",
      "Page access was saved, but its audit record could not be created.",
    );
  await recordWorkspaceActivity(context.admin, context.user, {
    action: "workspace_area.access.update",
    targetType: "workspace_area",
    metadata: {
      resource_name: label,
      resource_href: "/admin/access",
      detail: `Now ${parsed.data.accessMode}`,
    },
  });
  return NextResponse.json({ ok: true });
}
