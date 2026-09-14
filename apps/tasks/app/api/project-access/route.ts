import { NextResponse } from "next/server";
import { isJsonObject, isUuid } from "@/lib/api-schema/shared";
import { databaseFailure } from "@/lib/server/api-response";
import {
  apiError,
  privilegedContext,
  readJson,
  recordWorkspaceActivity,
} from "@/lib/server/privileged-api";

const accessModeLabel = {
  owners: "Owners only",
  open: "Open",
  restricted: "Restricted",
} as const;

export async function GET(request: Request) {
  const context = await privilegedContext();
  if ("response" in context) return context.response;
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (projectId !== null && !isUuid(projectId))
    return apiError(400, "INVALID_REQUEST", "A valid project is required.");
  const { data: allowed, error: permissionError } = projectId
    ? await context.supabase.rpc("can_administer_project_access", {
        requested_project_id: projectId,
      })
    : await context.supabase.rpc("is_app_owner");
  if (permissionError || !allowed)
    return apiError(403, "FORBIDDEN", "You cannot manage project visibility.");

  const [groupsResult, grantsResult, projectResult] = await Promise.all([
    context.admin
      .from("access_groups")
      .select("id,name,kind,hierarchy_rank,grants_global_content")
      .order("name"),
    projectId
      ? context.admin
          .from("project_group_grants")
          .select("group_id")
          .eq("project_id", projectId)
      : Promise.resolve({ data: [], error: null }),
    projectId
      ? context.admin
          .from("projects")
          .select("access_mode")
          .eq("id", projectId)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (groupsResult.error || grantsResult.error || projectResult.error)
    return databaseFailure(
      request,
      "project-access.read",
      groupsResult.error ?? grantsResult.error ?? projectResult.error!,
      { error: "Project access settings could not be loaded." },
    );

  const availableGroupIds = new Set(groupsResult.data.map((group) => group.id));
  return NextResponse.json({
    groups: groupsResult.data,
    groupIds: grantsResult.data
      .filter((grant) => availableGroupIds.has(grant.group_id))
      .map((grant) => grant.group_id),
    accessMode: projectResult.data?.access_mode ?? "owners",
  });
}

export async function POST(request: Request) {
  const parsed = await readJson(request, (value) => {
    if (!isJsonObject(value)) return null;
    const body = value;
    if (
      !isUuid(body.projectId) ||
      (body.accessMode !== "owners" &&
        body.accessMode !== "open" &&
        body.accessMode !== "restricted") ||
      !Array.isArray(body.groupIds) ||
      !body.groupIds.every(isUuid) ||
      (body.accessMode === "restricted" && body.groupIds.length === 0)
    )
      return null;
    return {
      projectId: body.projectId,
      accessMode: body.accessMode,
      groupIds: [...new Set(body.groupIds)],
    };
  });
  if ("response" in parsed) return parsed.response;
  const context = await privilegedContext();
  if ("response" in context) return context.response;
  const { data: allowed, error: permissionError } = await context.supabase.rpc(
    "can_administer_project_access",
    { requested_project_id: parsed.data.projectId },
  );
  if (permissionError || !allowed)
    return apiError(403, "FORBIDDEN", "You cannot manage project visibility.");
  const [projectResult, grantsResult] = await Promise.all([
    context.admin
      .from("projects")
      .select("access_mode")
      .eq("id", parsed.data.projectId)
      .single(),
    context.admin
      .from("project_group_grants")
      .select("group_id")
      .eq("project_id", parsed.data.projectId),
  ]);
  if (projectResult.error || grantsResult.error)
    return databaseFailure(
      request,
      "project-access.read-before-update",
      projectResult.error ?? grantsResult.error!,
      { error: "Project visibility could not be checked." },
    );
  const previousGroupIds = grantsResult.data.map((grant) => grant.group_id);
  const nextGroupIds =
    parsed.data.accessMode === "restricted" ? parsed.data.groupIds : [];
  if (
    projectResult.data.access_mode === parsed.data.accessMode &&
    previousGroupIds.length === nextGroupIds.length &&
    previousGroupIds.every((id) => nextGroupIds.includes(id))
  )
    return NextResponse.json({ ok: true });
  const { error } = await context.supabase.rpc("set_project_visibility", {
    requested_project_id: parsed.data.projectId,
    requested_access_mode: parsed.data.accessMode,
    requested_group_ids: parsed.data.groupIds,
  });
  if (error)
    return databaseFailure(request, "project-access.update", error, {
      error: "Project visibility could not be updated.",
    });
  // The RPC records the compliance event in the same transaction. The feed is
  // the human-readable companion for teammates affected by the change.
  const { data: project } = await context.supabase
    .from("projects")
    .select("name")
    .eq("id", parsed.data.projectId)
    .maybeSingle();
  await recordWorkspaceActivity(context.admin, context.user, {
    action: "project.access.update",
    targetType: "project",
    targetId: parsed.data.projectId,
    metadata: {
      resource_name: project?.name,
      resource_href: "/projects",
      project_id: parsed.data.projectId,
      detail:
        projectResult.data.access_mode === parsed.data.accessMode
          ? "Selected access groups changed"
          : `${accessModeLabel[projectResult.data.access_mode as keyof typeof accessModeLabel]} → ${accessModeLabel[parsed.data.accessMode as keyof typeof accessModeLabel]}`,
    },
  });
  return NextResponse.json({ ok: true });
}
