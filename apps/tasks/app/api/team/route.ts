import { NextResponse } from "next/server";
import { inviteSchema, userDeleteSchema } from "@/lib/api-schema";
import { tasksAppUrl } from "@/lib/app-url";
import { databaseFailure } from "@/lib/server/api-response";
import {
  apiError,
  auditPrivilegedAction,
  consumeInviteLimit,
  privilegedContext,
  readJson,
  recordWorkspaceActivity,
} from "@/lib/server/privileged-api";

export async function POST(request: Request) {
  const parsed = await readJson(request, inviteSchema);
  if ("response" in parsed) return parsed.response;
  const context = await privilegedContext({ owner: true });
  if ("response" in context) return context.response;

  const allowed = await consumeInviteLimit(context.admin, context.user.id);
  if (allowed === null)
    return apiError(
      503,
      "SERVICE_UNAVAILABLE",
      "Invitations are temporarily unavailable.",
    );
  if (!allowed)
    return apiError(
      429,
      "RATE_LIMITED",
      "Too many invitations were sent. Try again later.",
      {
        "Retry-After": "3600",
      },
    );

  const fallbackName = parsed.data.email.split("@")[0];
  const fullName = parsed.data.fullName || fallbackName;
  const { data, error } = await context.admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: { full_name: fullName },
      redirectTo: tasksAppUrl("/auth/callback", request),
    },
  );
  if (error) {
    return databaseFailure(request, "team.invite", error, {
      error:
        "The invitation could not be sent. Check the address and try again.",
      conflictError: "That person has already been invited.",
    });
  }
  if (
    !(await auditPrivilegedAction(context.admin, context.user, {
      action: "team.invite",
      targetType: "profile",
      targetId: data.user.id,
    }))
  ) {
    return apiError(
      500,
      "AUDIT_FAILED",
      "The invitation was sent, but its audit record could not be saved.",
    );
  }
  // Someone appearing in or vanishing from every assignee dropdown had no
  // explanation anywhere in the product until this.
  await recordWorkspaceActivity(context.admin, context.user, {
    action: "team.invite",
    targetType: "profile",
    targetId: data.user.id,
    metadata: { resource_name: fullName },
  });
  return NextResponse.json({
    profile: {
      id: data.user.id,
      full_name: fullName,
      avatar_url: null,
      onboarding_completed: false,
      task_details_open_by_default: false,
      assign_new_tasks_to_self: false,
      editor_surface: "auto",
      calendar_default_view: "all",
      app_role: "member",
    },
  });
}

export async function DELETE(request: Request) {
  const parsed = await readJson(request, userDeleteSchema);
  if ("response" in parsed) return parsed.response;
  const context = await privilegedContext({ owner: true });
  if ("response" in context) return context.response;
  if (parsed.data.userId === context.user.id)
    return apiError(
      400,
      "INVALID_REQUEST",
      "You cannot remove your own account.",
    );

  // The profile row is deleted with the user, so its name has to be read
  // before the removal to be nameable in the feed afterwards.
  const { data: removed } = await context.admin
    .from("profiles")
    .select("full_name")
    .eq("id", parsed.data.userId)
    .maybeSingle();
  const { error } = await context.admin.auth.admin.deleteUser(
    parsed.data.userId,
  );
  if (error) {
    return databaseFailure(request, "team.remove", error, {
      error: "The teammate could not be removed. Try again.",
    });
  }
  if (
    !(await auditPrivilegedAction(context.admin, context.user, {
      action: "team.remove",
      targetType: "profile",
      targetId: parsed.data.userId,
    }))
  ) {
    return apiError(
      500,
      "AUDIT_FAILED",
      "The teammate was removed, but its audit record could not be saved.",
    );
  }
  await recordWorkspaceActivity(context.admin, context.user, {
    action: "team.remove",
    targetType: "profile",
    targetId: parsed.data.userId,
    metadata: { resource_name: removed?.full_name },
  });
  return NextResponse.json({ ok: true });
}
