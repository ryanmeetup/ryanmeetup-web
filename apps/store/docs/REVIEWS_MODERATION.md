# Review moderation handoff

Updated November 18, 2026. The private moderation database boundary, Tasks API,
and owner-facing queue at **Admin → Store reviews** are implemented.
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

The screen requires an existing Tasks app-owner session, checks ownership before
loading review data, and redirects demo preview away. An unconfigured backend
(including PRD) shows an explicit unavailable state without constructing a
review admin client. No SQL or environment changes were needed for the screen.

The initial queue loads in the Server Component; subsequent filtering, paging,
and refresh use the owner-only API. Confirmations show the exact revision being
decided. While saving, the reason, confirm/cancel controls, dismissal, and other
decisions are disabled. Success reloads the current filter from its first page.
Conflicts close the dialog and load the new text for a deliberate new decision.
Unknown write outcomes clear stale rows and require a manual refresh; a lost
acknowledgement never triggers a blind retry. A confirmed save whose reload
fails is reported as saved, with further decisions blocked until a fresh read.

UI ownership is split between the admin page client and
`apps/tasks/components/store-reviews/{ReviewModerationQueue,ReviewModerationCard,ReviewModerationDialog,useReviewModeration}`.
The initial server projection lives in
`apps/tasks/lib/server/store-reviews/moderation-screen.ts`.

The SQL is committed at
`apps/tasks/supabase/migrations/20261120160000_store_review_moderation.sql` and
registered as RMT-only. It builds on the existing review-content migration
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
ten recent audit events. Order IDs and customer subjects are omitted. Buyer
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

Add official reply controls as a separate backend/UI slice. The existing
`store_set_review_reply` RPC is service-only and takes an arbitrary staff label;
do not expose it directly through the buyer service credential. Add an RMT-only
owner-checked transactional wrapper, preserving exact review-version checks and
atomic audit recording, then include the current reply in the staff projection.
Use a focused editor for creating, editing, and removing the reply. Replies are
public content, so confirm the exact text and handle stale/lost responses like
publication decisions. Keep already-applied SQL immutable.

The queue currently exposes only the ten most recent audit events; a complete
history reader remains a separate chunk if needed. Live buyer collection still
requires the Shopify Customer Account client, configured credentials, and real
purchase/refresh verification described in `REVIEWS_SHOPIFY_AUTH.md` and
`REVIEWS_PURCHASE_ELIGIBILITY.md`. Photos, official reply controls, imports, and
production cutover remain separate chunks.
