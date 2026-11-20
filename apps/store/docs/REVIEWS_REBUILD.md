# Ryan Meetup reviews rebuild

Updated **November 20, 2026**, against the custom-only Store source, including
Claude's Judge.me removal (`93bf9c40`, `db592573`), sidebar moderation
(`2f200649`) and private photo reads (`45686fd9`, CI `a159ac3a`). Earlier
checkpoints are available in Git history; this file describes current
implementation and evidence.

## Where we are

The **text-review system is built**: Shopify buyer sign-in, purchase checks,
verified/unverified submission, buyer editing/withdrawal, owner moderation,
official replies, public pagination, complete rating totals and product JSON-LD.
The Store now uses **custom reviews only**. `REVIEWS_PROVIDER`, the provider
switch, localhost review-mode control and Judge.me read/submission integration
have been removed. Setting an old provider variable cannot restore them.

The committed [Judge.me removal record](REVIEWS_JUDGEME_REMOVAL.md) records
Ryan's decision to remove the service without exporting or importing its old
reviews. Judge.me is **not a recovery provider**. Its Shopify uninstall,
Shop review/email settings and obsolete environment-variable cleanup remain
listed there as external follow-ups; this audit did not perform those actions.

The **photo backend is built, with UI and publication still incomplete**:
normalization, private staging, atomic pending-revision association, upload
limits, owner-scoped selection reads and authenticated previews. All photo
routes require `STORE_REVIEW_PHOTOS_ENABLED=true`, which defaults off. This
work did not enable that deployment setting. Public SQL still returns
`photos: []`; no new custom photo is publicly accessible.

All eleven Store migrations through `20261121000000` are applied to RMT.
PRD receives no Store migration.

Implementation and local tests do **not** establish the complete live
Shopify-backed buyer/owner lifecycle, token renewal, real order semantics,
operational monitoring or recovery. The recorded production switch to custom
on November 20 is separate from that missing evidence. No real buyer review or
photo was created by this follow-up.

## What exists today

| Area | Implemented | Practical limit / remaining work |
| --- | --- | --- |
| Store review source | Direct RMT reads/writes; custom reviews only. Anonymous Judge.me forwarding, legacy form and provider selection are gone. | External Judge.me/Shop entry points and obsolete secrets need cleanup per the removal record. No legacy import is planned. |
| Shopify authentication | Start/callback, public discovery, PKCE, state/nonce/browser binding, confidential token exchange and signed ID-token verification. | Intended client permissions, protected data access and real buyer sign-in require redacted live evidence. |
| Sessions/account | Opaque Secure/HttpOnly cookies, encrypted server storage, seven-day absolute session, renewal, revision checks, account menu, My reviews, sign-out and account switching. | Real renewal/rotation/reuse and account switching need rehearsal. Refresh coalescing is within one process; no expiry cleanup job. |
| Purchase verification | Product order discovery, owned order/line verification, exact product/variant snapshots, current session checks and Shopify-derived names. | Conservative bounded scans; real refund/edit/fulfillment semantics remain to be proven. Lookup failure never becomes permission for an unverified review. |
| Buyer composer | Whole stars 1–5, required title up to 100 characters, required body up to 5,000, purchase picker, full/first-initial/anonymous display name and preview. | Text UI only. No photo picker or attachment editor yet. Without sign-in, Write a review is disabled with an explanation. |
| Submission | Same-origin authenticated `POST /api/reviews`, current purchase recheck, server-owned identity/name/item snapshots, pending revision and duplicate protection. Optional private photo IDs attach atomically when enabled. | A successful lookup with no eligible line permits unverified product feedback; an eligible line must be selected. Live write lifecycle remains unproven here. |
| Buyer management | Private `/reviews/mine`, paginated reads, exact-version edits, withdrawal, uncertain-response recovery, recent purchases with variant/order context and collapsible review sections. Separate photo-selection read includes its exact version. | Not a Shopify account extension. Buyer photo UI/version reconciliation is not wired yet. |
| Persistence | Reviews, revisions, official replies and audit; separate pending/approved content; one verified review per order line and one unverified review per buyer/product. | Retention, customer export/removal and tested recovery remain open. Withdrawal is not deletion. |
| Staff moderation | Owner-only Tasks `/store-reviews` in the sidebar, waiting-count badge, queue/API, filters, paging, approve/reject/hide/restore, reasons, exact-version conflicts and recent audit history. Official reply create/edit/remove is transactional; old admin links redirect. | No separate moderator role, media decisions or full-history browser API. The sidebar/count work is committed separately from this photo follow-up. |
| Public reviews | Approved active revisions only, complete totals/distribution, twenty-row pages, load-more/retry/accessibility states, duplicate suppression and stale-response cancellation. | Totals remain the initial server snapshot until refresh. Distribution, per-review item attribution and edited timestamp are not displayed. |
| Verification | Canonical `verifiedPurchase` produces Verified purchase; unverified reviews remain visible without the badge. | No browser/provider inference can grant purchase verification. Component support for a legacy badge does not restore a legacy reader. |
| Replies/product schema | Public reply body/date, safe plain text, UTC display; selected-design ratings, images/offers and JSON-LD stay together through initial HTML and navigation. | Real owner-to-public rehearsal remains. Empty/unavailable ratings omit aggregateRating. |
| Photos | Still-image validation/re-encoding, private owner/product drafts, digest-bound retries, bounded uploads, atomic ordered selection, private current-selection reads and byte previews. | Off by default. Buyer UI, staff approval, controlled publication, cleanup and object recovery remain. Existing gallery/old image-host allowlist are not custom publication. |
| Support/diagnostics | Scoped revoke-all-buyer-sessions RPC; sanitized Store backend failure event with fixed operation/category/allowlisted code. | No support UI, hosted alert/retention setup or complete auth/Shopify/media monitoring. See [operations](REVIEWS_OPERATIONS.md). |

