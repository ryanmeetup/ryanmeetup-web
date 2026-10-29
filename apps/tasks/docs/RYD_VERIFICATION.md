# RY-D Verification

Ryan Meetup sells RY-Ds, and buyers prove they are a Ryan through the
RY-dentification form (social links, uploads — never a government ID). Each
week fulfillment sends an order CSV; someone matches it against the form,
ticks who is verified, and sends the file back so fulfillment knows which
orders to start. `/ryd` does that work in one place.

It is a Ryan Meetup-only product workflow: its buyer links and draft signatures
use Ryan Meetup branding, and it stays off on PRD (`projects.ryanle.dev`). The
instance switch supports Ryan Meetup environments; it does not make this a
generic feature for other workspaces. It is **off by default**, turned on from
**/admin/settings → Features**. With it off the page, its sidebar entry, its
Access setting, and every `/api/ryd` route answer as if they don't exist.

## Setting it up on an instance

1. Apply every `supabase/migrations/2026102*_ryd_*.sql` migration, starting
   with `20261021000000_ryd_verification.sql`.
2. In Google Cloud, on the same OAuth client the Calendar uses:
   - enable the **Google Forms**, **Google Sheets**, and **Google Drive** APIs;
   - add the redirect URI
     `https://<instance>/api/integrations/ryd-google/callback`;
   - add the `forms.body.readonly`, `forms.responses.readonly`,
     `spreadsheets`, and `drive.readonly` scopes to the consent screen.

   `drive.readonly` is a restricted scope: keep the client in Testing (or
   Internal) with the form owner as a test user.
3. Turn on **RY-D Verification** in /admin/settings → Features.
4. On /ryd → Settings, connect Google **as the account that owns the form**,
   paste the form's **editor** link (`docs.google.com/forms/d/<id>/edit`, not
   the public `/forms/d/e/…` one), and enter fulfillment's email so their
   draft is addressed.
5. Add the people who verify to the **RY-D** team from /admin/access. The
   access-group migration selects this team and administrator tiers (R-Suite
   on Ryan Meetup); higher tiers inherit those grants, and app owners retain
   access. On an empty database with no owner yet, create the RY-D team and
   select it alongside administrator tiers for the page from /admin/access.
   Everyone with page access can operate the queue. Changing RY-D settings
   and connecting or disconnecting Google also needs **RY-D Settings**, which
   is fixed to app owners and tiers with workspace-wide content access
   (R-Suite on Ryan Meetup). It has no group selection, so a team or a
   partner's guest tier can work the queue without ever reaching it. Managing
   group membership and instance features remains owner-only.

The form setting changes what reviewers read; it does not change the public
`https://ryanmeetup.com/cards/verify` redirect used by buyers and reminder
drafts. Settings shows both the buyer link and the current review-form editor.
Open both before saving and confirm they lead to the same Google form. Changing
the buyer destination also requires updating the Ryan Meetup site's redirect.

Use one text question for the person's legal/full name and one for the order
email. Duplicate identity questions are never resolved by their position:
the queue shows a warning, leaves that identity unassigned, and retains all
answers for manual review. Company, buyer, preferred, and social-profile names
do not claim the personal-name field. Invalid or blank explicit email answers
are not replaced by the Google sign-in email; a collected address is used only
when no explicit email question exists. Uploads remain available. To resolve a
warning, keep one supported title for each identity and rename extra questions
to describe their other purpose, then refresh.

RY-D never emails buyers or fulfillment itself. Every one of those emails
opens as a prefilled draft in the reviewer's own mail app (a `mailto:` link,
with copy buttons beside it for when a draft won't open), and the reviewer
presses Send. The page then records what was sent. The one email the app
sends on its own is the internal upload reminder below.

## Upload reminder

Fulfillment's file doesn't announce itself, so once a week the app nudges
the team to check for it. RY-D Settings holds the slot — on by default,
**Tuesdays at 12 PM** in the workspace time zone (the one the task digest
uses, set in /admin/usage).

