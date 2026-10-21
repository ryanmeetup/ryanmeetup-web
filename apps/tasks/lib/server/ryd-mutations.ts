import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { apiError, databaseFailure } from "./api-response";
import { loadRydSettings } from "./ryd";
import { loadRydGoogleIntegration, readRydSubmissions } from "./ryd-google";
import { isMissingFunction } from "./supabase-errors";

/** Only these authored SQL errors are safe to show; other failures stay private. */
export function rydMutationFailure(
  request: Request,
  operation: string,
  error: unknown,
  message: string,
) {
  const failure = error as { code?: string; message?: string };
  if (isMissingFunction(failure.code))
    return apiError(
      503,
      "SERVICE_UNAVAILABLE",
      "RY-D needs a pending database update before this operation is available.",
    );
  if (failure.code === "RY409")
    return apiError(409, "CONFLICT", failure.message ?? message);
  if (failure.code === "RY404")
    return apiError(404, "NOT_FOUND", failure.message ?? message);
  if (failure.code === "RY400")
    return apiError(400, "INVALID_REQUEST", failure.message ?? message);
  return databaseFailure(request, operation, failure, { error: message });
}

/** Check Google provenance before accepting new persisted response references. */
export async function rydSubmissionForm(admin: SupabaseClient, keys: string[]) {
  const [settings, integration] = await Promise.all([
    loadRydSettings(admin),
    loadRydGoogleIntegration(),
  ]);
  if (!settings.formId || !integration)
    throw {
      code: "RY409",
      message:
        "Connect the verification form before linking or removing responses.",
    };
  const { submissions } = await readRydSubmissions(
    integration,
    settings.formId,
    { fresh: true },
  );
  const known = new Set(submissions.map((submission) => submission.key));
  if (keys.some((key) => !known.has(key)))
    throw {
      code: "RY409",
      message:
        "A response is no longer in the configured form. Refresh and choose it again.",
    };
  return settings.formId;
}

export async function changeRydSubmission(
  admin: SupabaseClient,
  actor: string,
  action: "link" | "unlink" | "dismiss" | "restore",
  key: string,
  orderId: string | null = null,
  source: "manual" | "suggested" = "manual",
) {
  // Removing a pairing must still work if its response was deleted in Google.
  const formId =
    action === "link" || action === "dismiss"
      ? await rydSubmissionForm(admin, [key])
      : (await loadRydSettings(admin)).formId;
  const result = await admin.rpc("ryd_change_submission", {
    requested_actor: actor,
    requested_order: orderId,
    requested_key: key,
    requested_action: action,
    requested_form: formId,
    requested_source: source,
  });
  if (result.error) throw result.error;
  return result.data as { ok: true; changed: boolean };
}

/** All of a submitter's responses link together or none of them do. */
export async function linkRydSubmissions(
  admin: SupabaseClient,
  actor: string,
  orderId: string,
  keys: string[],
  source: "manual" | "suggested",
) {
  const formId = await rydSubmissionForm(admin, keys);
  const result = await admin.rpc("ryd_link_submissions", {
    requested_actor: actor,
    requested_order: orderId,
    requested_keys: keys,
    requested_form: formId,
    requested_source: source,
  });
  if (result.error) throw result.error;
  return result.data as { ok: true; changed: boolean };
}

export async function reviewRydOrder(
  admin: SupabaseClient,
  actor: string,
  orderId: string,
  patch: {
    status?: string;
    note?: string | null;
    expectedStatus?: string;
    expectedUpdatedAt?: string;
  },
  keys: string[],
) {
  const formId = keys.length ? await rydSubmissionForm(admin, keys) : null;
  const result = await admin.rpc("ryd_review_order", {
    requested_actor: actor,
    requested_order: orderId,
    requested_patch: patch,
    requested_form: formId,
    requested_keys: keys,
  });
  if (result.error) throw result.error;
  return result.data;
}
