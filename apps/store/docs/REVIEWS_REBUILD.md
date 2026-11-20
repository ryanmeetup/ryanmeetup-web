# Ryan Meetup reviews rebuild

Updated **November 20, 2026**, against committed source through `cabd6ac9`.
Claude's recent-purchase suggestions, variant/order context and collapsible
Ready to review / Your reviews sections are included. The independent photo
follow-up is committed in `e372320c`, with CI coverage in `8d84eec8`; rollout
and validation evidence are below.
Earlier checkpoints are historical. Implementation, rollout and live lifecycle
evidence remain separate milestones.

## Where we are

The core **text-review system is implemented**: Shopify buyer sign-in and
session code, exact purchased-line checks, submission, buyer editing and
withdrawal, owner moderation, official reply management, and public reads with
complete rating totals. All ten Store extension migrations are applied to
RMT, including verified/unverified reviews, private photo staging, pending
revision associations and an upload budget. Signed-in accounts without a
reviewable matching order can submit an unverified product review; both paths still wait for approval.

It is **not yet a launch-verified Judge.me replacement**. Real Shopify buyer
authentication, client permissions, token renewal, purchase semantics, and the
complete buyer-to-moderator lifecycle still need proof in an isolated HTTPS
environment. Public pagination, reply rendering and grouped-product rating
consistency are implemented and tested in the independent follow-ups below.
Server photo processing/staging, a bounded same-origin upload/discard API and
atomic pending-revision associations are implemented. Collection is off by
default behind `STORE_REVIEW_PHOTOS_ENABLED`; buyer UI, private previews and
media moderation/publication remain unbuilt.

**Production switched to custom reviews on November 20**, according to
Claude's committed [production/removal record](REVIEWS_JUDGEME_REMOVAL.md).
Judge.me remains the blank-setting code default and an available recovery
provider; it is no longer the latest documented production selection.
Shopify sign-in requires explicit configuration and now works independently of
the review provider; custom collection additionally requires custom mode.
This audit did not independently inspect deployed environment variables or
perform a real buyer login. The recorded provider switch does not prove the
complete live lifecycle or mean the photo workflow is available. This work
applied private schema migrations to RMT and verified their metadata; it
changed no provider setting, credential, photo feature flag or buyer content.

Since the first audit, committed changes require a title on every review,
connect the store server to RMT directly, remove the Tasks storefront relay
routes, restrict the browser review switch to localhost, and remove the
sample/test buyer. Local browser tests now use a synthetic Shopify session
and a fake Supabase transport. The HTTPS sign-in tunnel's hostname is allowed
for Next development assets; that is configuration support, not proof of a
successful live sign-in.

**Existing Judge.me reviews stay in Judge.me and will not be imported**
(November 20 decision, recorded in `62e348eb`). They no longer appear in the
custom storefront or its rating totals; export a copy before any eventual
uninstall. There is no active import or import dry-run milestone. Review request emails,
shop-wide discovery, and a native Shopify order-page shortcut remain Phase 2.
The earlier 4–6 week figure was an initial estimate, not a current estimate of
remaining effort; reassess after the live Shopify gate.

## What exists today