- **Email.** `/api/cron/ryd-upload-reminder` runs hourly and sends in the
  slot's hour, through Resend with the digest's sender, to everyone who can
  open the page (`workspace_area_members('ryd')`: owners, plus the groups
  granted the page when it's restricted). It goes out every week, uploaded
  or not, and says how many orders are still pending or waiting on more
  info. The slot is claimed on `ryd_settings.upload_reminder_sent_on` before
  sending, so it's sent once; a run where every send failed gives it back.
- **Banner.** From the slot until someone uploads, the page says it's upload
  day, with an Upload orders button.

## The weekly flow

1. **Upload orders.** The CSV is added to a rolling queue keyed by `OrderId`.
   Re-uploading the same file changes nothing; an order already in the queue
   keeps its decision. Import accounting, inserted orders, and their history
   save in one transaction; retrying the same upload returns its first result.
   Files are limited to 2 MB before multipart parsing. Invalid quotes, uneven
   rows, repeated column names, and missing or overlong order IDs are reported
   before any writes.
   The file needs `OrderId`, `BillFirstName`, `BillLastName`, and `BillEmail`;
   a `Verified?` column is optional. Every new order imports as pending — a
   ✅ already in the file is kept only as a cell, never as a decision. The
   queue reloads as soon as the import finishes, so each new order is matched
   against the form's existing responses straight away and arrives with its
   suggestion. **Link** on that submission pairs it. A decided order only
   offers the other decisions, plus **Save note** when its note changes.
2. **Review.** The RY-dentification form is the source of truth. Its
   responses are read through the Google Forms API, with up to ten seconds of
   server-memory reuse between reads — not from the
   response spreadsheet — and paired with orders. The form's link never
   changes but its questions may: the name, email, and social questions are
   recognised by what they ask, every upload question contributes files, and
   any other question is shown on the submission as an extra answer, so a
   new question never hides what people wrote. Suggestions, strongest
   first:
   - same email and full name → strong. "Same email" ignores case, a
     `+tag`, and, at Gmail, dots: one inbox written two ways is one buyer.
     When the order's first name isn't the first word on the form ("Ryan Fox"
     ordering, "Steven Ryan Fox" on the form), the reason says Ryan is a
     middle name. The pairing is still strong; whether that Ryan counts is the
     reviewer's call;
   - the order number, or the order's email, typed into any form answer, with
     the full name → strong. The buyer pointed at the order themselves;
   - an email one or two characters off, a mistyped domain, or the same email
     name (five characters or more) at another provider → possible;
   - a social handle equal to the order email's name (`pineapplemage`) →
     possible;
   - the same email, or the quoted order, with "Ryan" alone on the form or a
     different surname → possible. The reason names the form's surname, or
     says it is spelled differently when it is one letter off;
   - a surname one letter off together with a near email or matching handle →
     possible. A near surname alone suggests nothing;
   - same full name, different email → weak.

   **Gifts with the buyer's own email or a quoted order can be suggested as
   possible.** When the buyer's first name isn't on the form and neither of
   those ties it to the order (Jamie Perez buying for Ryan Pêrez), the reviewer
   links the submission by hand — from the order, or from **Unmatched
   submissions**. Within a confidence level, the buyer's own inbox or a quoted
   order outranks a pairing that rests on names.
   Every order needs a person to press Verify, Needs more info, or Cancel
   order.
   Select orders in the queue to apply one decision together, then confirm.
   The confirmation flags missing evidence and skips orders already with
   fulfillment or in production. Failed decisions remain selected to retry.

   **The card.** Each order's review shows the card fulfillment prints:
   first name, last name, location, and Ryan since. Until someone saves it,
   the card is a draft read from Chipply's `Options Detail` column
   (`[First Name : Ryan] [Last Name : Le] [Location : Brooklyn, NY]
   [Full Birthday : 04/07/1999]`). Location is kept as typed. Ryan since is
   filled only from a four-digit birthday year; a two-digit year such as
   `07/14/76` offers **Use 1976** for a person to accept, and a birthday
   with no year, such as `Dec 3`, is left blank. An export without
   `Options Detail` falls back to the billing name, which is wrong for a
   gift, and the dialog says so.

   **Save card** stores an unfinished card. Verify approves the card as
   shown and is unavailable until every line is filled with a four-digit
   year; the database refuses a blank line too, so whatever was approved is
   exactly what gets printed. Changing a verified card re-approves it.
   Once an order is with fulfillment its card is frozen, and a cancelled
   order has none. The queue marks rows whose card is unfinished, and bulk
   Verify leaves them selected rather than verifying them. Orders verified
   before cards existed have no saved card; open and save one before
   they can be printed.
3. **Follow up.** The Follow-up view lists orders asked for more, or with
   nothing on the form. **Email** on a row and the review dialog's ask
   action open the same draft workflow as **Email everyone** and **Email
   selected**. A single buyer gets a personal greeting; groups use Bcc.
   Evidence state is considered across each buyer's selected orders, so someone with a
   linked or suggested response is asked for more rather than to start again.

   Opening or closing a draft records nothing. After sending, use **Mark this
   draft as emailed** on that group only. Each draft is confirmed independently;
   another group's buyers remain unrecorded until that draft is confirmed.
   Selections are split into at most 100 orders per draft, also bounded by the
   confirmation's byte size. Copy the addresses and email if a mail link fails.
   A retried confirmation returns its first result without another timestamp
   or history entry. Orders no longer waiting are skipped, and an email changed
   since preparation requires review. A reload failure does not undo a saved
   confirmation or import.

   **Email everyone** leaves out cancelled/verified orders, invalid addresses,
   and anyone emailed in the last 20 hours. Hand-picking rows can override the
   time window. All buyer follow-up goes by email.

   An order still pending with a suggested response isn't in Follow-up, since
   it is waiting on a reviewer rather than the buyer. Mark it **Needs more
   info** to chase it.

   **Cancel orders** is for buyers who never verify. From the queue,
   Follow-up, or one order's review, it drafts two kinds of email: a request
   to fulfillment's saved address listing each order to cancel and refund, and
   Bcc notices telling buyers their order was cancelled and refunded — split by
   whether they sent nothing or sent something that didn't verify, so each
   gets the right reason. Drafts are pinned when the dialog opens and opening
   one records nothing; **Mark N orders cancelled** is the only step that
   changes the orders. Cancelled is stored as the `rejected` status, so no
   schema change was needed; `?status=cancelled` lists them and old
   `?status=rejected` links still work. A cancelled order leaves Follow-up and
   is never emailed again. Orders already with fulfillment or in production
   can't be cancelled here.

   The Pending and Needs more info queues also offer **Email selected** beside
   the decisions, so a reviewer can select all pending orders and nudge every
   buyer to verify in one Bcc draft without leaving the queue. It opens the
   same drafts and confirmation as Follow-up. **Mark contacted** beside it
   records contact made outside a draft (a call, a DM, an email sent from
   elsewhere) through the same confirmation, without opening one. Each row
   then shows **Last contacted** with the date; recording again moves it
   forward, so a buyer can be chased as many times as needed.

   **Unmatched submissions** has its own **Email everyone**, asking for the
   email or order number the RY-D was bought under. The selection becomes
   independent Bcc drafts bounded by recipient count, request bytes, and mail
   link length. Copy the addresses and email if a draft cannot open. Confirm
   only each draft you sent; opening or closing it records nothing. Each
   confirmation records one attempt per person and has a stable retry key, so
   retrying cannot add another attempt. A reload failure leaves the confirmed
   draft recorded. Recently contacted people are left out of **Email everyone**;
   hand-picked selections can override that pause.

   **Mark contacted** on a person or selection opens the same bounded group
   confirmations without preparing a new email. Confirm only the groups already
   contacted. Counts and last-contact dates reconcile from the database result.
   Linking a person's responses uses one transaction: a conflicting claim leaves
   the whole group unlinked. Groups above 100 responses or the request budget
   open the order review for individual linking instead of partially saving.
4. **Pull the card file.** The Verified view's **Card files** panel is how
   fulfillment gets cards without an email. **Download new cards (N)** takes
   every verified order with an approved card that is still Ready to send,
   oldest first, and downloads `ry-d-cards-<date>.csv` with exactly four
   columns: Order Number, Name, Location, Ryan Since. In the same
   transaction those orders are marked Sent to fulfillment with the batch
   date, so nothing prints twice; an unfinished or unapproved card waits for
   the next file. The file is UTF-8 with a byte-order mark so Excel shows
   `Pérez` correctly, and a cell starting with `=`, `+`, `-`, or `@` gets a
   leading apostrophe so free text can't run as a formula.

   Each batch freezes the cards it printed (`ryd_card_batches`,
   `ryd_card_batch_orders`). **Download again** on a past batch rebuilds the
   same file from those frozen rows and never marks anything. A retried pull
   with the same operation returns the same batch. Moving an order back to
   Ready to send leaves batch history alone and lets it print in a later
   file on purpose.

   **Generate an email and CSV for selected orders.** Verified opens to
   **Ready to send** by default. Select individual orders or **Select all**,
   then **Generate email & CSV (N)**. Select all includes orders matching the
   current search and filters across every page. Other ready orders wait for
   a later email. Each selection supports up to 5,000 orders without truncation.

   The email names recipients from explicitly linked form responses. An answer
   such as “Buyer on behalf of Ryan Recipient” lists Ryan Recipient as the
   RY-D recipient, with the buyer identified separately. Orders without linked
   names identify only who placed the order. Distinct linked names stay labeled
   as separate form names; they are never guessed into one person. Missing
   linked responses or unreadable recipient details stop generation for review.
   Billing names in the CSV stay intact for order matching; evidence files,
   social profiles, and internal review notes are not added to the email.
   **Regenerate email & CSV** reads fresh form answers for the same selection.

   Download the CSV, open or copy the email to the fulfillment address in
   settings, attach the file, and send it yourself. Generation is read-only:
   no email or CSV is saved, no orders or evidence are reserved, no stage
   changes, and no Google Sheet is updated. Closing the dialog discards its
   generated content. You can select different orders and generate another
   email immediately, with no resume, replace, discard, or send-confirmation
   workflow. Previously saved historical records do not interfere.

   **All stage changes are manual.** After sending the email yourself, select
   its orders and **Mark sent to fulfillment**. This records only their stage
   change; it does not save or send an email. The orders leave Ready to send
   only when you move them. If you leave them ready, they can appear in another
   generated email. The server rechecks every selected ID at generation time
   and refuses missing, unverified, already-sent, or done orders.

   Marking sent also records `production_sent_at`, which is now the date the
   order was sent to fulfillment; its progress chip reads "Sent to fulfillment
   Oct 20". Production runs in fulfillment's own system, so RY-D has no
   separate production stage. Orders from before the merge carry their
   handoff's date, and an older record with only a production date counts as
   sent on that date.
5. **Mark completion.** In **Sent to fulfillment**, select finished orders and
   choose **Done** to record `done_at`. Ready orders cannot skip the email
   handoff through these controls.

   **Move back** takes an order one stage backward: Done → Sent to
   fulfillment → Ready to send. Moving back from Done keeps the send date;
   returning an order to Ready to send clears it and makes the order eligible
   for another generated email. Historical audit events stay. Once fulfillment
   has an order, its decision cannot be changed.

   Selection covers every filtered page, with the scope shown beside its count.
   The confirmation pins each order's original and target stage. Production
   groups contain at most 100 moves and 14,000 encoded request bytes; a mixed
   backward group commits together. Larger selections show confirmed progress,
   stop at the first failed group, and retry that same group without repeating
   completed ones. A changed or deleted order refuses its entire group and
   requires reviewing the remaining selection. Completed groups stay saved.
   Closing and starting another operation creates new retry keys; retry an
   unconfirmed group in its existing dialog first. Reloading the page also loses
   the dialog's local retry keys. Search-pending actions and checkboxes stay
   disabled until the results catch up.

## Data

Form answers and uploads are **not copied** into the database. Authorized
Google reads share in-flight requests and briefly reuse completed results in
server memory. Uploads are streamed through
`/api/ryd/evidence/[fileId]`, which only serves file IDs that appear in the
configured form's responses. Media and Drive metadata are never retained;
media responses use `private, no-store` and bypass Next's image optimizer.

Completed form reads and access tokens expire ten seconds after completion,
without extending their lifetime on reuse. Timers remove idle entries. Each
process retains at most two form reads (each at most 4 MiB of serialized data)
and four tokens; larger forms share only in-flight work. Cache keys include the
form ID and a hash of the credential and connection revision. Every file request
still checks sign-in, the instance feature, page access, current settings, and
the current Google connection before using a cached form. Access removal or
disconnect denies subsequent requests; changing forms or reconnecting cannot
reuse the previous connection's answers. Requests already authorized may finish
within their deadlines. A response or file reference removed in Google can
remain visible in a completed form read for its remaining ten-second lifetime.
Link/dismiss/review provenance checks and fulfillment sheet reconciliation bypass
retained answers. `GET /api/ryd` with `Cache-Control: no-cache` also bypasses
retained answers; concurrent fresh reads can still share in-flight work.

Google JSON requests have ten-second deadlines, including their response bodies.
One form read, including token refresh and all response pages, has a 25-second
deadline. File fetching and streaming, and sheet reconciliation, each have
30-second deadlines. Queue and file requests propagate browser cancellation;
one cancelled reader does not interrupt other readers sharing the work, and
the last cancelled reader stops the upstream request. Nothing uses Next's
persistent cache or a public evidence manifest.

The database keeps the orders (`ryd_orders`, with fulfillment's raw row), the
pairings (`ryd_order_submissions`, keyed by the form's response ID, which
survives a respondent editing their answers), an audit trail (`ryd_order_events`), contact
attempts to unmatched submitters (`ryd_submitter_contacts`), the imports and
minimal handoff records, historical fulfillment manifests
(`ryd_fulfillment_snapshots`), the settings, and the Google connection. The
historical manifests remain private; new email and CSV generation writes none.
Every table is
service-role only; routes check the instance switch and
`can_view_workspace_area('ryd')` first.
RY-D stays closed if the page-access functions are unavailable; unlike older
workspace pages, it never uses the pre-migration open fallback for customer data.

See [the verification checks](RYD_TESTING.md) for test commands, coverage, and
the live checks outside the synthetic fixtures.

The read-only Claude Desktop connector (`docs/MCP.md`) can also read RY-D
sales through `get_ryd_sales_insights` and `list_ryd_orders`. It bypasses the
page's access setting under the connector's separate bearer-token authority.
Only the structured buyer-email field is reduced to a domain. Names, notes,
other form answers, social URLs, and order text remain private identifying data
and may contain full email addresses. Uploaded file identifiers and file
contents are excluded; the payload is not anonymized or guaranteed email-free.
