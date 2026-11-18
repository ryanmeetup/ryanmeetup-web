# Ryan Meetup reviews rebuild

Updated **November 18, 2026**, against committed source through `9f72bac5`,
the working tree, focused automated checks, and the linked RMT migration history. This is the
current implementation inventory and remaining launch plan. Completed work
stays here so that an unproven live integration is not mistaken for missing code.

## Where we are

The core **text-review system is implemented**: Shopify buyer sign-in and
session code, exact purchased-line checks, submission, buyer editing and
withdrawal, owner moderation, official reply management, and public reads with
complete rating totals. Its six database migrations are applied to RMT.

It is **not yet a launch-verified Judge.me replacement**. Real Shopify buyer
authentication, client permissions, token renewal, purchase semantics, and the
complete buyer-to-moderator lifecycle still need proof in an isolated HTTPS
environment. Public reply rendering, public pagination, and grouped-product
rating consistency also need work. Custom photo collection is not built.

Judge.me remains the code default and the last documented production provider.
Custom sign-in/collection requires explicit configuration. This audit did not
inspect deployed environment variables or perform a real buyer login; do not
read the existence of routes or applied SQL as evidence that collection is live.
No provider setting, credential, deployment, or review content was changed.

**Judge.me content imports are deferred at Ryan's request (November 18).**
There is no active import or import dry-run milestone. Review request emails,
shop-wide discovery, and a native Shopify order-page shortcut remain Phase 2.
The earlier 4–6 week figure was an initial estimate, not a current estimate of
remaining effort; reassess after the live Shopify gate.

## What exists today

| Area | Implemented today | Limit or remaining work |
| --- | --- | --- |
| Provider selection | Server-owned `REVIEWS_PROVIDER`; blank defaults to `judgeme`. Browser selector supports Judge.me, custom, sample buyer, and reset. A concurrent worktree change restricts it to loopback hosts in local development or explicitly enabled local builds; all Vercel deployments, including Preview, refuse overrides. | Localhost restriction is in progress and was not covered by this audit's earlier test run. Hosted Preview uses deployment configuration. Sample mode checks input and saves nothing. |
| Shopify sign-in | Start/callback routes; public discovery; PKCE, state, nonce and browser binding; confidential-client token exchange and signed ID-token validation. | Intended client configuration, permissions, and real buyer login remain unproven. |
| Sessions | Opaque Secure/HttpOnly cookies, encrypted server persistence, seven-day absolute storefront session, access-token renewal, revision checks, and sign-out. | Live refresh rotation/reuse and recovery need evidence. No distributed refresh claim or expired-record cleanup job. |
| Purchase checks | Product-level order discovery, owned-order/line verification, product and variant snapshots, current encrypted-session checks, and Shopify-derived buyer names. Used by both picker and submit. | Conservative refund/edit policy and bounded history; see below. Live order semantics/permissions remain unproven. |
| Buyer composer | Whole stars 1–5, required text up to 5,000 characters, title up to 100, purchase picker, full name/first name and last initial/anonymous, exact public-name preview. | Text only. No custom photo picker/upload path. |
| Submission | Same-origin `POST /api/reviews` custom branch; authenticates buyer, rechecks purchased line and builds identity/name server-side; creates a pending revision. | Configuration gates exist; opening collection still requires live validation. Judge.me mode still has its legacy unverified forwarding branch. |
| Buyer management | Private `/reviews/mine` and `GET/POST /api/reviews/mine`; twenty-row pagination, all review states, edit/withdraw, account-switch and stale-write handling. Reviewed lines link here; withdrawn lines may be resubmitted. | Real Shopify-backed lifecycle still needs rehearsal. This is a storefront page, not a Shopify account extension. |
| Persistence | Review, revision, reply and audit tables; one review per shop + order + line; transactional writes; separate pending and approved text; exact database-version checks. | Media tables/buckets and retention/export/removal workflows remain. |
| Staff moderation | Tasks **Admin → Store reviews**, `/admin/reviews`; pending/published/hidden/all filters, paging, approve/reject/hide/restore, reasons, version conflicts and recent history. | Existing Tasks app owners only. No separate moderator role or full-history browser endpoint. |
| Official replies | Owner create/edit/remove with normalized preview, atomic audit/version updates, and approved-only public backend projection. | **Not rendered by storefront cards:** the adapter drops `reply` and the storefront `Review` type has no reply field. |
| Public reads | Approved active revisions only; complete count, average and star distribution; opaque backend paging cursor; unavailable state on failure. | Storefront requests only the first 20 and drops cursor, distribution, item attribution and edit timestamp. No public load-more UI. |
| Product integration | Per-product reads, selected-design review switching, cards, rating summary, published-photo gallery and product JSON-LD. | Grouped-page JSON-LD combines all design totals while visible reviews show one design. Verification badge still says “Verified review.” |
| Photos | Existing published-photo display/gallery and shared public photo contract, allowing up to five. | Custom SQL returns `photos: []`; image hosts currently cover Judge.me only. No custom upload, processing, moderation or cleanup pipeline. |
| Support revocation | Service-role-only function to revoke every review session for one buyer, scoped to shop/client/issuer/subject. Applied to RMT. | Database operation only; no route or staff UI. Sign-out ends the review session and leaves the separate Shopify account session signed in. |
| Automated coverage | Store HTTP/domain tests, Tasks contracts/routes, SQL isolation/concurrency checks, buyer and moderation browser fixtures, responsive/theme coverage, CI jobs. | Synthetic provider/browser coverage does not prove a live Shopify installation. |