| Area | Implemented today | Limit or remaining work |
| --- | --- | --- |
| Provider selection | Server-owned `REVIEWS_PROVIDER`; blank defaults to `judgeme`. Browser selector supports Judge.me, custom, and reset. It works only on loopback hosts in local development or explicitly enabled local builds; all Vercel deployments, including Preview, refuse overrides. | Hosted Preview uses deployment configuration. |
| Shopify sign-in | Start/callback routes; public discovery; PKCE, state, nonce and browser binding; confidential-client token exchange and signed ID-token validation. Sign-in can start from any page in either review mode; localhost has a separate return hop. | Intended client configuration, permissions, and real buyer login remain unproven by this audit. |
| Sessions | Opaque Secure/HttpOnly cookies, encrypted server persistence, seven-day absolute storefront session, access-token renewal, revision checks, and sign-out. | Live refresh rotation/reuse and recovery need evidence. No distributed refresh claim or expired-record cleanup job. |
| Purchase checks | Product-level order discovery, owned-order/line verification, product and variant snapshots, current encrypted-session checks, and Shopify-derived buyer names. Used by both picker and submit; a successful lookup with no eligible line opens the unverified path. | Conservative verification policy and bounded history; see below. A failed lookup stays unavailable. Live order semantics/permissions remain unproven. |
| Buyer composer | Whole stars 1–5, required title up to 100 characters, required text up to 5,000, purchase picker, full name/first name and last initial/anonymous, exact public-name preview. | Text-only UI. The separately gated private photo API has no picker/preview integration yet. |
| Submission | Same-origin `POST /api/reviews` custom branch; authenticates the account, rechecks purchases and chooses the verified line or unverified product path server-side. An account with an eligible line must use it; no-order title/name snapshots are server-owned. Both create a pending revision. The anonymous Judge.me relay is retired: Judge.me-mode POSTs return uncached `410` without reading the body or calling a provider, including localhost overrides. | Collection remains configuration-gated; the recorded custom-provider switch does not prove the live write lifecycle or sign-in settings. Judge.me reads/hosted account links remain available if that provider is selected; external collection/email entry points still need coordination. |
| Buyer management | Private `/reviews/mine` and `GET/POST /api/reviews/mine`; twenty-row pagination, all review states, edit/withdraw, account-switch and stale-write handling. Reviewed lines link here; withdrawn lines may be resubmitted. Recent verified purchase suggestions show product/variant choices and order context, linking to the product review composer. Ready to review and Your reviews are collapsible sections. | Real Shopify-backed lifecycle still needs rehearsal. This is a storefront page, not a Shopify account extension. |
| Persistence | Review, revision, reply and audit tables; verified-line and unverified-account/product uniqueness; transactional writes; separate pending/approved text and exact versions. Private photo drafts and a dedicated bucket are applied to RMT. | Atomic pending-revision photo association and a private upload budget are implemented in the tenth migration. Media publication, cleanup and retention/export/removal workflows remain. |
| Staff moderation | Tasks **Admin → Store reviews**, `/admin/reviews`; filters, paging, approve/reject/hide/restore, reasons, version conflicts and recent history. The v3 queue labels unverified reviews “No matching order.” | Existing Tasks app owners only. No separate moderator role or full-history browser endpoint. |
| Official replies | Owner create/edit/remove, atomic audit/version updates and approved-review public projection. The storefront now carries the public body/date through its adapter and renders “Reply from Ryan Meetup” beneath the review, with plain text, preserved line breaks and a UTC publication date. Removed replies disappear on the next public read. | Local adapter/browser/build checks passed; the real owner-to-public lifecycle still needs rehearsal. No staff identity, private version or moderation note is exposed. |
| Public reads | Approved active revisions only; complete count, average and star distribution. Custom pages show 20 reviews initially and expose “Load more reviews” through an anonymous, bounded, product-scoped GET endpoint. Loading/retry states, duplicate suppression and stale-response cancellation are covered locally. | Complete rating totals remain the initial server snapshot until refresh; they are not recomputed from loaded rows. Distribution, item attribution and edit timestamp are not displayed. Legacy Judge.me remains on its existing first-page path. |
| Public verification labels | Custom reviews with the canonical `verifiedPurchase` flag show **Verified purchase**; qualifying Judge.me statuses retain **Verified review**. Published unverified reviews remain visible without either badge. The app view carries the badge meaning per review, including later pages. | Display/projection work only; purchase eligibility, accepted Judge.me statuses, account identity and submission rules are unchanged. No live-provider proof is implied. |
| Product integration | Per-product reads, selected-design review switching, cards, rating summary, published-photo gallery and product JSON-LD. The independent scope fix keeps JSON-LD ratings, imagery and offers on the selected design, including initial HTML, style changes and browser history. | Empty/unavailable selected-design reviews omit aggregateRating. The scope fix is tested locally; it does not establish deployment or live-provider verification. |
| Photos | Bounded normalization, private staging, same-origin authenticated upload/discard, shared attempt budget and atomic ordered pending-revision associations. Text-only edits retain the selection; explicit arrays replace/remove it. Text approval leaves media pending. | `STORE_REVIEW_PHOTOS_ENABLED` defaults off; custom public SQL still returns `photos: []`. Buyer UI, private previews, staff media decisions/publication and cleanup remain. No live buyer upload is claimed. See [media checkpoint](REVIEWS_MEDIA.md). |
| Support revocation | Service-role-only function to revoke every review session for one buyer, scoped to shop/client/issuer/subject. Applied to RMT. | Database operation only; no route or staff UI. Sign-out ends the review session and leaves the separate Shopify account session signed in. |
| Store storage diagnostics | One structured server event per failed custom review backend operation, with a fixed operation/category and allowlisted code. Contract violations and unexpected exceptions are distinguished; ordinary domain outcomes stay quiet. No payloads or raw errors are logged by this event. | Local code/tests only. No hosted alert, retention or live monitoring setup; disabled configuration, Shopify auth/purchases, Judge.me and Tasks moderation are outside this event. See [operations](REVIEWS_OPERATIONS.md). |
| Account context | Header account menu, private `/api/account` status, email, orders/profile links, sign-out and My reviews. Claude added sign-in guidance and `/api/reviews/auth/switch` for choosing another Shopify account; ordinary review sign-out remains separate. | Claude owns this account/auth work. Live account switching/logout evidence is separate from committed code. |
| Automated coverage | Store HTTP/domain tests, Tasks contracts/routes, SQL isolation/concurrency checks, buyer and moderation browser fixtures, responsive/theme coverage, CI jobs. | Synthetic provider/browser coverage does not prove a live Shopify installation. |

### Latest verified/unverified checkpoint

Claude committed the RMT extension in `40ed7bd6`, the moderation projection/UI
in `2743eb27`, and the storefront path/contracts in `e0536ff0`. The RMT remote
history now contains `20261120210000_store_unverified_reviews.sql`; this is no
longer a local draft. The follow-up account-line styling and duplicate-key test
fix are committed in `482d1b64`. Subsequent commits enable sign-in on any page
and provider (`a5ac550f`), add the header account menu (`0eb4bbf2`), finish the
localhost return hop (`1f02697f`), and tidy My reviews/spinner sizing
(`8851c013`, `8736e1f5`). Sign-in guidance/account switching are now committed
in `848b9f43`; production's custom-provider switch is recorded in `c09cb700`.
This audit still does not infer a completed provider-backed lifecycle from
those commits or the environment switch.

A real Shopify account with no reviewable
matching purchase can write one **unverified** review per buyer/product.
Verified reviews retain their exact purchased-line uniqueness. Both paths
still wait for staff approval; failed Shopify/storage checks remain unavailable
rather than silently becoming an unverified purchase result. The change
also adds private signed-in account email and sign-out controls, now in the
header, and distinguishes purchase verification in the owner queue.

This supersedes the earlier purchase-only collection policy. Applied SQL and
committed code do not prove deployed settings or a real buyer login. The live
verified/unverified lifecycle still needs redacted provider-backed evidence.
Independent public-read/release work preserves Claude's authentication and
account-menu edits, buyer fixture servers and database stacks. Reply display
adds a separate card element in the shared review wrapper; it does not change
his sign-in or account logic.

## Architecture and ownership

- **Shopify** owns buyer identity, products, orders and fulfillment. Store
  buyers are not created as Supabase Auth users or Tasks workspace members.
- **`apps/store`** owns Shopify authentication, encrypted token handling,
  purchase eligibility, browser-facing review APIs, buyer UI and public cards.
  It also owns direct database adapters for encrypted auth records and review
  content. Shopify purchase authorization is enforced before review storage;
  the database adapter does not independently query Shopify.
- **`apps/tasks`** hosts the owner moderation page and
  `GET/POST/PATCH /api/admin/reviews`, behind the Tasks owner authorization
  boundary. It no longer relays storefront reads or writes.
- **`packages/reviews`** owns shared input, result, public/private projection
  and cursor contracts. `packages/ui` supplies generic visual primitives.
- **RMT Supabase `lvfaartgcpphuokoswcm`** stores private auth and review data.
  The store server connects to it directly with `SUPABASE_URL` and
  `SUPABASE_SECRET_KEY` (`lib/store-database.ts`), using fixed table/column
  mappings and RPCs, and checks commands/results against the shared contracts.
  The key is server-only and has service-role access across RMT; fixed app
  operations do not narrow its database privileges. Public reads still pass
  the allowlisted public projection.
- **PRD `vjsnobmfsfrsnwukfaoq`** remains a separate personal Tasks instance.
  The store accepts only RMT's URL (or loopback outside production), so PRD
  can't be configured. Store migrations are
  RMT-only; PRD needs no review SQL, fake history entries or borrowed credentials.