## Current buyer and publication rules

1. A real Shopify session is required. The server derives the buyer subject and
   public name; browser fields cannot select identity, purchase snapshots or
   arbitrary public names. Shopify IDs stay strings.
2. Submission repeats the purchase lookup. Eligible paid/fulfilled lines must
   be reviewed through the chosen exact line and get purchase verification.
   A completed lookup with no eligible line permits an unverified product
   review. Provider/storage/inconsistent-session errors remain unavailable.
3. The database enforces one verified review per shop/order/line, regardless of
   purchased quantity. Unverified feedback has a separate shop/buyer/product
   uniqueness limit. Repeated submission reports the existing review.
4. Both paths create pending revisions. Edits wait while the approved version
   remains public. Rejecting an edit preserves that approved version. Hidden
   reviews may be withdrawn, but not edited; text approval does not restore them.
5. Withdrawal removes the review and its rating from subsequent public reads.
   Staff cannot restore a buyer withdrawal. Resubmission reuses the record and
   gets a fresh publication date after approval. Existing pages need a refresh.
6. Buyer/staff mutations compare the exact database version, including six
   fractional timestamp digits. Uncertain responses do not trigger blind writes.
7. Auth tokens, private buyer/order data, moderation notes and private media
   context never enter public review payloads. New media decisions start pending;
   approving text does not approve photos.

Exact-line verification currently requires paid, non-cancelled, non-edited
orders, matching product/variant snapshots, exact-line fulfillment and no
refunded units. `SUCCESS` fulfillment does not prove delivery. Refunds on another
line may leave this line eligible. Skipped/refunded/edited lines can lead to
unverified feedback after a completed healthy lookup, without a purchase badge.
There is no staff eligibility override or proof of refund-versus-receipt order.

Order discovery scans at most ten pages of ten orders; incomplete discovery
remains unavailable. Product lookup has a thirty-query budget and may retain
already fully verified recent lines when later candidates exhaust it. With
none it returns `none/needs_help`, handled by the unverified path. Owned-order
verification bounds lines/fulfillments to ten requests; a fulfillment's child
lines stop at fifty and fail closed when more exist. See
[purchase eligibility](REVIEWS_PURCHASE_ELIGIBILITY.md).

## Private media: implemented boundary

The processor accepts still JPEG/PNG/WebP, validates actual format/animation,
limits input to 10 MiB/40 million pixels, applies orientation, removes metadata
and returns WebP up to 2048px per edge and 4 MiB. The HTTP upload cap is **4 MiB**,
with actual streamed-byte enforcement and a ten-second body deadline. Native
processing has its own ten-second limit. Two upload pipelines per process and
thirty attempts per buyer/shop per ten minutes bound collection.

Drafts are private, buyer/product scoped, limited to five active slots and
initially expire after one hour. Same-key retries require identical normalized
content. Uncertain finalization leaves the object private for retry/cleanup;
confirmed discard precedes object deletion. No expiry sweep exists.

