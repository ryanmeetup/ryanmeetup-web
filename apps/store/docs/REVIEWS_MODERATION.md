# Review moderation handoff

Updated November 18, 2026. The private moderation database boundary, Tasks API,
and owner-facing queue at **Admin → Store reviews** are implemented, including
official public replies.
Judge.me remains the storefront default and the browser testing switch is
unchanged. No application deployment or collection flag was changed here.

## Completed chunks

- `ebe15894` — owner-checked, RMT-only moderation transactions, exact timestamp
  concurrency checks, queue projection, and database tests.
- `652b5a1e` — owner-only `GET/POST /api/admin/reviews`, strict request/response
  contracts, shared backend scope checks, and route tests.
- `fdf847da` — browser read/write operations, exact cursor preservation, and
  shared action labels/availability.
- `380afcf3` — `/admin/reviews`, server-loaded pending queue, comparison cards,
  confirmation dialogs, private history, page-access tests, and release note.
- `45e2c3df` — isolated browser fixture, 13 interaction/layout scenarios, and
  the `test:e2e:reviews` script wired into Tasks CI.
- `ef819f54` — owner-checked official reply transaction and compatible v2 staff
  projection, with database checks.
- `d131ab48` — private reply PATCH endpoint and shared reply-text normalization.
- `98f11a16` — reply editor, exact public preview, removal confirmation, and
  browser coverage (the suite now has 17 scenarios).

The screen requires an existing Tasks app-owner session, checks ownership before
loading review data, and redirects demo preview away. An unconfigured backend
(including PRD) shows an explicit unavailable state without constructing a
review admin client. The original queue needed no additional SQL; reply controls
use the RMT-only migration below. No environment values were changed.

The initial queue loads in the Server Component; subsequent filtering, paging,
and refresh use the owner-only API. Confirmations show the exact revision being
decided. While saving, the reason, confirm/cancel controls, dismissal, and other
decisions are disabled. Success reloads the current filter from its first page.
Conflicts close the dialog and load the new text for a deliberate new decision.
Unknown write outcomes clear stale rows and require a manual refresh; a lost
acknowledgement never triggers a blind retry. A confirmed save whose reload
fails is reported as saved, with further decisions blocked until a fresh read.

UI ownership is split between the admin page client and
`apps/tasks/components/store-reviews/{ReviewModerationQueue,ReviewModerationCard,ReviewModerationDialog,ReviewReplyDialog,useReviewModeration}`.
The initial server projection lives in
`apps/tasks/lib/server/store-reviews/moderation-screen.ts`.

The SQL is committed in `20261120160000_store_review_moderation.sql` and
`20261120170000_store_review_replies.sql` under
`apps/tasks/supabase/migrations`, both registered as RMT-only. They build on the
existing review-content migration
`20261120140000`; it has no dependency on the unfinished buyer-list migration.

## API and behavior

Staff sign in to Tasks using their existing app-owner account. A Shopify buyer
session or storefront service bearer does not grant moderation access. Both
read and write RPCs also recheck the onboarded owner inside the database. The
owner profile is share-locked until the transaction ends.

The enabled backend configuration in
`apps/tasks/lib/server/store-customer-auth/scope.ts` pins the shop and project.
The personal PRD project is always refused. Staff requests cannot choose a shop
or actor. No new environment variable or frontend secret was added.

`GET /api/admin/reviews` defaults to `filter=pending`. Other filters are
`published`, `hidden`, and `all`. Pages contain up to 20 reviews, oldest first,
without rating preference. Pass both returned `next.createdAt` and `next.id` as
`afterCreatedAt` and `afterId` for the next page; preserve the filter. No other
query keys, duplicate parameters, or partial cursors are accepted.

Each row has the product/variant snapshot, state, exact `createdAt`/`updatedAt`,
separate `pending` and `published` revisions, its `latest` revision, and up to
ten recent audit events. It also includes a nullable `reply` with its body and
exact `publishedAt`/`updatedAt` timestamps. Order IDs and customer subjects are omitted. Buyer
event actors are null. Staff identities and reasons stay private. The complete
history remains in the existing private revision/event tables; there is no
full-history browser endpoint yet.