## Architecture and ownership

- **Shopify** owns buyer identity, products, orders and fulfillment. Store
  buyers are not created as Supabase Auth users or Tasks workspace members.
- **`apps/store`** owns Shopify authentication, encrypted token handling,
  purchase eligibility, browser-facing review APIs, buyer UI and public cards.
  Shopify purchase authorization is enforced here; the storage backend does
  not independently query Shopify.
- **`apps/tasks`** hosts the private backend at `POST /api/store/customer-auth`
  and `POST /api/store/reviews`, plus the owner moderation page and
  `GET/POST/PATCH /api/admin/reviews`. This already serves more than auth:
  `authorizeStoreService` guards both storefront service routes with one
  dedicated bearer credential and pinned scope. Staff use a separate Tasks
  owner authorization boundary; that bearer never grants moderation access.
- **`packages/reviews`** owns shared input, result, public/private projection
  and cursor contracts. `packages/ui` supplies generic visual primitives.
- **RMT Supabase `lvfaartgcpphuokoswcm`** stores private auth and review data.
  Only the backend holds its Supabase secret. The store holds the restricted
  service credential, not a direct database/service-role key. Public reads
  cross the store server and allowlisted backend projection.
- **PRD `vjsnobmfsfrsnwukfaoq`** remains a separate personal Tasks instance.
  Store service configuration explicitly refuses it. Store migrations are
  RMT-only; PRD needs no review SQL, fake history entries or borrowed credentials.

All database history remains in `apps/tasks/supabase/migrations`, with scope in
`migration-scopes.json`. Do not create another migration history in the store.
Preview requires an isolated database/backend, service token, encryption
keyring and registered HTTPS callback. The browser provider selector does not
isolate storage and must never be used as a substitute for that separation.

### Database rollout, verified in this audit

`supabase migration list --linked` on November 18 confirmed the following
versions in RMT's remote history. The `20261120…` identifiers are migration
versions, not the date of this status report. This is history verification;
this audit did not rerun a schema diff or modify the database.

| Migration version | File / capability | RMT |
| --- | --- | --- |
| `20261120130000` | `store_customer_auth_storage.sql`: encrypted authorization/session persistence and atomic operations | Applied |
| `20261120140000` | `store_reviews.sql`: review content, revisions, replies, audit and public projections | Applied |
| `20261120160000` | `store_review_moderation.sql`: owner-checked moderation and queue | Applied |
| `20261120170000` | `store_review_replies.sql`: owner reply writes and compatible v2 staff projection | Applied |
| `20261120180000` | `store_buyer_reviews.sql`: paginated buyer reads, reviewed-line lookup and version-checked writes | Applied |
| `20261120190000` | `store_customer_session_revoke_buyer.sql`: revoke all sessions for a buyer | Applied |

The old `20261120150000` buyer-management draft was never applied or committed;
the final version is `20261120180000`. Applied SQL stays immutable.

## Current buyer and publication rules

1. The product page derives access from the server session and current Shopify
   purchases. It shows sign-in, no purchase, needs-help, already-reviewed,
   unavailable, or ready states. A sample buyer is available only through the
   permitted browser testing control and cannot save reviews.
2. A new submission rechecks eligibility. The browser supplies a product hint,
   selected line and review fields; it cannot choose the buyer, purchase
   snapshot or arbitrary public name. Numeric Shopify IDs remain strings so
   large IDs retain precision.
3. The database enforces one review per purchased line. Multiple units on a
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

Refunds on the reviewed line, edited orders and unverifiable facts are skipped
with lasting reason codes and a buyer needs-help state/contact link. They do
not close the entire review service indefinitely. Unpaid/unfulfilled lines
can become eligible later. Provider, storage and inconsistent-snapshot failures
stay unavailable and never become a successful empty purchase list.

