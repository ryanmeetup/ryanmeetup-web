# Store review moderation

Reviewed November 20, 2026 against the Tasks UI, API, schemas and migrations.
The Store uses custom reviews only. This guide owns staff behavior; buyer rules
are in the [overview](reviews.md), and migration status is recorded once
in the [database guide](review-database.md).

## Staff access and screen

An existing onboarded Tasks **app owner** uses `/store-reviews` in the sidebar.
The red badge counts nonwithdrawn reviews with pending text or undecided photos
on pending/published text, once per review. Old
`/admin/reviews` links redirect. Demo preview is refused; PRD or an unconfigured
integration shows unavailable without constructing a review admin client.

`STORE_REVIEWS_CUSTOMER_AUTH_ENABLED=true` and a valid
`STORE_REVIEWS_CUSTOMER_AUTH_SCOPE` configure the Tasks side. The scope includes
shop/client/issuer/callback. `STORE_REVIEWS_SUPABASE_PROJECT_REF` defaults to RMT;
it must match `NEXT_PUBLIC_SUPABASE_URL` exactly and cannot be PRD. These are
independent of the Store's sign-in/photo flags. A Shopify buyer session does not
grant moderation. Browser requests cannot choose their shop or actor; write
RPCs recheck owner authority inside the transaction.

Moderation links a product title to the Store's `/products/id/<shopify id>`,
which redirects to that product's canonical page (404 when unpublished or
deleted). `NEXT_PUBLIC_STORE_REVIEWS_STOREFRONT_URL` sets the Store origin and
defaults to `https://store.ryanmeetup.com`; it is inlined at build time.

The server loads the first queue page. The client provides pending, published,
hidden, rejected and all filters, a product filter, twenty-row pagination and
refresh. Rows show pending/published/rejected text, verification, a nullable
reply and at most ten recent audit events. Order IDs and buyer subjects are
omitted; staff reasons and identities remain private.

## API contracts

All routes below are owner-only, same-origin for mutations, uncached, strictly
validated and return safe errors. The server lives in
`apps/tasks/lib/server/store-reviews/moderation.ts`; request schemas and exact
version parsing live in `apps/tasks/lib/api-schema/store-review-moderation.ts`
and `apps/tasks/lib/store-reviews/moderation.ts`.

| Method / route | Fields or query | Result |
| --- | --- | --- |
| `GET /api/admin/reviews` | `filter` (default pending), optional numeric `productId`; paging requires both `afterCreatedAt` and `afterId`. No duplicate/extra query keys. | Up to twenty reviews, product options and a next cursor. Uses `store_review_moderation_page_v5` and `store_review_moderation_products`. |
| `POST /api/admin/reviews` | Exactly `action`, `reviewId`, `expectedUpdatedAt`, `revisionId`, `note`. | `{saved:true}` after transactional decision/audit. |
| `PATCH /api/admin/reviews` | Exactly `reviewId`, `expectedUpdatedAt`, `body`. Nonempty normalized body sets a reply; explicit null removes it. | `{saved:true}` after transactional reply/audit. |
| `GET /api/admin/reviews/photos` | Exactly `reviewId`, `revisionId`, `photoId`, `expectedUpdatedAt`. | Owner-only verified WebP preview; old versions become unavailable. |
| `POST /api/admin/reviews/photos` | Those four fields plus `action` (`approve`/`reject`) and nullable `note`; reject requires a private reason. | Atomic independent media decision/audit/version update. |
| `DELETE /api/admin/reviews` | Exactly `reviewId`, `expectedUpdatedAt`, `reason`, nullable `note` up to 1,000 characters. | `{deleted:true,photosRemoved:boolean}`; stale/missing review returns 409. |

**Keep all six fractional timestamp digits.** Do not round-trip concurrency
versions through JavaScript `Date`. A stale version or superseded action returns
409 and requires a fresh decision. Lost authority returns 403.

## Decisions and replies

- Approve/reject use the pending revision ID. Reject requires a reason written
  for the buyer, displayed privately on My reviews until resubmission.
  Rejection retains the text/history and leaves any previous approved version
  public; it is not deletion.
- **Publish anyway** uses the latest rejected revision ID. It is refused after
  a newer buyer revision and is audited as approval.