`POST /api/admin/reviews` requires every field below:

```json
{
  "action": "approve",
  "reviewId": "the selected review UUID",
  "expectedUpdatedAt": "the exact updatedAt string returned by the queue",
  "revisionId": "the selected pending revision UUID",
  "note": null
}
```

Actions are `approve`, `reject`, `hide`, and `restore`. Approve/reject require
the pending revision ID. Hide/restore require `revisionId: null`. A private
reason of up to 1,000 characters is required for reject/hide; it can be null
for approve/restore. Whitespace is trimmed at the HTTP boundary.

**Preserve all six fractional timestamp digits.** Do not serialize the version
through JavaScript `Date`, which loses microseconds. Dates may be formatted for
display separately. A changed version, superseded edit, repeated action, wrong
shop, missing review, or buyer-withdrawn review returns `409 CONFLICT`; reload
before another decision. Lost owner authority returns 403.

A successful decision returns `{ "saved": true }`. The canonical state change
and staff audit event commit in one transaction. Rejection keeps the previous
approved version public. Hiding removes the review and its rating from public
reads immediately. Approval of a hidden edit keeps the review hidden until a
separate restore. Staff cannot restore a buyer withdrawal. Responses are
uncached and database error details never leave the server.

Request validation/types live in
`apps/tasks/lib/api-schema/store-review-moderation.ts` and
`apps/tasks/lib/store-reviews/moderation.ts`. The server projection/operations
live in `apps/tasks/lib/server/store-reviews/moderation.ts`.

### Official reply writes

`PATCH /api/admin/reviews` accepts exactly `reviewId`, `expectedUpdatedAt`, and
`body`. A nonempty string sets/updates the public reply; only an explicit null
removes it. Empty strings, missing bodies, and caller-provided authors/shops are
refused. The shared `reviewReplyBodySchema` normalizes whitespace, line endings,
control characters, and Unicode before checking the 2,000-character limit.

The editor previews that exact normalized text before sending it. Unchanged
replies cannot be resaved. Only reviews with an approved revision can receive
a reply; withdrawn reviews refuse writes. Preparing or changing a hidden reply
never restores the review. Edits preserve the reply's first published date.

`store_save_review_reply` rechecks the owner and exact review version, takes the
review row lock, delegates the reply/audit write to the canonical private
function, and advances the review's timestamp atomically. A failed audit rolls
back reply creation, replacement, or deletion. Reply changes also invalidate
stale publication decisions. The audit records actors/actions/times; prior
reply bodies are not kept as separate revisions.

`store_review_moderation_page_v2` reads the review version, reply, revisions, and
events from one statement snapshot. The original v1 function is unchanged so
older deployed strict response parsers keep working. Current staff code uses
v2. The public storefront reply projection remains only body/published date;
it never exposes staff identifiers or private concurrency fields. Neither reply
writes nor staff reads are exposed through the storefront service bearer.

## Database rollout

The moderation migration was applied to RMT (`lvfaartgcpphuokoswcm`) after an
isolated reset/test run and linked schema comparison. The dry run selected only
`20261120160000_store_review_moderation.sql`. The rollout used a separate linked
snapshot containing committed SQL so it could not accidentally apply another
agent's unfinished work.

The post-push linked diff reported **no schema changes**. Remote history confirms
the moderation version is applied. Live service-role checks confirmed an owner
can read the queue, a missing actor is denied with 42501, and a decision against
a nonexistent review returns false. Verification created no buyer, review, or
audit data and changed no review content.

The reply extension `20261120170000` was also applied to RMT from a committed
snapshot whose dry run selected only that migration. Its post-push linked diff
reported no schema changes. Live checks confirmed the v2 owner read works and
missing-review/actor reply writes are refused, without creating or changing any
review, reply, buyer, or audit content. PRD needs no SQL for this extension.

The uncommitted `20261120150000_store_buyer_reviews.sql` and its scope entry are
preserved in the worktree and were deliberately **not applied**. RMT therefore
has a deliberate history gap at that version. When its owner finishes and
commits it, inspect an RMT `db push --include-all --dry-run` plan before applying
it with `--include-all`, since its version precedes the applied moderation
migration. Never mark it applied without executing it and never modify the
already-applied moderation SQL.