This is narrower than the desired policy: **a refund after receipt should not
by itself disqualify feedback**. The current query cannot establish refund vs.
receipt chronology, and there is no staff eligibility override workflow.
Resolve that gap using live evidence before calling the policy complete.

Limits are deliberate: order discovery reads at most ten pages of ten orders;
an incomplete discovery remains unavailable. The whole product lookup has a
30-query budget and keeps already fully verified recent lines if later
candidate verification exhausts it; with none, that budget limit needs help.
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
- Configure an **isolated** HTTPS backend with the six migrations, pinned
  shop/client/issuer/callback/project scope and dedicated service credential.
  Configure the store's client secret, encryption keyring and backend URL/token.
  Both `STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED` on the store and
  `STORE_REVIEWS_CUSTOMER_AUTH_ENABLED` on the backend are explicit opt-ins;
  custom mode is also required. See [auth setup](REVIEWS_SHOPIFY_AUTH.md) and
  [backend setup](../../tasks/docs/STORE_CUSTOMER_AUTH.md) for exact setting names.
- Prove real sign-in, return to the intended product, encrypted persistence,
  access renewal, logout and account switching. Test refresh-token rotation,
  reuse and uncertain responses across workers; current coalescing is only
  within one process. Add a durable refresh claim if the provider requires it.
- Record redacted exact-line/product/variant and ownership evidence for normal
  orders, split fulfillment, unpaid/cancelled/edited orders, refunds before
  fulfillment and after receipt, deleted products and other-account attempts.
  Decide how legitimate refunded/edited purchases become reviewable.
- Establish which Printful delivery events actually reach Shopify. Delivery
  and the later review-request schedule remain unproven.

Public discovery and offline schema validation already passed in earlier
checkpoints. Neither establishes the intended client's real buyer permissions.

### 2. Finish public storefront wiring

- Carry `reply` through `lib/custom-reviews.ts`, `lib/types.ts` and the cards,
  and render approved official replies with their public date. Backend reply
  storage and the staff editor already exist.
- Expose the backend cursor through a safe public/storefront boundary and add
  pagination or load more. Today only the first 20 published reviews render,
  even when the complete summary counts more. Buyer and staff pagination are
  already implemented independently.
- Make grouped listings' visible scope and JSON-LD agree. Today
  `app/products/[handle]/page.tsx` sums every design's totals, while
  `components/product-group-detail.tsx` shows the selected product's reviews.
  Choose selected-product totals or an explicitly attributed combined view;
  avoid publishing partial group totals if one product read fails.
- Distinguish custom **Verified purchase** from legacy Judge.me **Verified
  review** without upgrading the meaning of legacy verification.
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

- Buyer attachment selection, preview, removal and edit behavior.
- Eligibility/ownership-bound, expiring upload authorization and private
  store-owned storage in RMT, isolated from Tasks attachments and Preview.
- Server validation of type, size and dimensions; re-encoding and metadata
  removal; media records tied to the buyer/review/revision.
- Staff media review and approved-only publication. Pending edit photos must
  not leak or silently replace the approved set.
- Cleanup of failed/abandoned uploads and removed/withdrawn media, plus an
  appropriate custom image-host allowlist and `next/image` configuration.
- Tested restore of image objects separately from database records.

The existing gallery, public photo type and five-photo constant do not provide
upload authorization or storage. No custom media bucket/migration exists yet.

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
- Verify monitoring, backend capacity, key rotation, backups and restore,
  Preview isolation, and support procedures. Decide whether support needs a
  staff UI for buyer-wide session revocation; the database function exists.
- Decide whether review logout should also sign out of Shopify. It currently
  leaves the separate Shopify session intact; global logout would also affect
  checkout and needs the registered provider logout flow.
- Finish the concrete cutover/rollback runbook below and verify the deployed
  configuration. Keep Judge.me installed and serving its current path until
  the release checks pass.

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

1. Pass the live buyer gate, public wiring checks, full lifecycle and agreed
   media scope; complete operational preparation. Record the exact deployed
   versions, environment/project identities and release owner.
2. Decide how historical Judge.me reviews will be presented or retained while
   imports are deferred. Custom reads deliberately do not merge/fall back to
   Judge.me, so switching providers will not carry its history along.
3. In the planned window, coordinate Judge.me collection and its queued request
   emails, remove/redirect old entry points, and disable the legacy unverified
   forwarding branch. Only then open the custom collection path and set the
   production provider to `custom`. New request emails are a later feature.
4. Keep Judge.me installed during the rollback window. Verify production buyer,
   owner and public behavior plus complete totals. Rehearse a return to
   Judge.me with custom writes stopped first and new custom reviews preserved;
   record how those reviews and duplicate-line ownership will be reconciled.
