# Google Calendar integration

The Tasks calendar can show events from one Google Calendar connected by a
workspace owner. Google events appear automatically for owners and members of
access groups with **View the workspace Google Calendar** enabled. Imported
event details are fetched from Google and are not copied into the workspace
database. A timed event shows the hours it runs and the zone they are in, such
as `9:00 AM – 10:30 AM EDT`; one that runs past midnight shows only when it
starts. Every imported event comes from the same connected calendar, so tiles
do not repeat which calendar that is.

Every time on the calendar is read and written in one zone, `WORKSPACE_TIME_ZONE`
in `lib/calendar/google-calendar-sync.ts`. Imported events are requested from
Google in that zone rather than the connected calendar's own, so the hours on a
tile are the hours the label claims. The zone is resolved per date, so a repeat
that crosses a daylight-saving change is labelled correctly on both sides of it.
There is no per-Ryan zone: a Ryan reading from another city sees Eastern hours,
named as such.

Sync is one-way by default: tasks, important dates, and time-away entries
created in this app are never sent to Google automatically.

## Reading an imported event

Clicking an imported tile opens a read-only details dialog rather than leaving
for Google, so the invite can be read in place: the full day and hours, the
description, where it is, the guest list with each reply, any attachments, and
buttons to join the meeting. **Open in Google Calendar** is in the dialog for
anyone who needs to reply to the invite or change it, which this app cannot do.

The details arrive with the month load, so each one is bounded rather than
passed through whole:

- Descriptions are stored by Google as HTML written by whoever created the
  event. They are flattened to text on the server, never rendered as markup, and
  cut past 2000 characters with the dialog saying it shortened them.
- Guest lists are capped at 50 names; the dialog still reports the real head
  count and points at Google for the rest.
- Ways to join come from Google's own conference data, plus the meeting link on
  the event and, when neither offered a room, a known provider's link pasted
  into the location. Only `http`, `https`, and dial-in `tel:` addresses are
  kept.

Everyone who can see the shared calendar sees these details, including guest
email addresses. A calendar with events that should not be read that widely
should not be the one connected here.

## Publishing a workspace date to Google

An important date or time-away entry can be copied to the connected calendar
with **Add to the workspace Google Calendar** in the calendar dialog. The option
appears only when a workspace calendar is connected and the author can already
see it, and it is off unless it is turned on.

The workspace row owns the copy, so the calendar shows a published date once
rather than twice:

- The Google event ID is derived from the workspace event ID, which keeps the
  two calendars reconcilable without storing a second identifier.
- Saving an edit republishes the copy; clearing the option or deleting the date
  removes it from Google.
- The workspace row is saved first. When Google cannot be reached, the save
  still succeeds and the dialog reports that Google was not updated.

A repeating date is published as one Google event carrying an `RRULE` rather
than a copy per date, and the instances Google returns for it are recognized by
the series they name. See `docs/CALENDAR_RECURRENCE.md`.

A published copy follows Google's sharing, not workspace scoping. A date scoped
to one project or category is still visible in Google to everyone who can see
the connected calendar.

## Google Cloud setup

Each deployment gets its own OAuth client and its own credentials. RMT and PRD
never share one: the client is pinned to a single redirect URI, and a shared
token key would mean one instance's key decrypts the other's stored grant.

1. Create or select a Google Cloud project and enable the Google Calendar API.
2. Add the scopes `openid`, `email`, and
   `https://www.googleapis.com/auth/calendar.events.owned`. In the current
   console these live under **Google Auth Platform → Data Access**, not the
   OAuth consent screen; the calendar scope is not in the filter list, so paste
   it into **Manually add scopes**.
3. Create an OAuth client with application type **Web application**.
4. Add one authorized redirect URI, the deployment's own origin followed by
   `/api/integrations/google-calendar/callback` — so
   `https://tasks.ryanmeetup.com/...` for RMT and
   `https://projects.ryanle.dev/...` for PRD. It must match character for
   character, with no trailing slash. Add
   the equivalent localhost or preview URI only in the corresponding
   environment's OAuth client.

   Leave **Authorized JavaScript origins** empty. The whole flow is server-side
   redirects; no browser code calls Google, so the field is unused and an empty
   row there only blocks the form with "URI must not be empty". Delete the row.

5. Configure these server-only environment variables for the Tasks deployment:

   - `GOOGLE_CALENDAR_CLIENT_ID`
   - `GOOGLE_CALENDAR_CLIENT_SECRET`
   - `GOOGLE_CALENDAR_TOKEN_KEY` — a base64-encoded 32-byte key, generated with
     `openssl rand -base64 32`
   - `GOOGLE_CALENDAR_ID` — optional. Omit it to sync the connected account's
     primary calendar. For a separate calendar, use its calendar ID from Google
     Calendar's **Settings and sharing → Integrate calendar** section.

   `TASKS_APP_URL` must already name the deployment's origin. The redirect URI
   is built from the request origin when it is allowlisted and from
   `TASKS_APP_URL` otherwise, so an instance that does not know its own name
   sends Google a URI that will not match the client.

   Redeploy after adding them. They are read from the build's environment, and
   until `isGoogleCalendarConfigured()` returns true the connect route bounces
   straight back to `/calendar?google=unavailable` without reaching Google.

The token key is generated here, not issued by Google. It is the AES-256-GCM
key that encrypts the Google refresh token before it is stored in the locked
workspace integration table, so the database holds an unusable blob and the key
lives only in the deployment's environment. It must decode to exactly 32 bytes;
a passphrase or a hex key leaves the integration reporting itself unconfigured.

Keep the token key stable. There is no rotation path — the decrypt side
understands only the `v1` envelope it wrote — so changing it invalidates
existing connections, which must then be disconnected and authorized again.

Access tokens are short-lived and are never persisted. Disconnecting revokes the
Google grant and removes the saved connection.

## Publishing status

Under **Audience**, an External app left in **Testing** expires refresh tokens
after seven days. Because the stored refresh token is the only credential the
integration keeps, the calendar works for a week and then quietly stops
returning Google events, long after the setup that caused it. Publish the app
to production.

A personal Google account cannot use **Internal**, so the calendar scope stays
sensitive and unverified production shows a "Google hasn't verified this app"
interstitial — **Advanced → Go to** the deployment origin completes the
connection. Verification only removes the warning and the 100-user cap. While
the app is still in Testing, every account that connects must be listed as a
test user.

## Connect and grant access

1. Deploy the environment variables and sign in to Tasks as an app owner.
2. Open **Calendar** and choose **Connect workspace calendar**. Sign in with the
   Google account that owns the calendar and approve the requested access.
3. Open **Access**, create or edit an access group, and enable **View the
   workspace Google Calendar** for each group that should see Google events.

The callback names why it failed in the URL it returns to, which is the fastest
way to tell a misconfigured client from a rejected grant:

| `/calendar?google=` | Meaning |
| --- | --- |
| `connected` | The refresh token was stored. |
| `unavailable` | Credentials missing, malformed token key, or not yet redeployed. |
| `invalid` | State or cookie mismatch, usually a redirect URI that does not match the client. |
| `auth` | The signed-in user is not an onboarded owner. |
| `refresh-token` | Google returned no refresh token to store. |
| `failed` | The token exchange or the database write threw; the reason is in the server log. |

Owners can always view and manage the connection. Other users see neither the
Google events nor the connection card unless their effective access-group
permissions include calendar access.
