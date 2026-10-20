# RY-D verification

Ryan Meetup sells RY-Ds, and buyers prove they are a Ryan through the
RY-dentification form (social links, uploads — never a government ID). Each
week fulfillment sends an order CSV; someone matches it against the form,
ticks who is verified, and sends the file back so fulfillment knows which
orders to start. `/ryd` does that work in one place.

It is a Ryan Meetup feature: **off by default**, turned on per instance from
**/admin/settings → Features**. With it off the page, its sidebar entry, its
Access setting, and every `/api/ryd` route answer as if they don't exist.

## Setting it up on an instance

1. Apply `supabase/migrations/20261021000000_ryd_verification.sql`.
2. In Google Cloud, on the same OAuth client the Calendar uses, add the
   redirect URI `https://<instance>/api/integrations/ryd-google/callback`, and
   add the `spreadsheets` and `drive.readonly` scopes to the consent screen.
   `drive.readonly` is a restricted scope: keep the client in Testing (or
   Internal) with the form owner as a test user.
3. Turn on **RY-D verification** in /admin/settings → Features.
4. On /ryd → Settings, connect Google **as the account that owns the form**,
   paste the form responses sheet link, and enter fulfillment's email.
5. The page starts restricted to owners. Open it to the people who verify
   from /admin/access.

Sending email (to buyers and to fulfillment) uses Resend: `RESEND_API_KEY`
with `RYD_FROM_EMAIL`, falling back to `RESEND_FROM_EMAIL`. Without them the
page still works and the file can be downloaded and sent by hand.

## The weekly flow

1. **Upload orders.** The CSV is added to a rolling queue keyed by `OrderId`.
   Re-uploading the same file changes nothing; an order already in the queue
   keeps its decision. A ✅ fulfillment already put in the file imports as
   verified.
2. **Review.** Form responses are read live from the sheet and paired with
   orders. Suggestions, strongest first:
   - same email (any case) and full name → strong;
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
   in the next send. Afterwards the linked rows in the form sheet get their
   ✅ (best effort — the toast says if Google refused). **Download CSV**
   builds the same file without sending or clearing anything.

## Data

Form answers and uploads are **not copied** into the database; they stay in
Google and are read per request. Uploads are streamed through
`/api/ryd/evidence/[fileId]`, which only serves file IDs that appear in the
form's responses and never caches them.

The database keeps the orders (`ryd_orders`, with fulfillment's raw row), the
pairings (`ryd_order_submissions`, keyed by email plus form timestamp so a
re-sorted sheet doesn't break them), an audit trail (`ryd_order_events`), the
imports and batches, the settings, and the Google connection. Every table is
service-role only; routes check the instance switch and
`can_view_workspace_area('ryd')` first.
