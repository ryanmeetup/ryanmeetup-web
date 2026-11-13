import { NextResponse } from "next/server";
import {
  emptyObjectSchema,
  parseUuid,
  savedTaskViewPatchSchema,
} from "@/lib/api-schema";
import { authorize } from "@/lib/server/auth";
import { readJson } from "@/lib/server/request";
import { databaseFailure, notFound } from "@/lib/server/api-response";
import {
  deleteSavedTaskView,
  updateSavedTaskView,
} from "@/lib/server/saved-task-views";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const authorization = await authorize({ onboarded: true });
  if ("response" in authorization) return authorization.response;
  const id = parseUuid((await context.params).id);
  if (!id) return notFound();
  const parsed = await readJson(request, savedTaskViewPatchSchema);
  if ("response" in parsed) return parsed.response;
  const { data, error } = await updateSavedTaskView(
    authorization.supabase,
    authorization.user.id,
    id,
    parsed.data,
  );
  if (error)
    return databaseFailure(request, "saved-task-view.update", error, {
      error: "Your view could not be updated. Try again.",
      conflictError:
        "You already have a view with that name. Choose another name.",
    });
  return data ? NextResponse.json({ view: data }) : notFound();
}

export async function DELETE(request: Request, context: Context) {
  const authorization = await authorize({ onboarded: true });
  if ("response" in authorization) return authorization.response;
  const id = parseUuid((await context.params).id);
  if (!id) return notFound();
  const parsed = await readJson(request, emptyObjectSchema);
  if ("response" in parsed) return parsed.response;
  const { data, error } = await deleteSavedTaskView(
    authorization.supabase,
    authorization.user.id,
    id,
  );
  if (error)
    return databaseFailure(request, "saved-task-view.delete", error, {
      error: "Your view could not be deleted. Try again.",
    });
  return data ? NextResponse.json({ id: data.id }) : notFound();
}