Submit/edit RPC wrappers attach up to five unique owned ready/unexpired objects
or retained media from that same review. Invalid media rolls back text,
revisions, versions and audit together. A draft is claimed for one review.
Text-only edits retain the selection; explicit arrays replace it, and an empty
array removes it from the new revision. Approved selections remain intact.

The new private GETs provide current ordered references plus the review version,
and verified bytes through the Store. Preview eligibility follows buyer text:
pending, else approved, else latest buyer attempt by audit order. Removed or
historical selections cannot preview. Owners may privately inspect their own
current hidden/withdrawn review. Ready drafts must remain unexpired.

Previews require an active session and same-origin read, stream at most the
expected size, verify length/SHA-256, repeat photo authorization and recheck the
session before returning. Four preview pipelines run per process without a
queue. Responses are uncached WebP with same-origin resource policy, cookie
variance and nosniff; no signed storage URL/path is issued. A photo-specific
Next header rule preserves no-referrer on actual HTTP responses. Future UI must
bypass server image optimization for this cookie-authenticated path and clear
loaded previews on account changes. See [media implementation](REVIEWS_MEDIA.md).

## Backend and migration state

RMT is `lvfaartgcpphuokoswcm`; PRD is `vjsnobmfsfrsnwukfaoq` and stays separate.
The Store pins RMT with `SUPABASE_URL`/`SUPABASE_SECRET_KEY`; nonproduction
loopback is also allowed. The service key bypasses project-wide RLS and must
remain server-only. Fixed operations and strict schemas constrain application
usage; the credential itself is not limited to Store tables. Buyer sign-in does
not create a Supabase user or Tasks workspace membership.

Canonical SQL stays in `apps/tasks/supabase/migrations`; every Store version is
explicitly RMT-only in `migration-scopes.json`. Applied files are immutable.

| Version | Capability | RMT |
| --- | --- | --- |
| `20261120130000` | Encrypted buyer authorization/session storage | Applied |
| `20261120140000` | Reviews, revisions, replies, audit and public reads | Applied |
| `20261120160000` | Owner moderation and queue | Applied |
| `20261120170000` | Official replies and v2 staff projection | Applied |
| `20261120180000` | Buyer paging, scoped lookups and version-checked writes | Applied |
| `20261120190000` | Revoke all sessions for a buyer | Applied |
| `20261120200000` | Required review title | Applied |
| `20261120210000` | Unverified product reviews and verification projections | Applied |
| `20261120220000` | Private photo drafts/bucket and idempotent staging | Applied |
| `20261120230000` | Upload budget, protected claims and atomic attachments | Applied |
| `20261121000000` | Private current-selection and preview reads | Applied |

Before this follow-up's rollout, remote history showed only the last version
pending; the schema comparison contained exactly its two new read functions.
Both isolated database profiles passed. No Store SQL or fake history goes to PRD.
Remote history now confirms all eleven versions with none pending. Metadata
probes with nonexistent synthetic IDs verify both RPCs return null, and the
bucket remains private, WebP-only and capped at 4 MiB. No buyer rows/files were
read/written. The final post-rollout public-schema comparison is empty.
The CLI comparison was rerun successfully on its own after a temporary login
failure during parallel verification.

## What to build or prove next

1. **Buyer photo UI.** Use shared FileDropField for selection, format/4 MiB
   guidance, upload/retry/removal, previews and retained attachments on edits.
   Compare photo/text versions and clear previews on account changes. The private
   backend exists; composer and My reviews wiring remain.
2. **Staff media approval and publication.** Add independent media decisions,
   approved-only projections and an access model that responds to hide/withdraw.
   A permanent public URL must not outlive removal. Replace the residual old
   image-host allowlist only when the custom publication model exists.
3. **Lifecycle cleanup and recovery.** Bound expired auth/session/draft/budget
   cleanup, failed uploads, removed/historical media, retention and customer
   export/deletion. Back up and restore image objects separately from SQL.
4. **Live Shopify/lifecycle proof.** Confirm the confidential client, protected
   customer data access, exact HTTPS callback and an isolated test target.
   Prove sign-in/return, encrypted persistence, renewal/rotation, logout/switch,
   normal/split/unpaid/cancelled/edited/refunded orders and foreign ownership;
   then submit → owner decision/reply → public read → edit/reject/withdraw.
