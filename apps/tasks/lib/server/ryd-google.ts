import "server-only";

import { createHash } from "node:crypto";
import {
  parseRydFormResponses,
  inspectRydForm,
  type GoogleForm,
  type GoogleFormResponse,
} from "@/lib/ryd/form-responses";
import type { RydSubmission } from "@/lib/ryd/matching";
import { getAdminClient } from "./admin-client";
import {
  createGoogleOAuthRequest,
  encryptGoogleRefreshToken,
  exchangeGoogleAuthorizationCode,
  googleAccessToken,
  googleJson,
  googleRequestSignal,
  isGoogleOAuthConfigured,
  revokeGoogleRefreshToken,
} from "./google-oauth";
import { createRydGoogleReadCache } from "./ryd-google-read-cache";

/**
 * The Google account that owns the RY-dentification form. It is a separate
 * connection from the workspace calendar: the form's owner is often not the
 * calendar's, and this one needs to read the form and its responses, open the
 * files people uploaded through it.
 *
 * `drive.readonly` is a restricted scope. Keep the OAuth client in Testing (or
 * Internal) with the form owner listed as a test user; publishing it would
 * need Google's verification.
 */
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/forms.body.readonly",
  "https://www.googleapis.com/auth/forms.responses.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
] as const;

export const RYD_GOOGLE_CALLBACK = "/api/integrations/ryd-google/callback";
export const RYD_GOOGLE_COOKIE = "tasks_ryd_google_oauth";
export const RYD_GOOGLE_INTEGRATION_ID = "ryd_google";
const SERVICE = "Google Forms";
const FORMS_URL = "https://forms.googleapis.com/v1/forms";
const DRIVE_URL = "https://www.googleapis.com/drive/v3/files";

export type RydGoogleIntegrationRow = {
  id: string;
  encrypted_refresh_token: string;
  account_email: string;
  connected_by: string;
  connected_at: string;
  updated_at: string;
};

export const isRydGoogleConfigured = isGoogleOAuthConfigured;

export function createRydGoogleOAuthRequest(request: Request) {
  return createGoogleOAuthRequest(request, {
    scopes: SCOPES,
    callbackPath: RYD_GOOGLE_CALLBACK,
  });
}

export function exchangeRydGoogleCode(
  request: Request,
  code: string,
  verifier: string,
) {
  return exchangeGoogleAuthorizationCode(
    request,
    code,
    verifier,
    RYD_GOOGLE_CALLBACK,
  );
}

/** Whether Google granted every scope asked for; the consent screen lets people untick some. */
export function hasRydGoogleScopes(granted: string | undefined) {
  const scopes = new Set(granted?.split(/\s+/));
  return SCOPES.slice(2).every((scope) => scopes.has(scope));
}

export function rydGoogleIntegrationValues(
  refreshToken: string,
  email: string,
  connectedBy: string,
) {
  const now = new Date().toISOString();
  return {
    id: RYD_GOOGLE_INTEGRATION_ID,
    encrypted_refresh_token: encryptGoogleRefreshToken(refreshToken),
    account_email: email,
    connected_by: connectedBy,
    connected_at: now,
    updated_at: now,
  };
}

export async function loadRydGoogleIntegration() {
  const admin = getAdminClient();
  if (!admin) return null;
  const result = await admin
    .from("ryd_google_integrations")
    .select("*")
    .eq("id", RYD_GOOGLE_INTEGRATION_ID)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data as RydGoogleIntegrationRow | null;
}

export function revokeRydGoogle(connection: RydGoogleIntegrationRow) {
  return revokeGoogleRefreshToken(connection.encrypted_refresh_token, SERVICE);
}

// No Next cache, database storage, or media retention. Keys include the current
// credential and connection revision; callers still authorize every request.
const tokens = createRydGoogleReadCache<string>({ ttlMs: 10_000, maxEntries: 4 });
const forms = createRydGoogleReadCache<RydFormRead>({
  ttlMs: 10_000,
  maxEntries: 2,
  // Large forms still share an in-flight read, without retaining its result.
  retain: (value) => Buffer.byteLength(JSON.stringify(value)) <= 4 * 1024 * 1024,
});

function connectionKey(connection: RydGoogleIntegrationRow) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        connection.id,
        connection.encrypted_refresh_token,
        connection.updated_at,
        connection.connected_at,
      ]),
    )
    .digest("hex");
}

function token(connection: RydGoogleIntegrationRow, signal?: AbortSignal) {
  return tokens.read(
    connectionKey(connection),
    (sharedSignal) =>
      googleAccessToken(connection.encrypted_refresh_token, SERVICE, sharedSignal),
    { signal },
  );
}

type ResponsePage = {
  responses?: GoogleFormResponse[];
  nextPageToken?: string;
};

async function readForm(accessToken: string, formId: string, signal: AbortSignal) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const base = `${FORMS_URL}/${encodeURIComponent(formId)}`;
  const form = await googleJson<GoogleForm>(base, { headers, signal }, SERVICE);
  const responses: GoogleFormResponse[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${base}/responses`);
    url.searchParams.set("pageSize", "5000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const page = await googleJson<ResponsePage>(
      url.toString(),
      { headers, signal },
      SERVICE,
    );
    responses.push(...(page.responses ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return { form, responses };
}

type RydFormRead = {
  submissions: RydSubmission[];
  title: string;
  warnings: string[];
};

export type RydGoogleReadOptions = { signal?: AbortSignal; fresh?: boolean };

/** Live Google responses with at most ten seconds of process-local reuse. */
export async function readRydSubmissions(
  connection: RydGoogleIntegrationRow,
  formId: string,
  options: RydGoogleReadOptions = {},
) {
  return forms.read(
    JSON.stringify([connectionKey(connection), formId]),
    async (sharedSignal) => {
      // One deadline bounds the token refresh and every response page together.
      const signal = googleRequestSignal(sharedSignal, 25_000);
      const { form, responses } = await readForm(
        await token(connection, signal),
        formId,
        signal,
      );
      return {
        submissions: parseRydFormResponses(form, responses),
        title:
          form.info?.title || form.info?.documentTitle || "RY-dentification form",
        warnings: inspectRydForm(form).warnings,
      };
    },
    options,
  );
}

const INLINE_TYPES =
  /^(image\/(png|jpeg|gif|webp|heic|heif)|application\/pdf)$/;

/** A file someone uploaded through the form, streamed through the app. */
export async function fetchRydEvidence(
  connection: RydGoogleIntegrationRow,
  fileId: string,
  requestSignal?: AbortSignal,
) {
  // This deadline stays attached through the streamed media body.
  const signal = googleRequestSignal(requestSignal, 30_000);
  const accessToken = await token(connection, signal);
  const meta = await googleJson<{ name?: string; mimeType?: string }>(
    `${DRIVE_URL}/${encodeURIComponent(fileId)}?fields=name,mimeType&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` }, signal },
    "Google Drive",
  );
  const response = await fetch(
    `${DRIVE_URL}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal,
    },
  );
  if (!response.ok || !response.body)
    throw new Error("Google Drive could not return that file.");
  const mimeType = meta.mimeType ?? "application/octet-stream";
  return {
    body: response.body,
    name: meta.name ?? fileId,
    // Anything the browser could execute or render as a page is downloaded
    // instead of displayed. People chose what to upload, not us.
    mimeType: INLINE_TYPES.test(mimeType)
      ? mimeType
      : "application/octet-stream",
    inline: INLINE_TYPES.test(mimeType),
  };
}
