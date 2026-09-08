import { NextResponse } from "next/server";
import { profileSchema } from "@/lib/api-schema";
import { displayNameError, normalizeDisplayName } from "@/lib/display-name";
import { databaseFailure, logServerFailure } from "@/lib/server/api-response";
import {
  apiError,
  auditPrivilegedAction,
  privilegedContext,
  readJson,
} from "@/lib/server/privileged-api";

export async function PATCH(request: Request) {
  const parsed = await readJson(request, profileSchema);
  if ("response" in parsed) return parsed.response;
  const context = await privilegedContext();
  if ("response" in context) return context.response;

  const name = normalizeDisplayName(parsed.data.displayName);
  const validationError = displayNameError(name);
  if (validationError) return apiError(400, "INVALID_REQUEST", validationError);
  if (
    parsed.data.avatarPath !== undefined &&
    parsed.data.avatarPath !== `${context.user.id}/avatar`
  ) {
    return apiError(
      400,
      "INVALID_REQUEST",
      "The selected avatar is not valid.",
    );
  }
  const avatarUrl = parsed.data.avatarPath
    ? `${context.admin.storage.from("profile-avatars").getPublicUrl(parsed.data.avatarPath).data.publicUrl}?v=${Date.now()}`
    : undefined;
  const updates = {
    full_name: name,
    onboarding_completed: true,
    task_details_open_by_default: parsed.data.taskDetailsOpenByDefault,
    assign_new_tasks_to_self: parsed.data.assignNewTasksToSelf,
    editor_surface: parsed.data.editorSurface,
    calendar_default_view: parsed.data.calendarDefaultView,
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  };
  const { data: profile, error } = await context.admin
    .from("profiles")
    .update(updates)
    .eq("id", context.user.id)
    .select("*")
    .single();
  if (error) {
    return databaseFailure(request, "profile.update", error, {
      error: "Your profile could not be saved. Try again.",
    });
  }
  const { error: authError } = await context.supabase.auth.updateUser({
    data: { full_name: name, ...(avatarUrl ? { avatar_url: avatarUrl } : {}) },
  });
  if (authError) logServerFailure(request, "profile.auth-metadata", authError);
  if (
    !(await auditPrivilegedAction(context.admin, context.user, {
      action: "profile.update",
      targetType: "profile",
      targetId: context.user.id,
      metadata: { avatarUpdated: Boolean(avatarUrl) },
    }))
  ) {
    return apiError(
      500,
      "AUDIT_FAILED",
      "Your profile was saved, but its audit record could not be saved.",
    );
  }
  return NextResponse.json({ profile });
}