5. **Operations.** Rehearse custom collection pause/resume and recovery, add
   auth/text-write abuse limits, hosted alerts/retention and availability/latency
   monitoring. Existing upload budgets/process bounds are not the whole abuse
   model. Complete external Judge.me/Shop cleanup from the removal record.
6. **Later product work.** Review-request emails need proven delivery events,
   timing, eligible-line rechecks, deduplication, opt-outs, mail delivery and
   observability. Customer-account extensions and eligibility overrides remain
   separate features. No Judge.me import is planned.

A local backend plus HTTPS Store tunnel fits the Store's current URL guard.
Tasks moderation currently expects a pinned HTTPS Supabase project origin, so
an isolated combined buyer/owner rehearsal still needs deliberate supported
configuration. Do not use production RMT as a Preview test database or swap
Tasks instances' credentials.

## Validation evidence for this follow-up

- RMT from empty: **419 database assertions**, including 36 new private-read
  checks; two encrypted-storage integration tests and five concurrency checks.
  PRD from empty: **65 assertions**, no Store tables/functions/bucket. The
  existing app stack was not reset. All **16** migration-planner tests passed.
- After the custom-only removal, the focused Store photo/review/public run
  passed **102 tests**. The preceding photo-focused run passed 76; the earlier
  broader run passed 205 before legacy test removal. Its two storage cases skip
  without a container and pass inside the isolated RMT runner.
- All **21** isolated HTTP/browser scenarios passed against the custom-only
  source, including the two new disabled private-read routes. The preceding
  22-scenario run caught and verified the scoped referrer-policy fix; removal
  subsequently retired a provider-switch scenario.
- Store production build, changed-file ESLint, Store/Tasks typechecks, **26**
  current Tasks contract/client/route/count tests and workflow parsing passed at
  their recorded checkpoints. Generated types for the deleted provider preview
  route were refreshed; no source error was suppressed.
- Hosted CI execution and the live Shopify/media lifecycle are not claimed.
  No photo flag, deployment credential or buyer content was changed by these
  checks. See [release readiness and recovery](REVIEWS_RELEASE.md).

Useful commands, from the indicated workspace:

```sh
# apps/store: server-free photo and buyer boundaries
STORE_BASE_URL=http://127.0.0.1:39999 npx playwright test tests/review-photo-processing.spec.ts tests/review-photo-staging.spec.ts tests/review-photo-actions.spec.ts tests/review-photo-reader.spec.ts tests/review-photo-reads.spec.ts tests/custom-review-submission.spec.ts tests/my-review-actions.spec.ts tests/review-backend.spec.ts --workers=1 --output=test-results-public-reviews/photo-unit

# apps/store: isolated public/HTTP browser fixtures
npx playwright test --config=playwright.product-reviews.config.ts

# apps/tasks: separate isolated stacks, one profile at a time
node scripts/test-store-customer-auth.mjs
node scripts/test-store-customer-auth.mjs --target prd
node --test scripts/migration-plan.test.mjs scripts/build-catchup-sql.test.mjs
```

## Source map

| Boundary | Source |
| --- | --- |
| Shared contracts | [`packages/reviews/src`](../../../packages/reviews/src/index.ts) |
| Buyer identity | [`customer-account`](../lib/customer-account/runtime.ts), [auth setup](REVIEWS_SHOPIFY_AUTH.md) |
| Eligibility / submission | [`review-purchases.ts`](../lib/review-purchases.ts), [`custom-review-submission.ts`](../lib/custom-review-submission.ts) |
| Buyer management | [`my-review-actions.ts`](../lib/my-review-actions.ts), [`my-reviews.tsx`](../components/my-reviews.tsx) |
| Fixed database operations | [`review-backend.ts`](../lib/review-backend.ts), [database boundary](REVIEWS_DATABASE.md) |
| Public projection / paging | [`public-review-view.ts`](../lib/public-review-view.ts), [`page/route.ts`](../app/api/reviews/page/route.ts) |
| Private media | [`review-photo-actions.ts`](../lib/review-photo-actions.ts), [`review-photo-reader.ts`](../lib/review-photo-reader.ts), [`review-photo-reads.ts`](../lib/review-photo-reads.ts), [media guide](REVIEWS_MEDIA.md) |
| Operations / removal | [diagnostics](REVIEWS_OPERATIONS.md), [Judge.me removal record](REVIEWS_JUDGEME_REMOVAL.md) |