All database history remains in `apps/tasks/supabase/migrations`, with scope in
`migration-scopes.json`. Do not create another migration history in the store.
The old `STORE_REVIEWS_BACKEND_URL`, `STORE_REVIEWS_BACKEND_TOKEN` and
`STORE_REVIEWS_SERVICE_TOKEN_SHA256` relay configuration is retired. Tasks
moderation still uses `getStoreCustomerAuthScope` and its existing
`STORE_REVIEWS_CUSTOMER_AUTH_ENABLED`, `STORE_REVIEWS_CUSTOMER_AUTH_SCOPE`
and project checks; the direct store connection does not configure those
owner tools automatically.

Test environments require isolated storage, an encryption keyring and a
registered HTTPS callback. Currently `getStoreDatabase` accepts RMT's exact
URL, or HTTP loopback outside production; a separate hosted Supabase project
or branch URL is rejected. Hosted Preview isolation is therefore still a
configuration/code gap, not a ready deployment option. A local store behind
an HTTPS tunnel with a local database fits the Store guard; Tasks moderation
still expects a pinned HTTPS project URL and needs its own isolated-target
support before a real combined buyer/owner rehearsal. Use the
environment provider for a tunnel host: the browser selector is loopback-only.
No provider switch isolates storage or makes Preview safe to write to RMT.

### Database rollout, verified in this audit

`supabase migration list --linked` on November 20 confirms all ten versions
below in RMT's remote history, with none pending. The latest photo migration
was committed in `e372320c`, tested on both isolated profiles, then applied
with `supabase db push` to the pinned RMT project. A post-rollout public-schema
diff is empty. Read-only API checks confirm the attachment column, revision
photo table and budget table are available to the Store server; the bucket
remains private, WebP-only and limited to 4 MiB. No buyer rows/files were
read/written for verification. PRD received no SQL or fake history entry.

| Migration version | File / capability | RMT |
| --- | --- | --- |
| `20261120130000` | `store_customer_auth_storage.sql`: encrypted authorization/session persistence and atomic operations | Applied |
| `20261120140000` | `store_reviews.sql`: review content, revisions, replies, audit and public projections | Applied |
| `20261120160000` | `store_review_moderation.sql`: owner-checked moderation and queue | Applied |
| `20261120170000` | `store_review_replies.sql`: owner reply writes and compatible v2 staff projection | Applied |
| `20261120180000` | `store_buyer_reviews.sql`: paginated buyer reads, reviewed-line lookup and version-checked writes | Applied |
| `20261120190000` | `store_customer_session_revoke_buyer.sql`: revoke all sessions for a buyer | Applied |
| `20261120200000` | `store_review_title_required.sql`: required stored revision titles | Applied |
| `20261120210000` | `store_unverified_reviews.sql`: account/product uniqueness, nullable order pair and public/staff verification projection | Applied |
| `20261120220000` | `store_review_photo_staging.sql`: private drafts/bucket, ownership, bounded allocation and idempotent transitions | Applied |
| `20261120230000` | `store_review_photo_attachments.sql`: shared upload budget, protected claims and atomic pending-revision media association | Applied |

Version `20261120210000` was absent at an earlier check and is now confirmed.
The ninth and tenth versions add staging and associations respectively; no
previously applied migration was edited.

The old `20261120150000` buyer-management draft was never applied or committed;
the final version is `20261120180000`. Applied SQL stays immutable.

## Current buyer and publication rules

1. The product page derives access from the server session and current Shopify
   purchases. It shows sign-in, already-reviewed, unavailable, or ready states.
   Ready contains matching unreviewed lines or an unverified product review.
   The former no-purchase/needs-help closed states are gone. Writing needs a real
   Shopify sign-in; there is no pretend buyer.
2. A new submission rechecks eligibility. The browser supplies a product hint,
   selected line (or null) and review fields; it cannot choose the buyer, purchase
   snapshot or arbitrary public name. Numeric Shopify IDs remain strings so
   large IDs retain precision.
3. The database enforces one review per purchased line and a separate limit
   of one unverified review per account/product. Multiple units on a purchased
   line share one review. Repeated submission reports that the record exists;
   a withdrawn review is resubmitted through the same record and waits for
   approval again. New publication after resubmission gets a fresh date.
4. Pending reviews are private. Buyer edits create a pending revision while
   the last approved version stays public. Rejecting an edit preserves that
   approved version. Hidden reviews can be withdrawn, but not edited by the
   buyer; staff approval alone does not restore a hidden review.
5. Withdrawal immediately removes the review from subsequent public database
   reads and totals. Staff cannot restore a buyer withdrawal. Hide/restore,
   approval, reply and buyer writes use transactional audit/version handling.
   Open storefront pages still need a reload to show the new data.
6. Buyer and owner management compare the exact database timestamp, including
   six fractional digits. Stale edits require a fresh decision. An uncertain
   response never causes a blind automatic retry. Private session, order,
   customer, draft and moderation data do not enter public review payloads.

### Exact purchase policy implemented today

Automatic eligibility currently requires an uncancelled, unedited paid order
and a physical, non-gift-card line whose **entire quantity** has successful
fulfillment and no refunded units. `SUCCESS` is treated as fulfillment; it
does not prove delivery. A refund on another line can leave this line eligible.
Fulfillment must identify this exact line; shipping another item is insufficient.

These rules now govern the **verified badge**, not whether a signed-in account
can leave feedback at all. Refunded/edited/unverifiable lines are skipped with
reason codes; if the completed lookup yields no eligible line, the account can
write an unverified product review. Unpaid/unfulfilled lines may qualify later.
Provider, storage and inconsistent-snapshot failures stay unavailable and never
become a successful empty purchase list or silently enable the unverified path.

A refund after receipt no longer prevents signed-in feedback, but that review
does not get purchase verification through the skipped line. The query still
cannot establish refund vs. receipt chronology and has no staff eligibility
override. Live evidence is still needed to validate those semantics.

Limits are deliberate: order discovery reads at most ten pages of ten orders;
an incomplete discovery remains unavailable. The whole product lookup has a
30-query budget and keeps already fully verified recent lines if later
candidate verification exhausts it. With none, it returns `none/needs_help`,
which the composer now handles through the unverified product-review path.
Owned-order verification paginates lines/fulfillments within ten requests,
but each fulfillment's child lines stop at 50 and fail closed if more exist.
Extend these bounds if live orders require it. See
[the purchase checker](REVIEWS_PURCHASE_ELIGIBILITY.md) for the exact contracts.

