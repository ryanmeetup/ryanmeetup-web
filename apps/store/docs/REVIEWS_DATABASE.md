# Reviews on the shared Ryan Meetup backend

Updated November 20, 2026. Ryan chose to reuse the existing RMT Supabase
project as a shared backend for Ryan Meetup properties. Encrypted Shopify
session storage, custom review/revision/reply/audit schema, buyer management,
owner moderation, private photo staging and pending-revision associations are
implemented. All ten RMT-only Store migrations through `20261120230000` are
applied; PRD receives none. Real Shopify-backed lifecycle proof, complete media
UI/moderation/publication and operations/recovery work remain outstanding.
See [the current inventory](REVIEWS_REBUILD.md) for evidence and next steps.

## Selected project and ownership

Use **RMT**, project `lvfaartgcpphuokoswcm`, which currently backs
`tasks.ryanmeetup.com`. Add new store-owned review tables and media buckets
there. The existing Next.js store owns its review API. Shopify remains
responsible for buyer identity, products, orders, and fulfillment.

The personal Tasks instance at `projects.ryanle.dev`, project
`vjsnobmfsfrsnwukfaoq` (**PRD**), remains a separate deployment with its own
credentials and data. The store targets RMT; neither Tasks instance changes
which project it uses.

Review records use `store_reviews`, `store_review_revisions`,
`store_review_replies` and `store_review_events`. Private media uses
`store_review_photo_drafts`, `store_review_revision_photos` and
`store_review_photo_budgets`, plus the private `store-review-photos` bucket.
These tables have RLS and explicit service-only grants; fixed RPCs own
transactional writes. Store buyer identity does not create Tasks membership.

Sharing infrastructure is the first step. Shared person records, account
linking, and cross-property staff access can follow through explicit
interfaces as those capabilities are needed. Keep review business logic in
the store initially; extract shared server code when another app consumes it.

| Environment | Setup | Data |
| --- | --- | --- |
| Development | Local Supabase rebuilt from the existing canonical migrations | Synthetic Tasks and store fixtures. |
| HTTPS rehearsal / Preview | Isolated backend required. The current guard accepts RMT or nonproduction loopback only; an arbitrary hosted Supabase branch is not accepted. See the inventory for isolation work still required. | Synthetic fixtures and explicitly approved test accounts; do not write to RMT as a Preview test. |
| Production | Existing RMT project `lvfaartgcpphuokoswcm` | Existing Tasks data plus store-owned review records and media. |

Configure each app's server connection explicitly and verify project identity
before enabling submissions. Preview must not write to the production RMT
database. Custom reviews are the only reviews since Judge.me was retired on
November 20 ([removal record](REVIEWS_JUDGEME_REMOVAL.md)).

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

The store connects to RMT directly with the Supabase secret key
(`SUPABASE_URL`, `SUPABASE_SECRET_KEY`; `lib/store-database.ts`). This was a
deliberate choice on November 18, 2026, replacing the earlier Tasks relay and
its scoped service token. The tradeoff: that key bypasses RLS for the whole
RMT project, Tasks data included, so a compromised storefront server would
expose it. The store limits itself to fixed tables and RPCs, validates every
command and result, and accepts only RMT's URL (loopback outside production),
so PRD can't be configured.
The storefront has no direct SQL login. Supabase secret/service-role access bypasses RLS,
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
  unique shop + order + line constraint; reviews without a matching order use
  a separate shop + buyer + product uniqueness limit. Read current purchase eligibility
  from Shopify on writes rather than trusting a browser-supplied product.
- Approved versions separately from pending edits, publication/withdrawal
  state, official replies, and moderation audit history.
- Media ownership and processing/publication state; store the actual image
  files in object storage.
- Server-managed Shopify sessions with the implemented encrypted token storage.
  Session loading and renewal now use the scoped backend with revision checks.
  Live client validation remains outstanding. Staff identity and role checks remain
  a separate authorization boundary.

Do not mirror the order database or store shipping addresses and payment data.
Use Shopify sign-in for buyers rather than introducing a second buyer password
or Supabase sign-in flow. Review request email addresses and queue processing
belong to the later email phase and should be minimized there.

Keep browser clients behind the store's server API. Store access credentials
remain server-only. Buyers and staff have separate authenticated write paths;
future shared staff identity does not automatically grant moderation rights.

## Photos and backups

The dedicated RMT bucket stores only normalized WebP derivatives, privately,
with policies independent of Tasks attachments. Pending-revision associations
exist; media moderation/publication remains unbuilt and text approval leaves
media pending. Future publication must expose only approved derivatives, with
withdrawal, deletion and abandoned-upload cleanup covering objects as well as
database rows. See [the media checkpoint](REVIEWS_MEDIA.md).

Back up images separately from database records: Supabase's database backups
do **not** include Storage file contents. Document and test both restore paths
before launch. [Backup coverage](https://supabase.com/docs/guides/platform/backups)

## Rollout sequence

No additional production Supabase project is planned. Database, storage, and
bandwidth usage will share RMT's capacity and allowances. Check actual usage
and the staging option before deciding whether hosting needs to change.

The content schema and direct RMT connection are implemented and applied. The
latest rollout verified remote history, an empty public-schema diff and
metadata-only availability of private photo tables and bucket settings. The
photo collection flag remains off by default; no deployment flag or credential
was changed by that rollout. Public SQL still exposes `photos: []`.

Remaining rollout work:

1. Prove Shopify login, token renewal, exact purchase semantics and the complete
   buyer/owner/public lifecycle on an isolated HTTPS target. Configuration and
   provider selection alone are not evidence of a working lifecycle.
2. Complete private buyer media previews/UI, staff media decisions, controlled
   publication and cleanup/retention before enabling photo collection.
3. Verify database and image-object backups/restores separately, rehearse
   collection pause/recovery and record the operational observation window.
4. Preserve the recorded decision to leave legacy reviews in Judge.me. No import
   is planned; export them before eventual uninstall and rehearse provider
   recovery while preserving new custom data. See [release](REVIEWS_RELEASE.md).

Use `node scripts/test-store-customer-auth.mjs` from `apps/tasks` for database
validation. It creates a uniquely named test stack on separate ports, replays
the selected profile from empty, checks private access and encrypted persistence
on RMT or Tasks access without store objects on PRD, then removes only its own
stack. Use `--target prd` for the local PRD-shaped check. Never use a loopback
`--db-url` to try to
reset a second database inside the existing app stack: CLI v2.115.0 treats it
as a default local-stack reset, ignoring the database name.
