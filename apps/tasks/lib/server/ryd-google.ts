import "server-only";

import { parseRydSubmissions } from "@/lib/ryd/submissions";
import { getAdminClient } from "./admin-client";
import {
  createGoogleOAuthRequest,
  encryptGoogleRefreshToken,
  exchangeGoogleAuthorizationCode,
  googleAccessToken,
  googleJson,
  isGoogleOAuthConfigured,
  revokeGoogleRefreshToken,
} from "./google-oauth";

/**
 * The Google account that owns the RY-dentification form. It is a separate
 * connection from the workspace calendar: the form's owner is often not the
 * calendar's, and this one needs to read the response sheet, tick its
 * `Verified?` column, and open the files people uploaded through the form.
 *
 * `drive.readonly` is a restricted scope. Keep the OAuth client in Testing (or
 * Internal) with the form owner listed as a test user; publishing it would
 * need Google's verification.
 */
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.readonly",
] as const;

export const RYD_GOOGLE_CALLBACK = "/api/integrations/ryd-google/callback";
export const RYD_GOOGLE_COOKIE = "tasks_ryd_google_oauth";
export const RYD_GOOGLE_INTEGRATION_ID = "ryd_google";
const SERVICE = "Google Sheets";
const SHEETS_URL = "https://sheets.googleapis.com/v4/spreadsheets";
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

function token(connection: RydGoogleIntegrationRow) {
  return googleAccessToken(connection.encrypted_refresh_token, SERVICE);
}

type SheetValues = { values?: string[][] };
type SpreadsheetMeta = { sheets?: { properties?: { title?: string } }[] };

/** The responses tab is the first one: Forms always writes there. */
async function firstSheetTitle(accessToken: string, spreadsheetId: string) {
  const meta = await googleJson<SpreadsheetMeta>(
    `${SHEETS_URL}/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    SERVICE,
  );
  const title = meta.sheets?.[0]?.properties?.title;
  if (!title) throw new Error("The RY-dentification sheet has no tabs.");
  return title;
}

function a1Sheet(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

/** Read every form response, live. Nothing from the sheet is stored. */
export async function readRydSubmissions(
  connection: RydGoogleIntegrationRow,
  spreadsheetId: string,
) {
  const accessToken = await token(connection);
  const title = await firstSheetTitle(accessToken, spreadsheetId);
  const sheet = await googleJson<SheetValues>(
    `${SHEETS_URL}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(a1Sheet(title))}?valueRenderOption=FORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    SERVICE,
  );
  const parsed = parseRydSubmissions(sheet.values ?? []);
  if (!parsed)
    throw new Error(
      "The first tab of that sheet doesn't look like the RY-dentification form responses.",
    );
  return { ...parsed, sheetTitle: title };
}

function columnLetter(index: number) {
  let letter = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
  return letter;
}

/**
 * Tick `Verified?` on the given sheet rows. Rows are re-read immediately
 * before writing, by submission key, so a sheet sorted since the page loaded
 * still gets the tick on the right person.
 */
export async function markRydSubmissionsVerified(
  connection: RydGoogleIntegrationRow,
  spreadsheetId: string,
  submissionKeys: ReadonlySet<string>,
) {
  if (!submissionKeys.size) return 0;
  const { columns, submissions, sheetTitle } = await readRydSubmissions(
    connection,
    spreadsheetId,
  );
  if (columns.verified < 0) return 0;
  const rows = submissions.filter(
    (submission) => submissionKeys.has(submission.key) && !submission.verified,
  );
  if (!rows.length) return 0;
  const accessToken = await token(connection);
  const column = columnLetter(columns.verified);
  await googleJson(
    `${SHEETS_URL}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "RAW",
        data: rows.map((row) => ({
          range: `${a1Sheet(sheetTitle)}!${column}${row.row}`,
          values: [["✅"]],
        })),
      }),
    },
    SERVICE,
  );
  return rows.length;
}

const INLINE_TYPES =
  /^(image\/(png|jpeg|gif|webp|heic|heif)|application\/pdf)$/;

/** A file someone uploaded through the form, streamed through the app. */
export async function fetchRydEvidence(
  connection: RydGoogleIntegrationRow,
  fileId: string,
) {
  const accessToken = await token(connection);
  const meta = await googleJson<{ name?: string; mimeType?: string }>(
    `${DRIVE_URL}/${encodeURIComponent(fileId)}?fields=name,mimeType&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    "Google Drive",
  );
  const response = await fetch(
    `${DRIVE_URL}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
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