## What remains, in working order

### 1. Configure and prove the live Shopify integration

This is the next gate, not another rewrite of the existing auth or purchase code.

- Provision/confirm the intended confidential Customer Account client and
  permissions for buyer names and order access, including protected customer
  data. Register the exact HTTPS callback and storefront origin for the test
  environment. Existing Admin/Judge.me credentials cannot replace this client.
- Configure the store's client secret, encryption keyring, `SUPABASE_URL` and
  `SUPABASE_SECRET_KEY`. `STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED` is an
  explicit opt-in for sign-in in either provider mode. Custom collection and
  My reviews additionally require custom mode. See
  [auth setup](REVIEWS_SHOPIFY_AUTH.md) for exact setting names.
- Resolve the isolated test target before enabling writes: a local database
  with an HTTPS storefront tunnel fits the current database URL guard;
  hosted Preview isolation needs a deliberate supported configuration.
  Do not substitute production RMT for an isolated target. Configure the
  Tasks owner's moderation scope independently.
- Prove real sign-in, return to the intended product, encrypted persistence,
  access renewal, logout and account switching. Test refresh-token rotation,
  reuse and uncertain responses across workers; current coalescing is only
  within one process. Add a durable refresh claim if the provider requires it.
- Record redacted exact-line/product/variant and ownership evidence for normal
  orders, split fulfillment, unpaid/cancelled/edited orders, refunds before
  fulfillment and after receipt, deleted products and other-account attempts.
  Verify refunded/edited purchases use the intended unverified fallback and
  retain accurate purchase-verification labels.
- Establish which Printful delivery events actually reach Shopify. Delivery
  and the later review-request schedule remain unproven.

Public discovery and offline schema validation already passed in earlier
checkpoints. Neither establishes the intended client's real buyer permissions.

### 2. Verify the completed public storefront wiring on the release target

The grouped-product rating-scope fix is implemented separately: one
`ProductSchema` renderer and `buildProductSchema` builder serve both ordinary
and grouped products. A group renders the selected design's complete summary,
images and offers alongside that design's visible reviews; style changes and
back/forward navigation update the same script. Empty/unavailable data omits
the rating rather than using another design's totals. See validation below.

Public replies are now wired through `lib/public-review-view.ts`, `lib/types.ts`
and the app-owned `ReviewReply` component. They show the existing public body
and first publication date. Text stays plain, line breaks remain visible and
long strings wrap. Updating/removing a reply is reflected after refresh;
there is no live subscription or separate custom cache.

Custom pagination is now wired through `GET /api/reviews/page` and
`usePublicReviews`. The server fixes shop scope and a twenty-row limit, accepts
only a numeric product ID and validated cursor, validates the public result,
and returns uncached data without buyer credentials or identity. The client
appends unique cards, keeps the existing list/cursor on failure for explicit
retry, and aborts/discards continuations on a new product/provider/server
snapshot. Complete totals and JSON-LD remain on the initial complete summary
until refresh. Buyer and staff pagination remain independent.

The public adapters now preserve verification meaning per review: a true
custom `verifiedPurchase` becomes **Verified purchase**, an accepted Judge.me
verification status stays **Verified review**, and unverified reviews get no
badge. The card does not infer verification from the current provider mode.
This works for initial and appended pages without changing either provider's
verification rules. Confirm these labels in the live release rehearsal.

- Keep complete totals separate from the displayed page. The backend already
  returns star distribution and attribution; distribution/filter UI belongs
  to Phase 2. There is no custom review cache/invalidation layer today:
  requests are uncached. If caching is introduced, invalidate on publication,
  edits/withdrawal, hide/restore and reply changes.

### 3. Rehearse the complete text-review lifecycle

In the isolated environment, use a real buyer plus the authorized Tasks owner:
sign in → choose exact purchase → submit → approve → display publicly → reply
→ edit → keep approved text public → reapprove → withdraw. Check public totals,
product scope and JSON-LD at every relevant transition. Also exercise rejection,
hide/restore, duplicate/concurrent submission, stale editors, lost responses,
another account's IDs, account switching and backend failure.

Existing browser suites use synthetic encrypted sessions and transport fixtures.
They are useful regression coverage, but the real Shopify-backed lifecycle
has not been recorded as passing.

### 4. Build the custom media pipeline

The intended Phase 1 experience still includes up to five optional photos.
Photos can follow the working text flow, but omitting them from launch would
be an explicit scope decision, not a completed feature.

The isolated [server photo processor](REVIEWS_MEDIA.md) is implemented and
tested. It accepts still JPEG/PNG/WebP bytes up to 10 MiB/40 million pixels,
checks actual content and animation, corrects EXIF orientation, strips metadata
and returns an aspect-preserving WebP up to 2048px per edge and 4 MiB. These are
implementation caps; photo collection remains disabled by default.
The Store declares Sharp `0.35.5` directly. The HTTP route accepts at most
4 MiB raw bytes to fit the hosting limit; the processor cap remains 10 MiB.

Private staging is also implemented and applied to RMT. It binds slots to the
configured shop and authenticated-server subject/product, serializes the
five-active-slot quota, expires slots after one hour and recovers identical
retries using content digests. Files stay in a private WebP-only bucket;
uncertain finalization never triggers a destructive delete. The authenticated HTTP handler now establishes the buyer/product and repeats
the session check before staging/returning. Its body read is bounded even with
false/missing Content-Length. Two decoder pipelines per process and thirty
attempts per buyer/shop per ten minutes bound collection. All responses are
private and expose no storage path, digest, subject or signed URL.

Atomic submit/edit wrappers validate up to five unique IDs under locks, require
owned/product-matching ready/unexpired stored objects or media retained by the
same review, and claim drafts once. Bad photos roll back text, revisions,
versions and audit together. Approved selections stay unchanged while edits
wait; media decisions start pending independently of text approval.

- Buyer attachment selection, preview, removal and edit behavior.
- Private buyer preview access and selected-photo references in buyer reads.
- Staff media review and approved-only publication. Pending edit photos must
  not leak or silently replace the approved set.
