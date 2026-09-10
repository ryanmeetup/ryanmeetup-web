import { NextResponse } from "next/server";
import {
  idSchema,
  statusCreateSchema,
  statusPatchSchema,
} from "@/lib/api-schema";
import { databaseFailure } from "@/lib/server/api-response";
import {
  apiError,
  auditPrivilegedAction,
  privilegedContext,
  readJson,
  recordWorkspaceActivity,
} from "@/lib/server/privileged-api";

export async function POST(request: Request) {
  const parsed = await readJson(request, statusCreateSchema);
  if ("response" in parsed) return parsed.response;
  const context = await privilegedContext({ owner: true });
  if ("response" in context) return context.response;
  const { data, error } = await context.admin
    .rpc("create_status", {
      status_name: parsed.data.name,
      status_description: parsed.data.description,
      status_color: parsed.data.color,
    })
    .single();
  if (
    error ||
    !data ||
    typeof data !== "object" ||
    !("id" in data) ||
    typeof data.id !== "string"
  ) {
    return databaseFailure(
      request,
      "status.create",
      error ?? { message: "Status RPC returned no row." },
      {
        error: "The status could not be created. Try again.",
        conflictError: "A status with that name already exists.",
      },
    );
  }
  if (
    !(await auditPrivilegedAction(context.admin, context.user, {
      action: "status.create",
      targetType: "status",
      targetId: data.id,
    }))
  )
    return apiError(
      500,
      "AUDIT_FAILED",
      "The status was created, but its audit record could not be saved.",
    );
  // A status is workspace-wide furniture: adding, renaming, reordering or
  // deleting one reshapes every board, so the feed has to explain it.
  await recordWorkspaceActivity(context.admin, context.user, {
    action: "status.create",
    targetType: "status",
    targetId: data.id,
    metadata: { resource_name: parsed.data.name },
  });
  return NextResponse.json({ status: data });
}

export async function PATCH(request: Request) {
  const parsed = await readJson(request, statusPatchSchema);
  if ("response" in parsed) return parsed.response;
  const context = await privilegedContext({ owner: true });
  if ("response" in context) return context.response;

  if (Array.isArray(parsed.data.orderedIds)) {
    const orderedIds = [...new Set(parsed.data.orderedIds)];
    if (orderedIds.length !== parsed.data.orderedIds.length)
      return apiError(400, "INVALID_REQUEST", "Each status must appear once.");
    const { data, error } = await context.admin.rpc("reorder_statuses", {
      ordered_status_ids: orderedIds,
      expected_revision: parsed.data.expectedRevision,
    });
    if (error) {
      return databaseFailure(request, "status.reorder", error, {
        error: "The statuses could not be reordered. Try again.",
        conflictError: "The status list changed. Refresh and try again.",
      });
    }
    if (
      !(await auditPrivilegedAction(context.admin, context.user, {
        action: "status.reorder",
        targetType: "status_collection",
        metadata: { count: orderedIds.length },
      }))
    )
      return apiError(
        500,
        "AUDIT_FAILED",
        "The statuses were reordered, but the audit record could not be saved.",
      );
    await recordWorkspaceActivity(context.admin, context.user, {
      action: "status.reorder",
      targetType: "status_collection",
      metadata: { resource_name: `${orderedIds.length} statuses` },
    });
    return NextResponse.json({ statuses: data ?? [] });
  }

  const updates = {
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.description !== undefined
      ? { description: parsed.data.description }
      : {}),
    ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
    ...(parsed.data.outcome !== undefined
      ? { outcome: parsed.data.outcome }
      : {}),
    ...(parsed.data.requiresReason !== undefined
      ? { requires_reason: parsed.data.requiresReason }
      : {}),
  };
  const { data, error } = await context.admin
    .from("statuses")
    .update(updates)
    .eq("id", parsed.data.id)
    .select("*")
    .single();
  if (error) {
    return databaseFailure(request, "status.update", error, {
      error: "The status could not be updated. Try again.",
      conflictError: "A status with that name already exists.",
    });
  }
  if (
    !(await auditPrivilegedAction(context.admin, context.user, {
      action: "status.update",
      targetType: "status",
      targetId: parsed.data.id,
    }))
  )
    return apiError(
      500,
      "AUDIT_FAILED",
      "The status was updated, but its audit record could not be saved.",
    );
  await recordWorkspaceActivity(context.admin, context.user, {
    action: "status.update",
    targetType: "status",
    targetId: parsed.data.id,
    metadata: { resource_name: data?.name },
  });
  return NextResponse.json({ status: data });
}

export async function DELETE(request: Request) {
  const parsed = await readJson(request, idSchema);
  if ("response" in parsed) return parsed.response;
  const context = await privilegedContext({ owner: true });
  if ("response" in context) return context.response;
  const { data, error } = await context.admin
    .rpc("delete_status", {
      status_id: parsed.data.id,
    })
    .single();
  if (
    error ||
    !data ||
    typeof data !== "object" ||
    !("id" in data) ||
    typeof data.id !== "string"
  ) {
    return databaseFailure(
      request,
      "status.delete",
      error ?? { message: "Status RPC returned no row." },
      {
        error: "The status could not be deleted. It may still be in use.",
      },
    );
  }
  if (
    !(await auditPrivilegedAction(context.admin, context.user, {
      action: "status.delete",
      targetType: "status",
      targetId: parsed.data.id,
    }))
  )
    return apiError(
      500,
      "AUDIT_FAILED",
      "The status was deleted, but its audit record could not be saved.",
    );
  await recordWorkspaceActivity(context.admin, context.user, {
    action: "status.delete",
    targetType: "status",
    targetId: parsed.data.id,
    metadata: {
      resource_name:
        "name" in data && typeof data.name === "string" ? data.name : undefined,
    },
  });
  return NextResponse.json({ id: data.id });
}
