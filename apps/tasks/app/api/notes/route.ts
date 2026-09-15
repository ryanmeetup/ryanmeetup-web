import { NextResponse } from "next/server";
import {
  isJsonObject,
  isUuid,
  requiredTrimmedText,
} from "@/lib/api-schema/shared";
import { noteColumns } from "@/lib/resources/notes";
import { databaseFailure } from "@/lib/server/api-response";
import { authorize } from "@/lib/server/auth";
import { readJson } from "@/lib/server/request";

export async function POST(request: Request) {
  const parsed = await readJson(request, (value) =>
    isJsonObject(value)
      ? (value as {
          body?: unknown;
          title?: unknown;
          categoryId?: unknown;
        })
      : null,
  );
  if ("response" in parsed) return parsed.response;
  const authorization = await authorize({ onboarded: true, area: "notes" });
  if ("response" in authorization) return authorization.response;
  const input = parsed.data;
  const body = requiredTrimmedText(input.body, 10000);
  const title = requiredTrimmedText(input.title, 200);
  const categoryId =
    input.categoryId == null || input.categoryId === ""
      ? null
      : input.categoryId;
  if (
    !title ||
    !body ||
    (categoryId !== null && !isUuid(categoryId))
  )
    return NextResponse.json(
      {
        error:
          "Add a title of 200 characters or fewer and a note of 10,000 characters or fewer.",
      },
      { status: 400 },
    );
  const result = await authorization.supabase
    .from("notes")
    .insert({
      body,
      title,
      category_id: categoryId,
      created_by: authorization.user.id,
    })
    .select(noteColumns)
    .single();
  if (result.error)
    return databaseFailure(request, "note.create", result.error, {
      error: "The note could not be saved.",
    });
  return NextResponse.json({ note: result.data });
}

export async function PATCH(request: Request) {
  const parsed = await readJson(request, (value) =>
    isJsonObject(value)
      ? (value as {
          id?: unknown;
          body?: unknown;
          title?: unknown;
          archived?: unknown;
          convertedTaskId?: unknown;
          convertedProjectId?: unknown;
        })
      : null,
  );
  if ("response" in parsed) return parsed.response;
  const authorization = await authorize({ onboarded: true, area: "notes" });
  if ("response" in authorization) return authorization.response;
  const input = parsed.data;
  if (!isUuid(input.id))
    return NextResponse.json({ error: "A note is required." }, { status: 400 });
  const values: Record<string, string | null> = {};
  if (input.body !== undefined) {
    const body = requiredTrimmedText(input.body, 10000);
    if (!body)
      return NextResponse.json(
        { error: "A note cannot be empty." },
        { status: 400 },
      );
    values.body = body;
  }
  if (input.title !== undefined) {
    const title = requiredTrimmedText(input.title, 200);
    if (!title)
      return NextResponse.json(
        {
          error:
            "Add a note title of 200 characters or fewer before saving.",
        },
        { status: 400 },
      );
    values.title = title;
  }
  if (typeof input.archived === "boolean")
    values.archived_at = input.archived ? new Date().toISOString() : null;
  if (isUuid(input.convertedTaskId))
    values.converted_task_id = input.convertedTaskId;
  if (isUuid(input.convertedProjectId))
    values.converted_project_id = input.convertedProjectId;
  if (Object.keys(values).length === 0)
    return NextResponse.json(
      { error: "No note changes were provided." },
      { status: 400 },
    );
  const result = await authorization.supabase
    .from("notes")
    .update(values)
    .eq("id", input.id)
    .select(noteColumns)
    .single();
  if (result.error)
    return databaseFailure(request, "note.update", result.error, {
      error: "The note could not be updated.",
    });
  return NextResponse.json({ note: result.data });
}

export async function DELETE(request: Request) {
  const parsed = await readJson(request, (value) =>
    isJsonObject(value) && isUuid(value.id) ? (value as { id: string }) : null,
  );
  if ("response" in parsed) return parsed.response;
  const authorization = await authorize({ onboarded: true, area: "notes" });
  if ("response" in authorization) return authorization.response;
  const result = await authorization.supabase
    .from("notes")
    .delete()
    .eq("id", parsed.data.id)
    .select(noteColumns)
    .single();
  if (result.error)
    return databaseFailure(request, "note.delete", result.error, {
      error: "The note could not be deleted.",
    });
  return NextResponse.json({ ok: true });
}