- Cleanup of failed/abandoned uploads and removed/withdrawn media, plus an
  appropriate custom image-host allowlist and `next/image` configuration.
- Tested restore of image objects separately from database records.

The existing gallery and new private API do not yet provide a complete
custom collection/publication flow. Expiry makes drafts unavailable but does
not delete objects; an expiry sweep and object restore proof remain open.

### 5. Complete operations and release preparation

- Add bounded cleanup for expired auth attempts/session records and tombstones,
  preserving replay/race protections. Revocation clears token ciphertext;
  the all-sessions revocation function is not an expiry cleanup job.
- Add review-specific abuse/rate controls for sign-in, buyer writes and future
  uploads. Existing origin, validation, ownership and uniqueness checks do not
  by themselves provide throttling.
- Define and implement customer export/removal and retention procedures for
  reviews, purchase references, revisions, audit records and future media.
  Buyer withdrawal is not deletion or a complete data-removal workflow.
- Connect and verify live monitoring using the implemented Store storage
  failure event and [operations guide](REVIEWS_OPERATIONS.md). Configure alert
  ownership/thresholds and cover availability, latency, disabled configuration,
  Shopify/auth and Tasks moderation; the failure event alone does not prove
  health or supply a request denominator.
- Verify backend capacity, key rotation, backups and restore,
  Preview isolation, and support procedures. Decide whether support needs a
  staff UI for buyer-wide session revocation; the database function exists.
- Decide whether review logout should also sign out of Shopify. It currently
  leaves the separate Shopify session intact; global logout would also affect
  checkout and needs the registered provider logout flow.
- Rehearse the prepared [cutover/rollback runbook](REVIEWS_RELEASE.md) and
  verify the deployed configuration. Its collection pause is tested locally;
  provider switching, drain/restore and live buyer/staff checks remain open.
  Keep Judge.me installed and serving its current path until release checks pass.

## Phase 2 and deferred scope

- **Shop-wide discovery:** review history with purchased-product attribution,
  sorting/filtering, star distribution, and a shop-wide average clearly labeled
  as product reviews across the store. Backend per-scope summaries are a
  foundation; a shop-wide page and discovery controls are not built.
- **Review requests:** verified fulfillment/delivery events, durable queue,
  per-order/line deduplication, reconciliation of missing/out-of-order events,
  eligibility recheck, already-reviewed suppression, opt-outs, mail provider,
  templates, safe retries and the documented fulfillment-delay fallback.
  The current Shopify webhook handles catalog invalidation, not review requests.
- **Shopify account integration:** native order-page shortcut into the custom
  storefront flow. Existing Judge.me account buttons are not this extension.
- **Optional fit feedback** for apparel remains unimplemented.
- **Judge.me content imports:** inactive unless Ryan requests them again.
  Do not make an import/export dry run a launch dependency or import private
  customer data into Git. Reopening this scope requires provenance, mapping,
  deduplication, dates/publication state, media/reply handling and verification
  rules; legacy verification must not automatically become verified purchase.
- Video, incentives, public reviewer profiles and custom Shop app syndication
  remain outside scope. Check the existing Judge.me/Shop dependency before
  changing or uninstalling that integration.

## Cutover and rollback, still to rehearse

Production is already recorded on custom mode; the verification/recovery steps
below remain outstanding unless their evidence is recorded. Do not treat the
provider switch itself as completion of these checks.

The detailed [release runbook](REVIEWS_RELEASE.md) now records release evidence,
actual Store/Tasks pause controls, private snapshot requirements, read-only
cutoff queries and recovery paths. The locally tested holding state keeps
custom public reads available with collection paused. The anonymous Judge.me
POST relay is now retired in source, including after a provider switch.
Returning to Judge.me still requires the live recovery rehearsal, preserving
custom reviews and coordinating hosted collection links/request emails.
No production setting, provider or review data was changed here.

1. Pass the live buyer gate, public wiring checks, full lifecycle and agreed
   media scope; complete operational preparation. Record the exact deployed
   versions, environment/project identities and release owner.
2. Preserve the agreed historical-review handling: Judge.me reviews remain
   there without import or custom-storefront display. Export a copy before
   uninstalling Judge.me. Custom reads do not merge/fall back to that history.
3. In the planned window, coordinate Judge.me collection and its queued request
   emails, remove/redirect old entry points, and verify that the deployed
   source refuses legacy anonymous POSTs with `410`. Only then open the custom
   collection path and set the production provider to `custom`. New request
   emails are a later feature.
4. Keep Judge.me installed during the rollback window. Verify production buyer,
   owner and public behavior plus complete totals. Rehearse a return to
   Judge.me with custom writes stopped first and new custom reviews preserved;
   record how those reviews and duplicate-line ownership will be reconciled.
5. Remove Judge.me and its secrets only after rollback sign-off and checking
   account extensions, queued emails and any Shop sync dependency.

Do not install/uninstall Judge.me, change its emails, repoint credentials, or
switch the production provider merely to test this plan.

## Evidence and repeat validation

**Gated photo collection and atomic attachments, November 20:**

- Added a private same-origin raw-image upload/discard API, streamed 4 MiB cap,
  session rechecks, two-pipeline process bound and shared thirty-attempt budget.
  The feature flag remains off by default and was not enabled in production.
- Added RMT-only migration `20261120230000` for protected attached drafts,
  ordered pending-revision links and rollback-safe submit/edit wrappers.
  No auth/eligibility implementation, public photo projection or buyer UI changed.
- The focused Store run passed 60 tests; the broader auth/review/public
  regression run passed 205. Its two real-storage tests are skipped without a
  container and both passed separately inside the RMT runner. All 20 existing
  public browser scenarios passed. Store production build, Tasks typecheck,
  changed-file ESLint, workflow parsing and `git diff --check` passed.
- From empty, RMT passed 383 database assertions (53 new association/budget
  assertions), two real encrypted-storage checks and five concurrency checks.
  Competing claims have one winner with no rejected review left behind;
  concurrent attempts cannot exceed thirty. PRD passed 65 assertions and
  confirms Store tables/functions/bucket are absent. All 16 planner tests passed.
- Before rollout, remote history showed only `20261120230000` pending. The
  generated public-schema diff contained only the intended photo additions and
  function changes; it was reviewed, not applied as generated SQL. After the
  committed migration was applied to RMT, all ten Store versions matched and
  the public-schema diff was empty. Metadata-only checks confirmed the new
  tables/column and unchanged private WebP-only bucket. No buyer rows or photos
  were read/written; no PRD migration or synthetic history was added.