PRD needs no SQL for this chunk. Its isolated profile excludes these store
functions, tables, and synthetic migration-history records. Do not apply store
extensions or RMT credentials to PRD.

## Validation

Official reply checkpoint:

- All 17 browser scenarios passed, including the previous moderation flows,
  exact normalized public preview, create/edit/remove, unchanged and oversized
  input, literal HTML rendering, hidden replies, stale editors, and lost reply
  acknowledgements. Reply editor/preview screenshots were inspected in both
  themes; checks cover 390/1024/1280/1536 widths.
- All 19 focused unit/API tests passed, including pinned owner/shop, exact
  timestamps, explicit-null removal, Unicode limits, and private failures.
- RMT's isolated runner passed 231 pgTAP assertions plus the existing encrypted
  storage and callback/logout race checks. PRD passed 65 access checks and
  excluded every store extension. All 16 migration-planner checks passed.
- Changed-file ESLint, Tasks TypeScript, and `git diff --check` passed. Normal
  Tasks and storefront production builds passed; the Tasks build retained its
  real database contract check. Browser checks use only the synthetic fixture.

Screen checkpoint:

- All 13 browser scenarios passed: one-star publication, rejecting an edit
  without replacing approved text, private reasons/history, hide/restore,
  approval while hidden, buyer withdrawals, stale edits, pending-save guards,
  lost acknowledgements, saved-but-failed refreshes, pagination, member/demo
  denial, and responsive content.
- Inspected queue and dialog screenshots in light/dark themes. Layout checks
  cover 390/1024/1280/1536 widths; long unbroken product names, display names,
  and review text also fit. The two layout scenarios were rechecked after
  aligning shorter approved versions at the top beside longer waiting edits.
- All 18 focused unit/API tests passed, covering page ownership, demo/disabled
  guards, private initial-load failures, transport behavior, admin routing, and
  the existing moderation API boundary.
- Changed-file ESLint, Tasks TypeScript, `git diff --check`, and the normal
  production build with its RMT database contract check passed.
- Run `npm run test:e2e:reviews --workspace=@ryanmeetup/tasks` for the isolated
  screen suite. It uses only synthetic credentials/project data and dedicated
  ports (app 3120, transport 54349), with no live Shopify calls. Its process-only
  transport shim preserves the production HTTPS/project-scope checks. The
  ordinary Tasks browser suite excludes this separately configured spec.

Earlier database/API checkpoint (no SQL changed for the screen):

- 28 focused Tasks route tests passed, including nine new moderation tests.
- The RMT isolated runner passed 196 pgTAP checks, two encrypted-storage tests,
  and the existing competing-callback/logout-refresh checks. That total includes
  the separate buyer-review work currently in the shared worktree.
- The PRD isolated profile passed 65 access checks and confirmed store objects
  are absent.
- All 16 migration-scope/catch-up planner tests passed. The real-catalog test
  now checks all registered RMT extensions instead of hardcoding only the first.
- Tasks TypeScript, changed-file ESLint, `git diff --check`, and the production
  build with its normal RMT database contract check passed.

Use the isolated runner in `apps/tasks/scripts/test-store-customer-auth.mjs`
for future database checks, one profile at a time. Never reset the existing
Tasks local stack or use a second loopback database URL as supposed isolation.

## Next small chunk

Start the **Judge.me import dry run** described in `REVIEWS_REBUILD.md`: inventory
source reviews/replies/media, retain source identifiers, map products, and
report duplicates, skipped test records, unmapped products, and discrepancies.
Keep this first chunk read-only with no database import or provider cutover.
Recheck current source contracts before designing imported-review storage;
legacy records may not have the exact order-line identity required of new
authenticated submissions. Keep already-applied SQL immutable.

The queue currently exposes only the ten most recent audit events; a complete
history reader remains a separate chunk if needed. Live buyer collection still
requires the Shopify Customer Account client, configured credentials, and real
purchase/refresh verification described in `REVIEWS_SHOPIFY_AUTH.md` and
`REVIEWS_PURCHASE_ELIGIBILITY.md`. Photos, imports, and
production cutover remain separate chunks.
