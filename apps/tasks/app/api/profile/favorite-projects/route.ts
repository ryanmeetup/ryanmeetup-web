import { NextResponse } from "next/server";
import { apiError, privilegedContext } from "@/lib/server/privileged-api";
import { databaseFailure } from "@/lib/server/api-response";

export async function PATCH(request: Request) {
  const context = await privilegedContext();
  if ("response" in context) return context.response;

  const body = (await request.json().catch(() => null)) as {
    projectId?: unknown;
    favorite?: unknown;
  } | null;
  if (
    typeof body?.projectId !== "string" ||
    typeof body.favorite !== "boolean"
  ) {
    return apiError(400, "INVALID_REQUEST", "Choose a valid project.");
  }

  const { data: project, error: projectError } = await context.supabase
    .from("projects")
    .select("id,status")
    .eq("id", body.projectId)
    .is("archived_at", null)
    .maybeSingle();
  if (projectError || !project) {
    return apiError(404, "NOT_FOUND", "That project is not available.");
  }
  if (body.favorite && project.status === "complete") {
    return apiError(
      409,
      "CONFLICT",
      "Completed projects cannot be added to favorites.",
    );
  }

  const { data: profile, error: profileError } = await context.admin
    .from("profiles")
    .select("favorite_project_ids")
    .eq("id", context.user.id)
    .single();
  if (profileError) {
    return databaseFailure(request, "project-favorite.read", profileError, {
      error: "Your favorites could not be loaded. Try again.",
    });
  }

  const current = new Set<string>(profile.favorite_project_ids ?? []);
  if (body.favorite) current.add(body.projectId);
  else current.delete(body.projectId);

  const { error: updateError } = await context.admin
    .from("profiles")
    .update({ favorite_project_ids: [...current] })
    .eq("id", context.user.id);
  if (updateError) {
    return databaseFailure(request, "project-favorite.update", updateError, {
      error: "Your favorite could not be saved. Try again.",
    });
  }

  return NextResponse.json({ favoriteProjectIds: [...current] });
}
