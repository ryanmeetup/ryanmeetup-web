import { NextResponse } from "next/server";
import { savedTaskViewCreateSchema } from "@/lib/api-schema";
import { authorize } from "@/lib/server/auth";
import { readJson } from "@/lib/server/request";
import { databaseFailure } from "@/lib/server/api-response";
import { createSavedTaskView } from "@/lib/server/saved-task-views";

export async function POST(request: Request) {
  const authorization = await authorize({ onboarded: true });
  if ("response" in authorization) return authorization.response;
  const parsed = await readJson(request, savedTaskViewCreateSchema);
  if ("response" in parsed) return parsed.response;
  const { data, error } = await createSavedTaskView(
    authorization.supabase,
    authorization.user.id,
    parsed.data,
  );
  if (error)
    return databaseFailure(request, "saved-task-view.create", error, {
      error: "Your view could not be saved. Try again.",
      conflictError:
        "You already have a view with that name. Choose another name.",
    });
  return NextResponse.json({ view: data }, { status: 201 });
}