- Hide/restore use a null revision ID. Hide requires a private reason and removes
  the rating from subsequent public reads. Approval/publish-anyway on a hidden
  review keeps it hidden until a separate restore.
- A buyer withdrawal cannot be restored by staff. Resubmission clears the old
  publication date; approving it establishes a fresh date.
- Publishing text saves in one click and carries no note. Photo decisions still
  require loading the image and confirming their separate decision.
- Replies require an approved revision and refuse withdrawn reviews. A hidden
  reply stays hidden. The shared reply schema normalizes plain text, caps it at
  2,000 characters and drives the editor preview. Edits keep the original public
  reply date. Prior reply bodies are not stored as separate revisions.
- Transactions include the canonical mutation, audit and review-version advance.
  Audit failure rolls the write back. No mutation silently retries a lost response.

While saving, controls and dismissal are disabled. A confirmed save reloads the
current filter from its first page. Conflicts close the dialog and reload;
unknown outcomes remove stale rows until manual refresh. A saved change whose
reload fails is reported as saved, with further writes blocked until refresh.

## Photo decisions

Each current text version shows its ordered photos and their status. Photos
need no separate approval: publishing a version (Publish review, Publish edit,
Approve revision, or Publish anyway) approves its undecided photos in the same
transaction, under the version's own `approved` event. To keep a photo off the
storefront, reject it before publishing; a rejected photo stays rejected. Approve
photo remains for undoing a rejection and for an undecided photo already on the
live version. The image must load before a decision; failed previews have retry. Rejection requires a reason
written for the buyer: Tasks shows it under the photo, and the buyer reads it on
My reviews and beside the photo in the editor until a new text version resets the
photo to pending or staff approve it. Approval notes stay private. New text
versions reset retained photos to pending.

Only approved photos on active published text appear in the Store. Hiding,
withdrawal, replacement, rejection or deletion makes old public paths unavailable.
The bucket stays private; Store and Tasks serve verified bytes without signed
Storage URLs or image-optimizer caching. See [media](review-media.md) for limits.

## Permanent deletion

The Delete action is available on any review, including a withdrawn one. The
confirmation shows the review, requires a reason and an affirmation that its
rating/positive-or-negative opinion played no part. The supported policy codes
are `spam`, `false_or_misleading`, `unrelated`, `confidential`, `abusive` and
`discriminatory`. The UI explains the review-suppression rule; see the
[FTC's guidance](https://www.ftc.gov/business-guidance/resources/complying-consumer-reviews-testimonials-rule-questions-answers).
These controls do not authorize removing criticism because it is negative.

`store_delete_review` locks the review, checks owner/shop/exact version, takes
the attachment lock, removes revisions/events/reply/photo associations and
inserts `store_review_deletions` in one transaction. The restricted deletion
row retains reason, latest rating, product, publication/verification flags,
actor/time, review creation time and photo count; it retains no review text or
buyer identity. Keep the private note free of those details too.

The function returns deleted photo IDs. Tasks then removes their derived
private Storage objects. Failure here cannot restore the committed review:
the API reports `photosRemoved:false`, logs the cleanup failure and the UI
warns staff. Files remain private and unreferenced. No background retry job or
deletion-log browser is implemented; include orphan cleanup in operations.

## Verification

From `apps/tasks`:

```sh
npx vitest run tests/routes/store-review-moderation.test.ts tests/unit/review-moderation-client.test.ts tests/unit/review-moderation-screen.test.ts
npm run test:e2e:reviews
```

The browser configuration uses isolated synthetic transports on app 3120 and
transport 54349. It covers decisions, replies, product/rejected filters,
policy-confirmed deletion, stale/uncertain writes, permissions and responsive
light/dark layouts. Database checks use both profiles sequentially as described
in the database guide. These tests do not prove a real Shopify buyer lifecycle.

Failed-removal cleanup and full-history/deletion-log browsing are outside the
current owner queue. Their status and optional scope
are tracked in the [roadmap](../planning/roadmap.md#14-store-reviews). Use the
[operations rehearsal](../how-to/review-operations.md#live-lifecycle-rehearsal) to verify
the live buyer → owner → public lifecycle.