- All 23 relevant Tasks review contract/client/route tests passed. Hosted CI
  execution and the live Shopify/media lifecycle are not claimed.

**Private photo staging and rollout, November 20:**

- Processing/staging code and RMT-only migration `20261120220000` are committed
  in `3d671ed4`. The migration was applied only to RMT after both isolated
  profiles passed. Remote history confirms all nine Store versions, the
  post-rollout public-schema diff is empty, and read-only bucket/table checks
  confirm private WebP-only storage capped at 4 MiB.
- RMT passed 330 database assertions, including 46 staging/access assertions,
  two real encrypted-storage checks and three lock/race scenarios. Concurrent
  allocation cannot exceed the fifth active slot. PRD passed 65 assertions
  and confirms the table/bucket are absent. All 16 planner/catch-up tests passed.
- All 20 processor/staging tests passed, including lost upload/finalization/
  discard responses, digest mismatches, cross-owner/product access, quota and
  closed outcomes, failed removal and malformed result rejection. Store build,
  Tasks typecheck, changed-file ESLint and `git diff --check` passed.
- CI now has a pinned-CLI matrix for both isolated profiles, including relevant
  Tasks migration/script/test PR paths. Workflow YAML is validated locally;
  hosted execution is not claimed here. The runner's storage integration tests
  are server-free and never reset the existing application stack.
- At that checkpoint, browser uploads and revision association were unbuilt;
  the later gated collection follow-up above implements them. Buyer UI, media
  moderation/publication and expiry cleanup remain unbuilt. No real buyer photo
  or review was created.

**Server photo-processing follow-up, November 20:**

- Implemented server byte validation and re-encoding without adding an upload
  route, bucket, table or public URL. The processor returns only a normalized
  WebP/dimensions or a fixed failure reason; original bytes and decoder errors
  are not returned. Photo count, buyer ownership and moderation still belong
  to the unbuilt workflow, not this function.
- All ten processor scenarios and the combined 39-test photo/public-view run
  passed. Fixtures exercise actual codecs, private EXIF GPS/XMP/ICC data,
  orientation at the pixel level, transparency, malicious size/type/header
  inputs, animations and caller-buffer mutation.
- Changed-file ESLint, local documentation links, `git diff --check` and the
  isolated custom-mode Store production build passed. The manifest/lockfile
  now declare the already-resolved Sharp version directly; no package version
  upgrade, schema change or changes to Claude's account/purchase code occurred.
- CI has a dedicated processor check. Upload/storage authorization, revision
  association, buyer UI, approved-only media access, cleanup and object restore
  remain open; photo collection is not marked complete.

**Store storage diagnostics follow-up, November 20:**

- Failed validated backend operations now emit `store_review_operation_failed`
  with only operation, failure category and an allowlisted code. Storage errors,
  invalid public/private responses and unexpected exceptions are distinguished.
  Two failed public-read RPCs produce one event; successful/normal domain
  answers and rejected commands do not produce failure events.
- 57 focused tests passed across diagnostics, backend contracts, public paging,
  buyer submission/management and purchase lookups. Nine diagnostics scenarios
  cover private content and malformed-code exclusion, unchanged public errors,
  unexpected/transport failures, normal outcomes and a broken logging sink.
- Changed-file ESLint and `git diff --check` passed. No schema change, live
  provider call, alert activation or alteration of Claude's authentication and
  purchase code is part of this follow-up. The operations guide records the
  remaining coverage and release evidence; monitoring is not marked complete.
- The isolated custom-mode Store production build passed with live catalog,
  Judge.me and database connections disabled. Local documentation links passed
  validation. No browser/layout changes were made in this follow-up.

**Public verification-label follow-up, November 20:**

- Replaced the app-local ambiguous verified boolean with `purchase`, `review`
  or `null` in the public view. The shared/domain `verifiedPurchase` contract,
  Judge.me status allowlist and Claude's buyer/purchase/submission code remain
  unchanged. An unrelated legacy-style field cannot give an unverified custom
  review a purchase badge.
- 29 focused tests passed across custom/legacy projections, actual card
  rendering, backend contracts, public pagination, replies and structured
  data. Coverage confirms the two badge meanings can coexist without being
  upgraded, and unverified text remains visible with no badge.
- All 20 isolated public-read browser scenarios passed. They cover a mixed
  verified/unverified custom product, the purchase badge on later pages,
  reply rendering, rating scope, pause behavior, retries and stale responses.
  The badge/reply cards were visually inspected in both themes at
  390/1024/1280/1536px. The existing demo catalog image still emits a 404;
  the review checks pass independently.
- Changed-file ESLint, local documentation links, `git diff --check` and the
  isolated custom-mode Store production build passed. No schema or production
  configuration change is required. Claude's concurrent browser-test artifact
  work is separate and was left untouched.

**Anonymous Judge.me relay retirement, November 20:**

- Removed the external create-review request from `POST /api/reviews`.
  Default/blank/explicit Judge.me modes and a local Judge.me override return
  uncached `410` before reading buyer-supplied content. Browser provider fields,
  credentials, malformed input and missing configuration cannot restore it.
  Invalid provider configuration remains unavailable; the custom branch is
  unchanged.
- 55 focused tests passed across route retirement, provider selection,
  localhost overrides, Judge.me public projections/domain credentials,
  hosted collection links and custom submissions/purchase lookups. The real
  custom route still saves only verified server-derived purchase references;
  the signed-in unverified path retains its existing domain coverage.
- Changed-file ESLint and `git diff --check` passed. These tests use synthetic
  transports and do not prove deployed retirement or change Judge.me's own
  hosted forms, settings or queued emails. CI now includes the route retirement
  and provider/override regression suites.
- The isolated custom-mode Store production build passed with live catalog,
  Judge.me and database connections disabled. This follow-up does not require
  a database migration or changes to Claude's authentication/purchase code.

**Public pagination follow-up, November 20:**

- 18 focused tests passed across public-page boundaries, reply mapping and the
  existing custom backend. Coverage includes malformed/duplicate queries,
  fixed scope/limits, public-only payload validation, cursor progress,
  overlapping rows and complete totals.
