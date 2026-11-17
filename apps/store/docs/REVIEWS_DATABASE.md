# Reviews on the shared Ryan Meetup backend

November 17, 2026. Ryan chose to reuse the existing Ryan Meetup Tasks Supabase
project as the beginning of a shared backend for all Ryan Meetup properties.
This supersedes the earlier recommendation to provision a dedicated store
project. Private authorization/session storage is now implemented in migration
`20261120130000_store_customer_auth_storage.sql`. A Shopify Customer Account
API client, scoped runtime interface, and review-content schema remain
outstanding.

## Selected project and ownership

Use **RMT**, project `lvfaartgcpphuokoswcm`, which currently backs
`tasks.ryanmeetup.com`. Add new store-owned review tables and media buckets
there. The existing Next.js store owns its review API. Shopify remains
responsible for buyer identity, products, orders, and fulfillment.

The personal Tasks instance at `projects.ryanle.dev`, project
`vjsnobmfsfrsnwukfaoq` (**PRD**), remains a separate deployment with its own
credentials and data. The store targets RMT; neither Tasks instance changes
which project it uses.

Keep review records in their own tables, for example a `store_reviews` family,
with separate revision, moderation, and media ownership. Do not embed reviews
in task records or extend Tasks access groups to every buyer. Choose final
table names and constraints when implementing the schema after the Shopify
feasibility gate.

Sharing infrastructure is the first step. Shared person records, account
linking, and cross-property staff access can follow through explicit
interfaces as those capabilities are needed. Keep review business logic in
the store initially; extract shared server code when another app consumes it.

| Environment | Setup | Data |
| --- | --- | --- |
| Development | Local Supabase rebuilt from the existing canonical migrations | Synthetic Tasks and store fixtures. |
| Vercel Preview | An isolated test environment for the shared backend, or an appropriate Supabase branch | Synthetic fixtures and explicitly approved test accounts. |
| Production | Existing RMT project `lvfaartgcpphuokoswcm` | Existing Tasks data plus store-owned review records and media. |

Configure each app's server connection explicitly and verify project identity
before enabling submissions. Preview must not write to the production RMT
database. The browser mode switch selects a review provider; it never changes
which database a deployment uses. Judge.me remains the default during the
rebuild.

## One migration history

Supabase supports a [local database and storage environment](https://supabase.com/docs/guides/local-development).
Use the repository's existing `apps/tasks/supabase` workspace to test the
combined database. Review tables, grants, policies, functions, and buckets
belong in new versioned files in `apps/tasks/supabase/migrations`, declared
RMT-only in the adjacent `migration-scopes.json`. Test reset
from empty, linked diff, and database authorization/constraint tests before
applying changes. Do not create `apps/store/supabase/migrations` for this same
database.

The scope registry separates shared Tasks schema from Ryan Meetup extensions
without moving or changing applied SQL files. RMT receives both scopes. PRD
receives only shared Tasks migrations through the catch-up generator's default
profile. Store files use a `store_`/`rmt_` prefix and need an explicit `rmtOnly`
entry; unknown or missing scope metadata fails planning.

The existing auth migration `20261120130000` stays applied on RMT and is not
required on PRD. No skipped history marker is added there. If PRD already has
its objects/history, leave them untouched. The previous PRD paste block is
superseded. Shared migrations must work without extension objects on PRD.
See [the database workflow](../../tasks/docs/DATABASE.md#migration-profiles).

## App access and buyer identity

Use a narrowly authenticated backend interface for storefront access to the
private service-role-only storage operations. That interface is the next
integration chunk; the storefront has no shared admin credential or direct
SQL login. Sharing the project does not mean copying Tasks' broad
admin secret into every app. Supabase secret/service-role access bypasses RLS,
so row policies alone would not constrain that credential. Verify inherited
role and function privileges as well as table grants when implementing the
boundary. The local audit found 32 public-schema functions executable through
PUBLIC; Supabase also documents inherited PUBLIC privileges for SQL roles.
Do not introduce a direct SQL login based on `NOINHERIT` alone, or change
existing workspace grants to work around that inheritance. [Roles](https://supabase.com/docs/guides/database/postgres/roles),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

Keep buyers on Shopify authentication with server-managed sessions. The current
Tasks `auth_user_profile` trigger calls `handle_new_user` when a Supabase Auth
user is created; Tasks provisioning creates profiles and access-group
membership. Do not create Supabase users for store buyers or open the existing
invite-only signup flow as part of reviews. Shared customer/staff identity is
a later deliberate change, with its own membership rules.

Database tests must prove both directions of isolation: ordinary Tasks clients
cannot read private review drafts or purchase references, and the store's
runtime interface cannot read or change private Tasks data or invoke
Tasks-only privileged functions. The backend must pin shop/client scope before
using the privileged database client. Publishing reviews exposes only approved public fields.

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
remain server-only. Buyers and staff have separate authenticated write paths;
future shared staff identity does not automatically grant moderation rights.

## Photos and backups

Use store-owned buckets in RMT, with private uploads awaiting validation and
moderation. Keep their policies independent of task/project/category
attachments. Publish only approved, re-encoded derivatives. Withdrawal,
deletion, and abandoned upload cleanup must cover the corresponding objects
as well as database rows.

Back up images separately from database records: Supabase's database backups
do **not** include Storage file contents. Document and test both restore paths
before launch. [Backup coverage](https://supabase.com/docs/guides/platform/backups)

## Rollout sequence

No additional production Supabase project is planned. Database, storage, and
bandwidth usage will share RMT's capacity and allowances. Check actual usage
and the staging option before deciding whether hosting needs to change.

1. Finish the Shopify login and exact purchase-line feasibility check. It is
   still a gate before implementing the dependent custom submission service.
2. Audit the existing RMT role/function grants and Tasks provisioning boundary,
   then agree the store's restricted server connection and isolated Preview
   target. Use store-owned environment variable names to make ownership clear.
3. Add a small review migration to the canonical history, with explicit grants,
   ownership, revision, and publication constraints plus database tests. Follow
   the RMT-only scope policy; shared Tasks changes still reach both instances.
4. Connect Preview to the isolated test backend and exercise a buyer,
   moderator, and public-read flow. Custom mode remains closed until the
   dependencies work.
5. Apply and verify the reviewed schema on RMT, then configure the store's
   scoped runtime access there. Verify backups and rehearse import/cutover and
   rollback while Judge.me stays installed.

Auth storage has landed as a canonical migration; see
[the handoff](REVIEWS_HANDOFF.md) for per-instance rollout verification and
[the superseded PRD handoff](../../tasks/docs/PRD_STORE_CUSTOMER_AUTH_SQL.md). PRD
does not need the store-auth migration. No storage
bucket, deployment credential, or billing setting has been changed.

Use `node scripts/test-store-customer-auth.mjs` from `apps/tasks` for database
validation. It creates a uniquely named test stack on separate ports, replays
the selected profile from empty, checks private access and encrypted persistence
on RMT or Tasks access without store objects on PRD, then removes only its own
stack. Use `--target prd` for the local PRD-shaped check. Never use a loopback
`--db-url` to try to
reset a second database inside the existing app stack: CLI v2.115.0 treats it
as a default local-stack reset, ignoring the database name.
