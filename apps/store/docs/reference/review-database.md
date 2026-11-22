# Reviews on the shared Ryan Meetup backend

Reviewed November 20, 2026. The table records the Store migration inventory;
versions are RMT-only. The photo-publication implementation was tested against
both isolated profiles. Applied history alone is not a fresh schema/grant audit.

## Ownership and access

Use **RMT**, project `lvfaartgcpphuokoswcm`, shared with
`tasks.ryanmeetup.com`. The Store owns review APIs and Shopify buyer sessions;
Tasks owns staff authentication/moderation. Shopify owns products, orders,
fulfillment and buyer identity.

**PRD**, `vjsnobmfsfrsnwukfaoq` / `projects.ryanle.dev`, remains independent.
Store credentials and extensions never target it. Buyer sign-in must not create
Supabase Auth users, Tasks profiles or workspace membership.

The Store uses server-only `SUPABASE_URL` and `SUPABASE_SECRET_KEY` through
[`store-database.ts`](../../lib/store-database.ts). It accepts only the exact RMT
origin, or HTTP localhost/127.0.0.1 outside production. An arbitrary hosted
Supabase branch is not currently accepted. Tasks moderation checks its own
configured HTTPS project and refuses PRD.

The Supabase secret bypasses RLS across the project, **including Tasks data**.
Fixed commands, strict validation and pinned shop scope limit application
behavior; the credential itself is not restricted to Store tables. Do not claim
that Store RLS protects Tasks from a compromised Store server. Never expose the
key, tokens, private records or database client in browser props.

## One immutable migration history

SQL lives in `apps/tasks/supabase/migrations`. Every Store filename uses the
`store_` prefix and its version is explicitly `rmtOnly` in
`apps/tasks/supabase/migration-scopes.json`. Do not create a second migration
history under the Store or rewrite applied SQL.

| Version | Capability | RMT history, November 20 |
| --- | --- | --- |
| `20261120130000` | Encrypted buyer authorization/session storage | Applied |
| `20261120140000` | Reviews, revisions, replies, audit and public reads | Applied |
| `20261120160000` | Owner moderation and queue | Applied |
| `20261120170000` | Official replies and staff projection v2 | Applied |
| `20261120180000` | Buyer paging, scoped lookups and version-checked writes | Applied |
| `20261120190000` | Revoke every session for a buyer | Applied |
| `20261120200000` | Required review title | Applied |
| `20261120210000` | Unverified product reviews and verification projections | Applied |
| `20261120220000` | Private photo drafts/bucket and idempotent staging | Applied |
| `20261120230000` | Upload budget, protected claims and atomic attachments | Applied |
| `20261121000000` | Private current-selection and preview reads | Applied |
| `20261121010000` | Rejected queue, publish-anyway and product filter; staff v4 | Applied |
| `20261121020000` | Audited permanent review deletion | Applied |
| `20261121030000` | Owner photo decisions/previews, staff v5 and revocable public images | Applied |
| `20261121040000` | Buyer-facing rejection reasons until resubmission | Applied |
| `20261121050000` | Bounded latest public reviews across the shop | Applied |
| `20261121060000` | Paged public review feed across the shop | Applied |
| `20261121070000` | Photo rejection reasons for staff and the buyer | Applied |
| `20261121120000` | Shared review write budgets | Applied |
| `20261121130000` | Approval publishes undecided photos | Applied |
| `20261121140000` | Half-star ratings | Applied |
| `20261121150000` | Etsy review import: `source`, untitled imports, import RPC and `source` in projections | Applied; 148 Etsy reviews imported November 21 |
| `20261121160000` | Numbered public review pages: `store_public_review_search` (filters, sort, search, total, focus) and the shared `store_public_review_json` projection | Applied November 21 |
| `20261121180000` | Daily cleanup: `store_review_cleanup` deletes expired sign-in, budget and photo rows and lists photo objects to remove | Applied November 21 |