- The combined public-read browser suite passed all 19 scenarios. Its five
  new pagination scenarios cover 20 → 40 → 45 unique reviews with
  correct totals/JSON-LD and an oldest-page reply; failed-page retry with the
  same cursor; accessible disabled loading feedback; and discarded responses
  after product/provider changes, including browser back navigation.
- The pagination control was visually inspected in light/dark at
  390/1024/1280/1536px, plus its disabled mobile loading state. The responsive
  scenario passed again using the actual theme control. Changed-file ESLint,
  local documentation links and `git diff --check` passed. Browser runs
  emitted an existing demo catalog image 404; review assertions passed.
- The isolated custom-mode Store production build passed with live catalog,
  Judge.me and database connections disabled, including the new API route.
  No migration, credential, production provider or review data was changed.
- These are synthetic checks, separate from Claude's real Shopify setup and
  the outstanding owner-to-buyer lifecycle rehearsal.

**Public official replies follow-up, November 18:**

- 14 reply-adapter, custom-backend and existing Judge.me data tests passed.
  Reply mapping keeps only public body/date fields and leaves complete rating
  totals unchanged. Null replies leave no placeholder in the view.
- The combined public-read browser suite passed 14 scenarios, including nine
  new reply scenarios. The reply subset passed again after isolating test
  output from parallel Playwright runs. Checks cover literal HTML without
  execution, UTC dates in a New York browser, updates/removal after refresh,
  and long content in both themes at 390/1024/1280/1536px. All eight reply
  screenshots were visually inspected.
- Changed-file ESLint, `git diff --check` and the isolated custom-mode Store
  production build passed. No migration or production data change is needed.
- Browser artifacts now live in `test-results-public-reviews/browser`; the
  focused CI unit artifacts use its sibling `unit` directory. They are
  ignored locally and included in the CI failure artifact upload.

**Independent public-read follow-ups, November 18:**

- 18 focused tests passed: the four new schema checks plus fourteen existing
  product-group checks. Complete totals remain independent of the visible
  page; unavailable/empty reviews omit a rating; script serialization preserves
  content without allowing HTML to escape its JSON-LD script.
- The isolated scope/pause browser run passed all five scenarios: initial server
  HTML, style changes, back/forward, unavailable/empty selected designs,
  ordinary products, and pausing collection while retaining public reads.
  The pause uses valid synthetic auth configuration, blocks buyer operations
  before private storage and leaves published totals readable.
  The fixture supports public reads only and has independent ports 3142/54369
  and output `.next-e2e/product-reviews`, separate from Claude's buyer tests.
- Changed-file ESLint and `git diff --check` passed. Both focused checks and
  the browser suite are included in the Store review CI workflow.
- The isolated Store production build passed after Claude committed the
  duplicate-key test fix. It used custom mode with live Shopify/Judge.me and
  database connections blanked. This verifies compilation, type checking and
  demo rendering, not production credentials or a live buyer flow.
- Rechecked the committed verified/unverified boundaries: 25 Store
  submission/backend/buyer-management tests and 27 Tasks moderation/content
  contract tests passed. These are synthetic checks; SQL-profile resets and
  a normal Tasks production build were not rerun in this follow-up.
- A fresh read of RMT remote history confirms all eight review migrations,
  including `20261120210000`, are applied. No SQL was written by this task.
- [The release runbook](REVIEWS_RELEASE.md) is prepared. Only the local pause
  scenario is newly verified; live deployment switching, staff pause, active
  session logout, in-flight drain and recovery/restore have not been rehearsed.

**Earlier documentation-only follow-up, November 18:**

- At the earlier documentation-only check, the first seven versions were
  applied and `20261120210000` was still a local draft. The latest eight-row
  migration table above supersedes that rollout state.
- The committed direct database adapters, removed relay routes, required-title
  migration/contracts, localhost switch and removed test buyer match this
  inventory. The latest verified/unverified checkpoint supersedes the formerly
  unfinished submission/migration status.
- Local documentation links and `git diff --check` are checked for this edit.
- That documentation-only follow-up ran no app builds, browser servers,
  database resets, migrations or runtime tests.

**First audit results, before the later refactors:** storefront auth, purchase,
submission, buyer-management, provider and storage checks had **155 passed,
2 skipped** across 21 spec files; Tasks checks had **51 passed across 7 files**.
The two skipped encrypted-storage integration tests require the isolated
database runner. Those results predate required titles, direct RMT access,
removal of the relay routes/test buyer and the verified/unverified extension;
they do not validate the current working tree. Some of those Tasks route tests
were deleted with the relay they tested.

Earlier [buyer](REVIEWS_BUYER_MANAGEMENT.md) and
[moderation](REVIEWS_MODERATION.md) checkpoints record isolated RMT/PRD SQL
replays, concurrency checks, nine buyer and seventeen moderation browser
scenarios, production builds, and light/dark inspection at
390/1024/1280/1536px. Those are historical results, not fresh runs in this
audit. No live buyer/provider proof has been added here.

Useful repeat commands:

```sh
# From apps/store: independent product-rating checks and public-read browser suite.
STORE_BASE_URL=http://127.0.0.1:39999 npx playwright test tests/product-schema.spec.ts tests/product-groups.spec.ts tests/custom-review-replies.spec.ts tests/public-review-page.spec.ts tests/review-verification.spec.ts tests/reviews-data.spec.ts --workers=1 --output=test-results-public-reviews/unit
npx playwright test --config=playwright.product-reviews.config.ts

# From apps/store: server-free domain/HTTP checks using synthetic transports.
STORE_BASE_URL=http://127.0.0.1:39999 npx playwright test tests/customer-*.spec.ts tests/review-purchase-lookups.spec.ts tests/review-backend.spec.ts tests/custom-review-submission.spec.ts tests/my-review-actions.spec.ts tests/review-provider.spec.ts tests/review-collection.spec.ts tests/review-preview-api.spec.ts --workers=1

# From apps/store: isolated synthetic buyer browser suites (composer and My reviews).
npm run test:e2e:my-reviews

# From apps/tasks: contracts and HTTP boundaries.
npx vitest run tests/routes/store-review-moderation.test.ts tests/unit/customer-auth-contract.test.ts tests/unit/review-content-contract.test.ts tests/unit/review-moderation-client.test.ts tests/unit/review-moderation-screen.test.ts

# From apps/tasks: isolated owner browser suite.
npm run test:e2e:reviews

# From apps/tasks, one profile at a time; requires Docker and Supabase CLI.
node scripts/test-store-customer-auth.mjs
node scripts/test-store-customer-auth.mjs --target prd
node --test scripts/migration-plan.test.mjs scripts/build-catchup-sql.test.mjs
```

