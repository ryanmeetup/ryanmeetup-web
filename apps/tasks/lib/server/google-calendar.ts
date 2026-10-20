import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarEvent } from "@/lib/calendar/calendar-types";
import {
  WORKSPACE_TIME_ZONE,
  workspaceGoogleEventBody,
  workspaceGoogleEventId,
} from "@/lib/calendar/google-calendar-sync";
import type {
  GoogleCalendarConnection,
  GoogleCalendarEvent,
} from "@/lib/calendar/google-calendar-types";
import {
  googleAttachments,
  googleAttendees,
  googleConferenceEntries,
  googleEventDescription,
  type GoogleAttendeeSource,
  type GoogleConferenceSource,
} from "@/lib/calendar/google-event-details";
import { getAdminClient } from "./admin-client";
import {
  createGoogleOAuthRequest as createOAuthRequest,
  encryptGoogleRefreshToken,
  exchangeGoogleAuthorizationCode as exchangeAuthorizationCode,
  googleAccessToken,
  googleJson as sharedGoogleJson,
  googleOAuthConfiguration,
  googleRedirectUri,
  isGoogleOAuthConfigured,
  revokeGoogleRefreshToken,
} from "./google-oauth";

export { encryptGoogleRefreshToken };
export {
  decryptGoogleRefreshToken,
  googleAccountEmail,
  parseGoogleOAuthCookie,
} from "./google-oauth";

const GOOGLE_CALENDAR_URL = "https://www.googleapis.com/calendar/v3";
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events.owned",
];

const GOOGLE_CALENDAR_CALLBACK = "/api/integrations/google-calendar/callback";

export const GOOGLE_OAUTH_COOKIE = "tasks_google_calendar_oauth";
export const GOOGLE_CALENDAR_INTEGRATION_ID = "google_calendar";

export type GoogleCalendarIntegrationRow = {
  id: string;
  encrypted_refresh_token: string;
  account_email: string;
  calendar_id: string;
  connected_by: string;
  connected_at: string;
  updated_at: string;
};

