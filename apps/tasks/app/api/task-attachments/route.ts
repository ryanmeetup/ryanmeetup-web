import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/server/admin-client";
import { databaseFailure, logServerFailure } from "@/lib/server/api-response";
import { authorize } from "@/lib/server/auth";
import {
  detectAttachmentMimeType,
  MAX_ATTACHMENT_SIZE,
} from "@/lib/tasks/task-attachments";
import { attachmentUrlName } from "@/lib/tasks/task-attachment-urls";
import { taskLinkAttachmentSchema } from "@/lib/api-schema";
import { readJson } from "@/lib/server/request";

export const runtime = "nodejs";

async function removeObject(path: string) {
  const admin = getAdminClient();
  if (!admin) return new Error("Attachment Storage cleanup is unavailable.");

  const { error } = await admin.storage.from("task-attachments").remove([path]);
  return error;
}

export async function POST(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;
  const { supabase, user } = authorization;

  const isJson = request.headers
    .get("content-type")
    ?.includes("application/json");
  let payload: ReturnType<typeof taskLinkAttachmentSchema> = null;
  if (isJson) {
    const parsed = await readJson(request, taskLinkAttachmentSchema);
    if ("response" in parsed) return parsed.response;
    payload = parsed.data;
  }
  const formData = isJson ? null : await request.formData();
  const taskId = payload?.taskId ?? formData?.get("taskId");
  const file = formData?.get("file");
  const externalUrl = payload?.url ?? null;
  if (
    typeof taskId !== "string" ||
    (isJson ? !externalUrl : !(file instanceof File))
  )
    return NextResponse.json(
      {
        error: isJson
          ? "A task and valid URL are required."
          : "A task and file are required.",
      },
      { status: 400 },
    );
  if (
    file instanceof File &&
    (file.size === 0 || file.size > MAX_ATTACHMENT_SIZE)
  )
    return NextResponse.json(
      { error: "Files must be between 1 byte and 10 MB." },
      { status: 413 },
    );

  const { data: canEdit, error: permissionError } = await supabase.rpc(
    "can_edit_task",
    { requested_task_id: taskId },
  );
  if (permissionError || !canEdit)
    return NextResponse.json(
      { error: "You cannot attach files to this task." },
      { status: 403 },
    );

  if (externalUrl) {
    const id = crypto.randomUUID();
    const name = attachmentUrlName(externalUrl, payload?.title);
    const attachment = {
      id,
      task_id: taskId,
      name,
      url: externalUrl,
      file_path: null,
      mime_type: null,
      size_bytes: null,
      created_by: user.id,
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("task_attachments")
      .insert(attachment);
    if (error)
      return databaseFailure(request, "attachment.record", error, {
        error: "The URL attachment could not be saved. Try again.",
      });
    const { data: activity, error: activityError } = await supabase
      .from("task_activity")
      .insert({
        task_id: taskId,
        actor_id: user.id,
        action: `attached “${name}”`,
        details: { attachment_id: id },
      })
      .select("*")
      .single();
    if (activityError)
      logServerFailure(request, "attachment.activity", activityError);
    return NextResponse.json({ attachment, activity });
  }

  if (!(file instanceof File))
    return NextResponse.json({ error: "A file is required." }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectAttachmentMimeType(bytes);
  if (!mimeType)
    return NextResponse.json(
      { error: "Only PDF, JPEG, PNG, WebP, and plain-text files are allowed." },
      { status: 415 },
    );

  const admin = getAdminClient();
  if (!admin)
    return NextResponse.json(
      { error: "Attachment uploads are unavailable." },
      { status: 503 },
    );

  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${taskId}/${id}-${safeName}`;
  const uploaded = await admin.storage
    .from("task-attachments")
    .upload(path, bytes, { contentType: mimeType, upsert: false });
  if (uploaded.error)
    return databaseFailure(request, "attachment.upload", uploaded.error, {
      error: "The attachment could not be uploaded. Try again.",
    });

  const attachment = {
    id,
    task_id: taskId,
    name: file.name,
    url: "",
    file_path: path,
    mime_type: mimeType,
    size_bytes: file.size,
    created_by: user.id,
    created_at: new Date().toISOString(),
  };
  const { error: rowError } = await supabase
    .from("task_attachments")
    .insert(attachment);
  if (rowError) {
    const cleanupError = await removeObject(path);
    return databaseFailure(request, "attachment.record", rowError, {
      error: "The attachment could not be saved. Try again.",
      relatedFailures: { storageCleanup: cleanupError },
    });
  }

  const signed = await admin.storage
    .from("task-attachments")
    .createSignedUrl(path, 60 * 60);
  if (signed.error) {
    const { error: rowCleanupError } = await supabase
      .from("task_attachments")
      .delete()
      .eq("id", id);
    const objectCleanupError = await removeObject(path);
    return databaseFailure(request, "attachment.sign", signed.error, {
      error: "The attachment was uploaded but could not be opened. Try again.",
      relatedFailures: {
        rowCleanup: rowCleanupError,
        objectCleanup: objectCleanupError,
      },
    });
  }
  const { data: activity, error: activityError } = await supabase
    .from("task_activity")
    .insert({
      task_id: taskId,
      actor_id: user.id,
      action: `attached “${file.name}”`,
      details: { attachment_id: id },
    })
    .select("*")
    .single();
  if (activityError)
    logServerFailure(request, "attachment.activity", activityError);
  return NextResponse.json({
    attachment: { ...attachment, url: signed.data.signedUrl },
    activity,
  });
}

export async function DELETE(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;
  const { supabase, user } = authorization;

  const id = new URL(request.url).searchParams.get("id");
  if (!id)
    return NextResponse.json(
      { error: "An attachment is required." },
      { status: 400 },
    );

  const { data: attachment, error: lookupError } = await supabase
    .from("task_attachments")
    .select("id, task_id, name, file_path")
    .eq("id", id)
    .maybeSingle();
  if (lookupError)
    return databaseFailure(request, "attachment.lookup", lookupError, {
      error: "The attachment could not be found. Refresh and try again.",
    });
  if (!attachment)
    return NextResponse.json(
      { error: "Attachment not found." },
      { status: 404 },
    );

  const { data: canEdit, error: permissionError } = await supabase.rpc(
    "can_edit_task",
    { requested_task_id: attachment.task_id },
  );
  if (permissionError || !canEdit)
    return NextResponse.json(
      { error: "You cannot remove files from this task." },
      { status: 403 },
    );

  const { error: rowError } = await supabase
    .from("task_attachments")
    .delete()
    .eq("id", id);
  if (rowError)
    return databaseFailure(request, "attachment.delete", rowError, {
      error: "The attachment could not be removed. Try again.",
    });

  const { data: activity, error: activityError } = await supabase
    .from("task_activity")
    .insert({
      task_id: attachment.task_id,
      actor_id: user.id,
      action: `removed attachment “${attachment.name}”`,
      details: { attachment_id: attachment.id },
    })
    .select("*")
    .single();
  if (activityError)
    return databaseFailure(request, "attachment.activity", activityError, {
      error:
        "The attachment was removed, but its activity could not be recorded.",
    });

  if (!attachment.file_path)
    return NextResponse.json({ deleted: true, activity });

  const cleanupError = await removeObject(attachment.file_path);
  if (cleanupError) {
    logServerFailure(request, "attachment.cleanup", cleanupError);
  }

  return NextResponse.json({
    deleted: true,
    activity,
    cleanupDeferred: Boolean(cleanupError),
  });
}