The timestamp-shaped versions are identifiers, not evidence of deployment time.
Photo publication was applied to RMT and verified for private-bucket and
backend-only invoker grants. PRD receives only
shared Tasks migrations through the scoped catch-up planner. Never add fake
Store history on PRD. Leave any previously applied extension objects/history
there untouched; see [migration profiles](../../../tasks/docs/DATABASE.md#migration-profiles).

## Imported Etsy reviews

`20261121150000` lets `store_reviews` hold reviews imported from the Etsy shop:
`source = 'etsy'`, `source_review_id` is the Etsy review id (unique, so the
import re-runs safely) and the owner is the namespaced subject
`etsy:<review id>`, which no Shopify buyer session can hold. `product_id` is the
Shopify product when the listing has one and otherwise the Etsy listing id, so
the review appears only in the feed and home showcase under its stored title,
like a delisted product's. Only imported revisions may omit a title; a trigger
keeps titles required for store reviews. Public and staff projections add
`source`, and their parsers accept rows without it, so code and migration can
land in either order. `store_import_etsy_review` writes one published review
with its reply and pre-staged photos. Run the import with
`apps/store/scripts/import-etsy-reviews.ts`; `etsy-review-products.json` beside
it decides which Etsy listings attach to Shopify products.

## Data and permission boundaries

- `store_customer_authorizations` and `store_customer_sessions` hold scoped
  encrypted envelopes, expiry/revision metadata and consumed/revoked tombstones.
- `store_reviews`, `store_review_revisions`, `store_review_replies` and
  `store_review_events` separate pending text from approved public content.
  Identity/order/line references remain private. Verified and unverified reviews
  have separate uniqueness rules.
- `store_review_photo_drafts`, `store_review_revision_photos` and
  `store_review_photo_budgets` own private staging, revision selections and abuse
  limits. Bytes live in the private `store-review-photos` bucket.
- `store_review_write_budgets` throttles review writes so one buyer, or one
  network cycling throwaway Shopify accounts, cannot flood moderation. The Store
  server checks every rule for a write in one `store_consume_review_write_budget`
  call (all consumed or none): submissions allow 10 per buyer per hour, 30 per
  buyer per day and 20 per network per hour; edits allow 20 per buyer per hour;
  withdrawals are never limited. Network actors are HMACs of the client IPv4
  address or IPv6 /64, never raw addresses, and rows older than two days are
  pruned on the next allowed write. Budgets live in `lib/review-write-limits.ts`.
  Until the migration lands, a missing function lets writes through; any other
  failure refuses the write.
- `store_review_deletions` is a restricted append-only audit: reason, product,
  latest rating, publication/verification flags, actor/time and photo count;
  no retained review body or buyer identity. Staff may write a private note.
- New public-schema tables require explicit grants. Private Store tables/RPCs
  exclude anon and ordinary Tasks members; service-only functions run as
  invoker. Staff RPCs additionally recheck an onboarded Tasks owner.
- Public RPCs expose approved active fields and complete rating totals through
  the Store backend. Photo projections include only approved media on the
  active approved revision, through revocable Store URLs. Approving a revision
  approves its undecided photos (rejected ones stay rejected) but never
  restores hidden/withdrawn content.

Store only the purchase references and display snapshots needed for reviews,
not a mirrored order database, addresses or payment details. Private notes must
not be used to retain the deleted review text or buyer details.

## Validation and rollout

For future schema changes, follow the repository workflow and
[Tasks database guide](../../../tasks/docs/DATABASE.md): new immutable migration,
explicit RMT scope/grants, both isolated profiles, linked comparison, relevant
contract tests, then committed rollout to RMT and remote verification.
No PRD dashboard SQL is needed for Store-only extensions.

Run these **sequentially** from `apps/tasks`; they share disposable test ports:

```sh
node scripts/test-store-customer-auth.mjs
node scripts/test-store-customer-auth.mjs --target prd
node --test scripts/migration-plan.test.mjs scripts/build-catchup-sql.test.mjs
supabase migration list --linked
```

The runner copies selected canonical SQL into a uniquely named local stack on
separate ports. RMT checks private data/grants, transactions, photo claims and
encrypted storage; PRD proves Tasks works without Store objects/history. It
removes only its own stack. Never reset the existing app stack or use a second
loopback `--db-url` as isolation: that previously reset the app's local database.

## Operational limits and related guides

SQL deletion and Storage removal are separate operations. Review withdrawal
retains history and is not data erasure. Supabase database backups
[exclude Storage object contents](https://supabase.com/docs/guides/platform/backups).
Capacity is shared with RMT Tasks; no additional production project is planned.

See [review operations](../how-to/review-operations.md) for recovery/verification
procedures, [media](review-media.md) for current private-media behavior and
[the roadmap](../planning/roadmap.md#14-store-reviews) for cleanup, retention,
hosted verification and isolation work.