type GoogleEvent = GoogleConferenceSource & {
  id?: string;
  status?: string;
  recurringEventId?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  eventType?: string;
  organizer?: { email?: string; displayName?: string; self?: boolean };
  attendees?: GoogleAttendeeSource[];
  attachments?: { title?: string; fileUrl?: string }[];
  workingLocationProperties?: { type?: string };
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

type GoogleEventList = {
  items?: GoogleEvent[];
  nextPageToken?: string;
};

export function isVisibleGoogleCalendarEvent(event: {
  eventType?: string;
  summary?: string;
  workingLocationProperties?: { type?: string };
}) {
  return !(
    event.eventType === "workingLocation" &&
    (event.workingLocationProperties?.type === "homeOffice" ||
      event.summary?.trim().toLowerCase() === "home")
  );
}

function configuration() {
  const config = googleOAuthConfiguration();
  if (!config) return null;
  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim() || "primary";
  return { ...config, calendarId };
}

export function isGoogleCalendarConfigured() {
  return isGoogleOAuthConfigured();
}

export function configuredGoogleCalendarId() {
  return configuration()?.calendarId ?? "primary";
}

export function googleCalendarRedirectUri(request?: Request | string) {
  return googleRedirectUri(GOOGLE_CALENDAR_CALLBACK, request);
}

export function googleCalendarConnection(
  row: GoogleCalendarIntegrationRow | null,
): GoogleCalendarConnection {
  return row
    ? {
        connected: true,
        email: row.account_email,
        connectedAt: row.connected_at,
        calendarId: row.calendar_id,
      }
    : { connected: false };
}

export function googleCalendarIntegrationValues(
  refreshToken: string,
  email: string,
  connectedBy: string,
) {
  const now = new Date().toISOString();
  return {
    id: GOOGLE_CALENDAR_INTEGRATION_ID,
    encrypted_refresh_token: encryptGoogleRefreshToken(refreshToken),
    account_email: email,
    calendar_id: configuredGoogleCalendarId(),
    connected_by: connectedBy,
    connected_at: now,
    updated_at: now,
  };
}

export async function loadGoogleCalendarIntegration() {
  const admin = getAdminClient();
  if (!admin) return null;
  const result = await admin
    .from("workspace_google_calendar_integrations")
    .select("*")
    .eq("id", GOOGLE_CALENDAR_INTEGRATION_ID)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data as GoogleCalendarIntegrationRow | null;
}

export async function canViewWorkspaceGoogleCalendar(supabase: SupabaseClient) {
  const result = await supabase.rpc("can_view_workspace_calendar");
  if (result.error) throw result.error;
  return result.data === true;
}

export function createGoogleOAuthRequest(request: Request) {
  return createOAuthRequest(request, {
    scopes: GOOGLE_SCOPES,
    callbackPath: GOOGLE_CALENDAR_CALLBACK,
  });
}

function googleJson<T>(url: string, init: RequestInit) {
  return sharedGoogleJson<T>(url, init, "Google Calendar");
}

export function exchangeGoogleAuthorizationCode(
  request: Request,
  code: string,
  verifier: string,
) {
  return exchangeAuthorizationCode(
    request,
    code,
    verifier,
    GOOGLE_CALENDAR_CALLBACK,
  );
}

function accessToken(connection: GoogleCalendarIntegrationRow) {
  return googleAccessToken(
    connection.encrypted_refresh_token,
    "Google Calendar",
  );
}

function addUtcDays(date: string, amount: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function googleCalendarMonthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(Date.UTC(year, monthNumber, 8));
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * The metadata the details dialog shows in place of sending a reader straight
 * to Google. Descriptions arrive as HTML and guest lists arrive unbounded, so
 * both are normalized and capped here rather than passed through, and a field
 * Google left empty is dropped instead of travelling as an empty value.
 */
export function googleCalendarEventDetails(event: GoogleEvent) {
  const organizerName = event.organizer?.displayName?.trim();
  const organizerEmail = event.organizer?.email?.trim();
  const conference = googleConferenceEntries(event);
  const attachments = googleAttachments(event.attachments);
  return {
    ...googleEventDescription(event.description),
    ...googleAttendees(event.attendees, { location: event.location }),
    location: event.location?.trim() || undefined,
    tentative: event.status === "tentative" || undefined,
    organizer:
      organizerName || organizerEmail
        ? {
            name: organizerName || undefined,
            email: organizerEmail || undefined,
          }
        : undefined,
    conference: conference.length ? conference : undefined,
    attachments: attachments.length ? attachments : undefined,
  };
}

export async function listGoogleCalendarEvents(
  connection: GoogleCalendarIntegrationRow,
  month: string,
) {
  const range = googleCalendarMonthRange(month);
  if (!range) return [];
  const token = await accessToken(connection);
  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;
  do {
    const calendarId = encodeURIComponent(connection.calendar_id);
    const url = new URL(
      `${GOOGLE_CALENDAR_URL}/calendars/${calendarId}/events`,
    );
    url.search = new URLSearchParams({
      timeMin: range.start,
      timeMax: range.end,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500",
      // Asking for the workspace zone means an imported time is the same wall
      // clock the calendar labels it with, whatever zone the connected
      // calendar itself is set to.
      timeZone: WORKSPACE_TIME_ZONE,
      ...(pageToken ? { pageToken } : {}),
    }).toString();
    const page = await googleJson<GoogleEventList>(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    for (const event of page.items ?? []) {
      if (
        event.status === "cancelled" ||
        !isVisibleGoogleCalendarEvent(event) ||
        !event.id ||
        !event.start ||
        !event.end
      )
        continue;
      const allDay = Boolean(event.start.date);
      const start = event.start.date ?? event.start.dateTime?.slice(0, 10);
      const rawEnd = event.end.date ?? event.end.dateTime?.slice(0, 10);
      if (!start || !rawEnd) continue;
      events.push({
        id: event.id,
        title: event.summary?.trim() || "Busy",
        start,
        end: allDay ? addUtcDays(rawEnd, -1) : rawEnd,
        allDay,
        // Google returns a timed event in the calendar's own zone, so the
        // wall-clock part is already the time a reader expects to see.
        startTime: allDay ? undefined : event.start.dateTime?.slice(11, 16),
        endTime: allDay ? undefined : event.end.dateTime?.slice(11, 16),
        htmlLink: event.htmlLink,
        recurringEventId: event.recurringEventId,
        ...googleCalendarEventDetails(event),
      });
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return events;
}

function eventUrl(connection: GoogleCalendarIntegrationRow, eventId?: string) {
  const calendarId = encodeURIComponent(connection.calendar_id);
  const base = `${GOOGLE_CALENDAR_URL}/calendars/${calendarId}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}

async function googleWrite(
  url: string,
  token: string,
  method: string,
  body?: unknown,
  handled: number[] = [],
) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  if (!response.ok && !handled.includes(response.status))
    console.error("Google Calendar write failed", {
      method,
      status: response.status,
      body: (await response.text()).slice(0, 500),
    });
  return response;
}

// The published copy uses an ID derived from the workspace event, so writing it
// is an upsert: insert first, then fall back to updating an existing copy.
export async function publishWorkspaceEventToGoogle(
  connection: GoogleCalendarIntegrationRow,
  event: CalendarEvent,
) {
  const token = await accessToken(connection);
  const id = workspaceGoogleEventId(event.id);
  const body = workspaceGoogleEventBody(event);
  const created = await googleWrite(
    eventUrl(connection),
    token,
    "POST",
    { id, ...body },
    [409],
  );
  if (created.ok) return;
  if (created.status !== 409)
    throw new Error("Google Calendar could not be updated.");
  // A 409 means the copy already exists, including one cancelled by an earlier
  // removal, so the update restores it to the workspace values.
  const updated = await googleWrite(eventUrl(connection, id), token, "PUT", {
    ...body,
    status: "confirmed",
  });
  if (!updated.ok) throw new Error("Google Calendar could not be updated.");
}

export async function removeWorkspaceEventFromGoogle(
  connection: GoogleCalendarIntegrationRow,
  eventId: string,
) {
  const token = await accessToken(connection);
  const response = await googleWrite(
    eventUrl(connection, workspaceGoogleEventId(eventId)),
    token,
    "DELETE",
    undefined,
    [404, 410],
  );
  // A copy that is already gone is the intended end state.
  if (!response.ok && response.status !== 404 && response.status !== 410)
    throw new Error("Google Calendar could not be updated.");
}

// Reconciles the published copy with what the author asked for. Returns a
// warning when the workspace row was saved but Google was left untouched.
export async function syncWorkspaceEventToGoogle(
  supabase: SupabaseClient,
  event: CalendarEvent,
  publish: boolean,
) {
  let allowed = false;
  try {
    allowed = await canViewWorkspaceGoogleCalendar(supabase);
  } catch (error) {
    console.error("Google Calendar permission could not be resolved", error);
  }
  if (!allowed)
    return publish
      ? "You do not have access to the workspace Google Calendar."
      : null;
  const connection = await loadGoogleCalendarIntegration();
  if (!connection)
    return publish ? "No workspace Google Calendar is connected." : null;
  if (publish) await publishWorkspaceEventToGoogle(connection, event);
  else await removeWorkspaceEventFromGoogle(connection, event.id);
  return null;
}

export async function revokeGoogleCalendar(
  connection: GoogleCalendarIntegrationRow,
) {
  await revokeGoogleRefreshToken(
    connection.encrypted_refresh_token,
    "Google Calendar",
  );
}

/**
 * Who may see and manage the workspace Google Calendar on this request, plus
 * the connection row that answers "is it connected, and as whom".
 *
 * Shared by the calendar page and the calendar editor routes so they agree on
 * whether to offer publishing. Every Google failure is logged and degraded to
 * "not connected" rather than thrown: the calendar and its editor must still
 * work when Google does not.
 */
export async function loadGoogleCalendarAccess(
  supabase: SupabaseClient,
  {
    owner,
    preview,
  }: {
    owner: boolean;
    /**
     * The active access preview, when there is one. A preview is read-only, so
     * it never manages the connection and its own grant decides what it sees.
     * Pass the preview itself rather than its flag: a preview whose
     * `calendarAccess` is undefined is still a preview.
     */
    preview?: { calendarAccess?: boolean } | null;
  },
) {
  const googleCanManage = !preview && owner;
  let googleCanView = googleCanManage;
  if (preview) {
    googleCanView = preview.calendarAccess === true;
  } else if (!googleCanView) {
    try {
      googleCanView = await canViewWorkspaceGoogleCalendar(supabase);
    } catch (error) {
      console.error("Google Calendar permission could not be resolved", error);
    }
  }
  let integration = null;
  if (googleCanView || googleCanManage) {
    try {
      integration = await loadGoogleCalendarIntegration();
    } catch (error) {
      console.error("Google Calendar connection could not be loaded", error);
    }
  }
  return {
    googleCanManage,
    googleCanView,
    integration,
    googleConnection: googleCalendarConnection(integration),
  };
}
