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

1. Apply `supabase/migrations/20261021000000_ryd_verification.sql` and
   `20261022000000_ryd_form_source.sql`.
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
   the public `/forms/d/e/…` one), and enter fulfillment's email.
5. The page starts restricted to owners. Open it to the people who verify
   from /admin/access.

Sending email (to buyers and to fulfillment) uses Resend: `RESEND_API_KEY`
with `RYD_FROM_EMAIL`, falling back to `RESEND_FROM_EMAIL`. Without them the
page still works and the file can be downloaded and sent by hand.

## The weekly flow

1. **Upload orders.** The CSV is added to a rolling queue keyed by `OrderId`.
   Re-uploading the same file changes nothing; an order already in the queue
   keeps its decision. A ✅ fulfillment already put in the file imports as
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
   or with nothing on the form. Email sends one templated reminder per order
   per day; the CSV has no phone numbers, so phone-preferred buyers are
   called outside the app.
4. **Send to fulfillment.** Emails fulfillment every order they haven't been
   told is cleared, in their own columns and order, with `Verified?` filled.
   Verified orders then leave the queue; everything else comes round again
   in the next send. Afterwards the matching rows of the form's linked
   response sheet, if it has one with a `Verified?` column, get their ✅
   (best effort — the toast says if Google refused). Rows are found by
   submission time and email, since the sheet has no response IDs. **Download CSV**
   builds the same file without sending or clearing anything.

## Data

Form answers and uploads are **not copied** into the database; they stay in
Google and are read per request. Uploads are streamed through
`/api/ryd/evidence/[fileId]`, which only serves file IDs that appear in the
form's responses and never caches them.

The database keeps the orders (`ryd_orders`, with fulfillment's raw row), the
pairings (`ryd_order_submissions`, keyed by the form's response ID, which
survives a respondent editing their answers), an audit trail (`ryd_order_events`), the
imports and batches, the settings, and the Google connection. Every table is
service-role only; routes check the instance switch and
`can_view_workspace_area('ryd')` first.

The read-only Claude Desktop connector (`docs/MCP.md`) can also read RY-D
sales through `get_ryd_sales_insights` and `list_ryd_orders`. It bypasses the
page's access setting, like the rest of that connector, but returns only email
domains and never the uploaded files.
