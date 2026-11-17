# Reviews database proposal

November 17, 2026. Ryan confirmed that neither a dedicated reviews database nor
a Shopify Customer Account API client has been provisioned. This is a proposed
setup, not a provisioned service or an approved recurring expense.

## Recommended setup

Use a **dedicated Supabase project for the store** in Ryan Meetup's existing
Supabase organization. It can hold review data and photos without a separate
account or a standalone backend application. The existing Next.js store owns
the server-side review API. Shopify remains responsible for buyer identity,
products, orders, and fulfillment.

Keep it independent of both Tasks projects. Use store-specific server-only
credentials and the store's own migrations. Choosing an existing organization
does not mean sharing a database, users, or buckets with Tasks.

| Environment | Proposed setup | Data |
| --- | --- | --- |
| Development | Local Supabase through its CLI and Docker | Synthetic buyers, orders, reviews, and photos. |
| Vercel Preview | A dedicated test Supabase project, or an isolated Supabase branch once paid branching is useful | Synthetic fixtures and explicitly approved test accounts. |
| Production | A dedicated store project, for example `ryanmeetup-store` | Real reviews and their minimal Shopify ownership references. |

Match the hosted database region to the store's server runtime when
provisioning. Map Vercel Production and Preview variables to their respective
project identities and verify those identities before applying migrations or
enabling submissions. The browser mode switch selects a review provider; it
never changes which database a deployment uses.

Supabase supports a [local database and storage environment](https://supabase.com/docs/guides/local-development).
We can write and test schema migrations there before creating paid hosting.
Keep versioned migrations under the store's own `apps/store/supabase/migrations`
when that workspace is introduced, and test rebuilding from empty. Apply the
same reviewed migrations to the test and production store projects. Do not
use Tasks' migration directory or linked-project state.

## What to store

- Reviews and their chosen public display names, rating, text, and purchased
  item display snapshots.
- Minimal Shopify shop/customer/order/line identifiers for ownership and the
  unique shop + order + line constraint. Read current purchase eligibility
  from Shopify on writes rather than trusting a browser-supplied product.
- Approved versions separately from pending edits, publication/withdrawal
  state, official replies, and moderation audit history.
- Media ownership and processing/publication state; store the actual image
  files in object storage.
- Server-managed Shopify sessions with appropriate token protection once the
  authentication design is implemented. Staff identity and role checks remain
  a separate authorization boundary.

Do not mirror the order database or store shipping addresses and payment data.
Use Shopify sign-in for buyers rather than introducing a second buyer password
or Supabase sign-in flow. Review request email addresses and queue processing
belong to the later email phase and should be minimized there.

Keep browser clients behind the store's server API. Store access credentials
remain server-only, with database grants and row access policies chosen in the
schema implementation. Read APIs expose only approved public fields; buyers
and staff have separate authenticated write paths.

## Photos and backups

Use a private bucket for uploads awaiting validation and moderation. Publish
only approved, re-encoded derivatives. Withdrawal, deletion, and abandoned
upload cleanup must cover the corresponding objects as well as database rows.

Back up images separately from database records: Supabase's database backups
do **not** include Storage file contents. Document and test both restore paths
before launch. [Backup coverage](https://supabase.com/docs/guides/platform/backups)

## Cost and sequence

As checked on November 17, 2026, the [pricing page](https://supabase.com/pricing)
lists a Free plan with two active projects per account and pausing after one
week of inactivity. It is suitable for a test project if a free slot is
available. Pro starts at $25/month with the first project included; additional
projects in a paid organization start at $10/month. Check the organization's
actual plan and compute usage before budgeting. Object storage and bandwidth
beyond allowances can add charges.

The proposed sequence is:

1. Finish the Shopify login and exact purchase-line feasibility check. It is
   still a gate before implementing the dependent custom submission service.
2. Confirm the Supabase organization, available test project allowance, and
   intended production region. Approve any recurring hosting cost when a
   concrete project is ready to be created.
3. Introduce the local store database workspace and a small schema migration
   with ownership, revision, and publication constraints plus database tests.
4. Connect Preview to test storage and exercise one buyer/moderator/public-read
   flow. Custom mode remains closed until those dependencies work.
5. Provision production before import/cutover, verify project identity and
   backups, and rehearse migration plus rollback while Judge.me stays installed.

No hosted database, billing change, database schema, or storage bucket has been
created as part of this proposal.