The placeholder `STORE_BASE_URL` suppresses automatic server startup for these
server-free tests; it is not a deployed test target. Browser tests require
their own fixture servers. Never point review-submitting tests at production
or reset the existing local Tasks stack as an isolation shortcut.

For code changes, also run changed-file ESLint, relevant type checks/builds,
`git diff --check`, and responsive/theme inspection for affected UI. Do not
disable the normal Tasks database-contract preflight to make a build pass.

## Source map and supporting checkpoints

| Concern | Source / checkpoint |
| --- | --- |
| Provider and browser isolation | [`lib/review-provider.ts`](../lib/review-provider.ts), [`lib/review-preview.ts`](../lib/review-preview.ts) |
| Shopify identity/session | [`lib/customer-account/`](../lib/customer-account), [auth setup](REVIEWS_SHOPIFY_AUTH.md), [`lib/store-database.ts`](../lib/store-database.ts) |
| Purchases and composer access | [`lib/review-purchases.ts`](../lib/review-purchases.ts), [`lib/customer-account/review-lookups.ts`](../lib/customer-account/review-lookups.ts), [`lib/custom-review-access.ts`](../lib/custom-review-access.ts), [purchase checkpoint](REVIEWS_PURCHASE_ELIGIBILITY.md) |
| Buyer submission | [`lib/custom-review-submission.ts`](../lib/custom-review-submission.ts), [`components/custom-review-composer.tsx`](../components/custom-review-composer.tsx), [`app/api/reviews/route.ts`](../app/api/reviews/route.ts) |
| Buyer management | [`lib/my-review-actions.ts`](../lib/my-review-actions.ts), [`components/my-reviews.tsx`](../components/my-reviews.tsx), [buyer checkpoint](REVIEWS_BUYER_MANAGEMENT.md) |
| Account menu | [`components/account-menu.tsx`](../components/account-menu.tsx), [`app/api/account/route.ts`](../app/api/account/route.ts) |
| Public adapter/cards | [`lib/custom-reviews.ts`](../lib/custom-reviews.ts), [`lib/public-review-view.ts`](../lib/public-review-view.ts), [`components/reviews.tsx`](../components/reviews.tsx), [`components/product-group-detail.tsx`](../components/product-group-detail.tsx), [`app/products/[handle]/page.tsx`](../app/products/%5Bhandle%5D/page.tsx) |
| Public pagination | [`app/api/reviews/page/route.ts`](../app/api/reviews/page/route.ts), [`lib/public-review-page.ts`](../lib/public-review-page.ts), [`components/use-public-reviews.ts`](../components/use-public-reviews.ts), [`tests/public-review-page.spec.ts`](../tests/public-review-page.spec.ts), [`tests/public-review-pagination.browser.ts`](../tests/public-review-pagination.browser.ts) |
| Verification badge meaning | [`lib/types.ts`](../lib/types.ts), [`lib/public-review-view.ts`](../lib/public-review-view.ts), [`lib/judgeme-reviews.ts`](../lib/judgeme-reviews.ts), [`tests/review-verification.spec.ts`](../tests/review-verification.spec.ts), [`tests/reviews-data.spec.ts`](../tests/reviews-data.spec.ts) |
| Public official replies | [`components/review-reply.tsx`](../components/review-reply.tsx), [`tests/custom-review-replies.spec.ts`](../tests/custom-review-replies.spec.ts), [`tests/public-review-replies.browser.ts`](../tests/public-review-replies.browser.ts) |
| Selected-product structured data | [`lib/product-schema.ts`](../lib/product-schema.ts), [`components/product-schema.tsx`](../components/product-schema.tsx), [`playwright.product-reviews.config.ts`](../playwright.product-reviews.config.ts) |
| Store persistence/contracts | [`lib/store-database.ts`](../lib/store-database.ts), [`lib/review-backend.ts`](../lib/review-backend.ts), [`lib/customer-account/backend.ts`](../lib/customer-account/backend.ts), [`packages/reviews/src/`](../../../packages/reviews/src) |
| Store storage diagnostics | [`lib/review-diagnostics.ts`](../lib/review-diagnostics.ts), [`tests/review-diagnostics.spec.ts`](../tests/review-diagnostics.spec.ts), [operations guide](REVIEWS_OPERATIONS.md) |
| Server photo processing | [`lib/review-photo-processing.ts`](../lib/review-photo-processing.ts), [`tests/review-photo-processing.spec.ts`](../tests/review-photo-processing.spec.ts), [media checkpoint](REVIEWS_MEDIA.md) |
| Private collection/associations | [`lib/review-photo-actions.ts`](../lib/review-photo-actions.ts), [`app/api/reviews/photos/route.ts`](../app/api/reviews/photos/route.ts), [`20261120230000_store_review_photo_attachments.sql`](../../tasks/supabase/migrations/20261120230000_store_review_photo_attachments.sql), [media checkpoint](REVIEWS_MEDIA.md) |
| Private photo staging | [`lib/review-photo-staging.ts`](../lib/review-photo-staging.ts), [`20261120220000_store_review_photo_staging.sql`](../../tasks/supabase/migrations/20261120220000_store_review_photo_staging.sql), [`store-review-photo-staging.sql`](../../tasks/tests/database/store-review-photo-staging.sql) |
| Owner moderation/replies | [moderation checkpoint](REVIEWS_MODERATION.md), [`apps/tasks/app/api/admin/reviews/route.ts`](../../tasks/app/api/admin/reviews/route.ts) |
| Migration policy and infrastructure | [database decision](REVIEWS_DATABASE.md), [`apps/tasks/supabase/migrations/`](../../tasks/supabase/migrations), [multi-instance policy](../../tasks/docs/MULTI_INSTANCE.md) |
| Release preparation and recovery | [cutover/rollback runbook](REVIEWS_RELEASE.md) |
| Recorded production provider and eventual retirement | [Judge.me removal checklist](REVIEWS_JUDGEME_REMOVAL.md) |
| Earlier commit-by-commit history | [implementation handoff](REVIEWS_HANDOFF.md) |

Some earlier handoffs still describe stages before purchase hooks or review
content landed. Their configuration/security details remain useful; for the
current completion status use this inventory and the source above.
