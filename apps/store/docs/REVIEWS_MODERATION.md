# Review moderation handoff

Updated November 18, 2026. This checkpoint implements the private moderation
database boundary and Tasks API. The owner-facing screen is the next chunk.
Judge.me remains the storefront default and the browser testing switch is
unchanged. No application deployment or collection flag was changed here.

## Completed chunks

- `ebe15894` — owner-checked, RMT-only moderation transactions, exact timestamp
  concurrency checks, queue projection, and database tests.
- `652b5a1e` — owner-only `GET/POST /api/admin/reviews`, strict request/response
  contracts, shared backend scope checks, and route tests.

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
- No layout changed in this checkpoint; browser visual testing is pending with
  the admin screen.

Use the isolated runner in `apps/tasks/scripts/test-store-customer-auth.mjs`
for future database checks, one profile at a time. Never reset the existing
Tasks local stack or use a second loopback database URL as supposed isolation.

## Next small chunk

Add `/admin/reviews` using `loadWorkspacePage({ owner: true })`, the established
`AdminPageShell` and `PageHeader`, and the admin route registry. Load the initial
page on the server; use the existing mutation helpers for decisions. Keep the
page explicitly unavailable in demo mode and when store integration is disabled.

Use `DropdownSelect` for the queue filter. Show waiting content beside its
approved version when there is an edit, with clear hidden/withdrawn status and
the recent history. Collect required private reasons for hide/reject. Disable
decisions while saving, announce success/errors, and reload on conflicts. Avoid
optimistic publication: render the server-confirmed result.

Then validate the screen at mobile and 1024/1280/1536 desktop widths in both
themes and add a user-facing Tasks release note. Live buyer collection still
requires the Shopify Customer Account client, configured credentials, and real
purchase/refresh verification described in `REVIEWS_SHOPIFY_AUTH.md` and
`REVIEWS_PURCHASE_ELIGIBILITY.md`. Photos, official reply controls, imports, and
production cutover remain separate chunks.
