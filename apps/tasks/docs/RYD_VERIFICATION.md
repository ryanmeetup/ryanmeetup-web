# RY-D Verification

Ryan Meetup sells RY-Ds, and buyers prove they are a Ryan through the
RY-dentification form (social links, uploads — never a government ID). Each
week fulfillment sends an order CSV; someone matches it against the form,
ticks who is verified, and sends the file back so fulfillment knows which
orders to start. `/ryd` does that work in one place.

It is a Ryan Meetup feature: **off by default**, turned on per instance from
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
   Everyone with page access can operate the queue, change RY-D settings,
   and connect or disconnect Google. Managing group membership and instance
   features remains owner-only.

RY-D never sends email itself. Every email — to buyers and to fulfillment —
opens as a prefilled draft in the reviewer's own mail app (a `mailto:` link,
with copy buttons beside it for when a draft won't open), and the reviewer
presses Send. The page then records what was sent.

## The weekly flow

1. **Upload orders.** The CSV is added to a rolling queue keyed by `OrderId`.
   Re-uploading the same file changes nothing; an order already in the queue
   keeps its decision. Import accounting, inserted orders, and their history
   save in one transaction; retrying the same upload returns its first result.
   Files are limited to 2 MB before multipart parsing. Invalid quotes, uneven
   rows, repeated column names, and missing or overlong order IDs are reported
   before any writes.
   A ✅ fulfillment already put in the file imports as
   verified, but with nothing linked; it is still offered a suggestion, and
   **Link** on that submission pairs it. A decided order only offers the
   other decisions, plus **Save note** when its note changes.
2. **Review.** The RY-dentification form is the source of truth. Its
   responses are read live through the Google Forms API — not from the
   response spreadsheet — and paired with orders. The form's link never
   changes but its questions may: the name, email, and social questions are
   recognised by what they ask, every upload question contributes files, and
   any other question is shown on the submission as an extra answer, so a
   new question never hides what people wrote. Suggestions, strongest
   first:
   - same email (any case) and full name → strong. When the order's first
     name isn't the first word on the form ("Ryan Fox" ordering, "Steven Ryan
     Fox" on the form), the reason says Ryan is a middle name. The pairing is
     still strong; whether that Ryan counts is the reviewer's call;
   - an email one or two characters off, or a mistyped domain → possible;
   - a social handle equal to the order email's name (`pineapplemage`) →
     possible;
   - "Ryan" alone on the form from the order's email → possible;
   - same full name, different email → weak.

   **Gift orders are never suggested.** When the buyer's first name isn't on
   the form (Jamie Perez buying for Ryan Pêrez), the reviewer links the
   submission by hand — from the order, or from **Unmatched submissions**.
   Every order needs a person to press Verify, Needs more info, or Reject.
3. **Follow up.** The Follow-up view lists orders asked for more, rejected,
   or with nothing on the form. **Email** on a row and the review dialog's ask
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

   **Email everyone** leaves out rejected/verified orders, invalid addresses,
   and anyone emailed in the last 20 hours. Hand-picking rows can override the
   time window. All buyer follow-up goes by email.

   An order still pending with a suggested response isn't in Follow-up, since
   it is waiting on a reviewer rather than the buyer. Mark it **Needs more
   info** to chase it.

   **Unmatched submissions** has its own **Email everyone**: one Bcc draft to
   everyone whose form answers no order claims, asking for the email or order
   number the RY-D was bought under. **Mark as contacted** then records one
   attempt per person (`ryd_submitter_contacts`, a row per attempt, keyed by
   normalized email); **Mark contacted** on one person's card records a single
   attempt. Each submitter shows **Contacted N×** once they've been asked,
   and anyone contacted in the last 20 hours is left out of the next draft.
   Ticking people, or **Select all**, offers **Email selected** and **Mark
   contacted** for just them.
4. **Send to fulfillment.** Opening this dialog prepares or resumes one
   shared batch. Fulfillment's address must be configured first. The batch
   pins its recipient, raw order rows, header schema, decisions, and ready
   orders' form/response references. **Download CSV** and **Open draft** use
   that same manifest; the draft and filename carry its batch reference.
   Header spelling changes preserve saved cells, and columns missing from
   later imports are appended so older details survive.

   Send the file yourself, then **Mark as sent**. One database transaction
   records the batch, clears exactly its ready orders, and writes their
   history. Repeated confirmations return the existing result. New imports
   and later verifications wait for the next file. Ready decisions and evidence
   cannot change while reserved; notes and production tracking remain available.

   Closing keeps the batch available to the team. It has no automatic expiry:
   the file may already have been emailed. **Cancel this batch** explicitly
   releases it; coordinate with other reviewers and only cancel an unsent file.
   Cancelled downloads and confirmations are refused. Discard that file and
   draft before preparing another batch.

   Afterwards the captured responses in the form's linked sheet get their ✅
   if it has a `Verified?` column (best effort — the toast reports a failure).
   Retried confirmations do not repeat this external step. Sheet reconciliation
   still uses submission time and email because the sheet has no response IDs.
   Downloading the file alone clears nothing.
5. **Track production.** Verified orders stay under **Verified**, sent to
   fulfillment or not, with a Production column and filters for **Not
   sent**, **In production**, and **Done**. Tick orders, or **Select all**
   of what's listed, then **Sent for production** or **Done**. Each records
   its own date (`production_sent_at`, `done_at`); marking an order done
   that was never sent stamps both, and re-marking keeps the first date.
   **Move back** takes each ticked order one step back. Once an order is in
   production, or fulfillment has its file, its decision can't be changed.

## Data

Form answers and uploads are **not copied** into the database; they stay in
Google and are read per request. Uploads are streamed through
`/api/ryd/evidence/[fileId]`, which only serves file IDs that appear in the
form's responses and never caches them.

The database keeps the orders (`ryd_orders`, with fulfillment's raw row), the
pairings (`ryd_order_submissions`, keyed by the form's response ID, which
survives a respondent editing their answers), an audit trail (`ryd_order_events`), contact
attempts to unmatched submitters (`ryd_submitter_contacts`), the imports and
batches, private fulfillment manifests (`ryd_fulfillment_snapshots`), the
settings, and the Google connection. Manifests preserve the fulfillment rows
for batch history, including cancelled batches; they contain no copied Google
answers or media. Every table is
service-role only; routes check the instance switch and
`can_view_workspace_area('ryd')` first.

The read-only Claude Desktop connector (`docs/MCP.md`) can also read RY-D
sales through `get_ryd_sales_insights` and `list_ryd_orders`. It bypasses the
page's access setting, like the rest of that connector, but returns only email
domains and never the uploaded files.