5. Remove Judge.me and its secrets only after rollback sign-off and checking
   account extensions, queued emails and any Shop sync dependency.

Do not install/uninstall Judge.me, change its emails, repoint credentials, or
switch the production provider merely to test this plan.

## Evidence and repeat validation

**Rechecked for this November 18 audit:**

- RMT linked remote history contains all six versions listed above.
- Storefront auth, purchase, submission, buyer-management, provider and backend
  checks: **155 passed, 2 skipped** across 21 selected spec files. The two
  encrypted-storage integration tests intentionally require the isolated
  database runner and were not executed in this audit. This run preceded the
  concurrent localhost-only selector edits; it does not validate those edits.
- Tasks auth/review/moderation contracts, routes and screen/client unit checks:
  **51 passed across 7 files**.
- Documentation links and `git diff --check` are checked for this edit.

Earlier [buyer](REVIEWS_BUYER_MANAGEMENT.md) and
[moderation](REVIEWS_MODERATION.md) checkpoints record isolated RMT/PRD SQL
replays, concurrency checks, nine buyer and seventeen moderation browser
scenarios, production builds, and light/dark inspection at
390/1024/1280/1536px. Those are historical results, not fresh runs in this
documentation-only audit. No live buyer/provider proof has been added here.

Useful repeat commands:

```sh
# From apps/store: server-free domain/HTTP checks using synthetic transports.
STORE_BASE_URL=http://127.0.0.1:39999 npx playwright test tests/customer-*.spec.ts tests/review-purchase-lookups.spec.ts tests/review-backend.spec.ts tests/custom-review-submission.spec.ts tests/my-review-actions.spec.ts tests/review-provider.spec.ts tests/review-collection.spec.ts tests/review-preview-api.spec.ts --workers=1

# From apps/store: isolated synthetic buyer browser suite.
npm run test:e2e:my-reviews

# From apps/tasks: contracts and HTTP boundaries.
npx vitest run tests/routes/store-customer-auth.test.ts tests/routes/store-reviews.test.ts tests/routes/store-review-moderation.test.ts tests/unit/customer-auth-contract.test.ts tests/unit/review-content-contract.test.ts tests/unit/review-moderation-client.test.ts tests/unit/review-moderation-screen.test.ts

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
| Shopify identity/session | [`lib/customer-account/`](../lib/customer-account), [auth setup](REVIEWS_SHOPIFY_AUTH.md), [backend setup](../../tasks/docs/STORE_CUSTOMER_AUTH.md) |
| Purchases and composer access | [`lib/review-purchases.ts`](../lib/review-purchases.ts), [`lib/customer-account/review-lookups.ts`](../lib/customer-account/review-lookups.ts), [`lib/custom-review-access.ts`](../lib/custom-review-access.ts), [purchase checkpoint](REVIEWS_PURCHASE_ELIGIBILITY.md) |
| Buyer submission | [`lib/custom-review-submission.ts`](../lib/custom-review-submission.ts), [`components/custom-review-composer.tsx`](../components/custom-review-composer.tsx), [`app/api/reviews/route.ts`](../app/api/reviews/route.ts) |
| Buyer management | [`lib/my-review-actions.ts`](../lib/my-review-actions.ts), [`components/my-reviews.tsx`](../components/my-reviews.tsx), [buyer checkpoint](REVIEWS_BUYER_MANAGEMENT.md) |
| Public adapter/cards | [`lib/custom-reviews.ts`](../lib/custom-reviews.ts), [`components/reviews.tsx`](../components/reviews.tsx), [`components/product-group-detail.tsx`](../components/product-group-detail.tsx), [`app/products/[handle]/page.tsx`](../app/products/%5Bhandle%5D/page.tsx) |
| Backend/contracts | [`apps/tasks/lib/server/store-reviews/`](../../tasks/lib/server/store-reviews), [`packages/reviews/src/`](../../../packages/reviews/src) |
| Owner moderation/replies | [moderation checkpoint](REVIEWS_MODERATION.md), [`apps/tasks/app/api/admin/reviews/route.ts`](../../tasks/app/api/admin/reviews/route.ts) |
| Migration policy and infrastructure | [database decision](REVIEWS_DATABASE.md), [`apps/tasks/supabase/migrations/`](../../tasks/supabase/migrations), [multi-instance policy](../../tasks/docs/MULTI_INSTANCE.md) |
| Earlier commit-by-commit history | [implementation handoff](REVIEWS_HANDOFF.md) |

Some earlier handoffs still describe stages before purchase hooks or review
content landed. Their configuration/security details remain useful; for the
current completion status use this inventory and the source above.
