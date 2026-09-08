import { NextResponse } from "next/server";
import {
  idSchema,
  projectCreateSchema,
  projectPatchSchema,
} from "@/lib/api-schema";
import { apiError, databaseFailure, notFound } from "@/lib/server/api-response";
import { authorize } from "@/lib/server/auth";
import { readJson } from "@/lib/server/request";

export async function POST(request: Request) {
  const parsed = await readJson(request, projectCreateSchema);
  if ("response" in parsed) return parsed.response;
  const authorization = await authorize({ owner: true, onboarded: true });
  if ("response" in authorization) return authorization.response;
  const { data, error } = await authorization.supabase.rpc(
    "create_project_with_visibility",
    {
      requested_name: parsed.data.name,
      requested_description: parsed.data.description,
      requested_links: parsed.data.links,
      requested_owner_ids: parsed.data.ownerIds,
      requested_access_mode: parsed.data.accessMode,
      requested_group_ids: parsed.data.accessGroupIds,
      requested_status: parsed.data.status,
      requested_start_date: parsed.data.startDate,
      requested_due_date: parsed.data.dueDate,
    },
  );
  if (error)
    return databaseFailure(request, "project.create", error, {
      error: "The project could not be created. Try again.",
      conflictError: "A project with that name already exists.",
    });
  const project = Array.isArray(data) ? data[0] : data;
  if (!project)
    return apiError(
      500,
      "OPERATION_FAILED",
      "The project could not be created. Try again.",
    );
  return NextResponse.json({ project });
}

export async function PATCH(request: Request) {
  const parsed = await readJson(request, projectPatchSchema);
  if ("response" in parsed) return parsed.response;
  const authorization = await authorize({ onboarded: true });
  if ("response" in authorization) return authorization.response;
  const { supabase } = authorization;
  const { data: canManage, error: permissionError } = await supabase.rpc(
    "can_manage_project",
    { project_id: parsed.data.id },
  );
  if (permissionError)
    return databaseFailure(request, "project.permission", permissionError, {
      error: "Project permissions are temporarily unavailable.",
    });
  if (!canManage) return notFound();
  const { id, ...values } = parsed.data;
  const { error } = await supabase.rpc("replace_project_owners_and_update", {
    requested_project_id: id,
    requested_values: values,
  });
  if (error)
    return databaseFailure(request, "project.update", error, {
      error: "The project could not be updated. Try again.",
      conflictError: "A project with that name already exists.",
    });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const parsed = await readJson(request, idSchema);
  if ("response" in parsed) return parsed.response;
  const authorization = await authorize({ onboarded: true });
  if ("response" in authorization) return authorization.response;
  const { supabase } = authorization;
  const { data: canManage, error: permissionError } = await supabase.rpc(
    "can_manage_project",
    { project_id: parsed.data.id },
  );
  if (permissionError)
    return databaseFailure(request, "project.permission", permissionError, {
      error: "Project permissions are temporarily unavailable.",
    });
  if (!canManage) return notFound();
  const projectResult = await supabase
    .from("projects")
    .select("id,name")
    .eq("id", parsed.data.id)
    .single();
  if (projectResult.error) return notFound();
  const { count, error: countError } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("project_id", parsed.data.id);
  if (countError)
    return databaseFailure(request, "project.delete-check", countError, {
      error: "The project could not be checked for tasks. Try again.",
    });
  if (count)
    return apiError(
      409,
      "CONFLICT",
      "Move or delete every task in this project before deleting it.",
    );
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", parsed.data.id);
  if (error)
    return databaseFailure(request, "project.delete", error, {
      error: "The project could not be deleted. Try again.",
    });
  return NextResponse.json({ ok: true });
}
