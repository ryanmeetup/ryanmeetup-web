# Custom review release readiness and recovery

Updated November 20, 2026. The Store is **custom reviews only** following
`93bf9c40`. `REVIEWS_PROVIDER`, the provider switch, legacy anonymous form and
Judge.me reader have been removed. Earlier provider-cutover/rollback procedures
are superseded; Judge.me is not a recovery path. The
[removal record](REVIEWS_JUDGEME_REMOVAL.md) records no export/import of its old
reviews and tracks the remaining external uninstall/settings cleanup.

The [rebuild inventory](REVIEWS_REBUILD.md) is the current implementation and
migration record. Text reviews are implemented; the private photo backend is
implemented behind an off-by-default flag, with buyer UI, staff media approval,
publication and cleanup still outstanding. Production's recorded November 20
switch does not prove the complete live lifecycle or recovery procedure.

## Record the release target

Use separate records for an isolated rehearsal and production. Keep secrets,
buyer identifiers and snapshots outside Git.

| Field | Evidence needed |
| --- | --- |
| Owners | Named people responsible for release, observation and recovery. |
| Source/deployments | Exact Store and Tasks commits, fresh deployment URLs and times. |
| Database | RMT `lvfaartgcpphuokoswcm`, exact applied migration list and schema verification. Store extensions never target PRD. |
| Isolation | Supported buyer/owner test target with synthetic data. Store accepts RMT or nonproduction loopback; Tasks moderation expects its pinned HTTPS project origin. A combined isolated target still requires deliberate configuration. |
| Shopify | Intended shop/client, registered HTTPS callback/origin, required protected-data permissions and redacted live test evidence. |
| Buyer policy | Verified-line/unverified-product rules, uniqueness, version conflicts and moderation expectations. |
| Media scope | Whether the release includes photo collection. Text-only scope is an explicit decision, not completion of the photo feature. |
| Recovery | Private database and image-object snapshot locations, cutoff totals, restore evidence and reconciliation plan. |
| Entry points | Product review CTA, account buttons, Shop feedback email and any remaining external request links. |
| Observation | Agreed start/window, availability/latency/failure signals, escalation owner and pause/resume criteria. No duration is assumed here. |

## Controls available now

Retain the database, Shopify and encryption settings during a collection pause.
Removing credentials also breaks reads/recovery and is not the pause mechanism.

| Control | Effect |
| --- | --- |
| Store `STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED=false` | Stops new sign-in and ordinary session loading, including already signed-in buyer submission and My reviews reads/edits/withdrawals. Public approved-review reads remain available with storage configured. |
| Store `STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED=true` | Allows configured authentication and buyer flows, subject to current session/eligibility/storage checks. It does not enable photos. |
| Store `STORE_REVIEW_PHOTOS_ENABLED=false` | Default. Stops upload/discard and private selection/preview reads, plus nonempty photo selections in writes. Text-only edits retain existing private selections; explicit empty edit arrays may remove them while buyer text flows are enabled. No custom photo publication exists yet. |
| Tasks `STORE_REVIEWS_CUSTOMER_AUTH_ENABLED=false` | Stops configured staff moderation/reply reads and writes. It is independent of Store collection and other Tasks data. |
| Old provider/Judge.me variables | Ignored by the current code. They do not select a reader, reopen anonymous collection or provide recovery. Remove obsolete secrets/settings per the removal record. |

Review sign-out can revoke the storefront session during a collection pause
when its client/database/keyring remain configured. It does not sign the buyer
out of the separate Shopify account session. Account switching and logout still
need live evidence.

Flag changes take effect through the deployed server environment. Record a
fresh deployment and test the new instance; a change cannot cancel work that
already passed its checks. Keep authentication gates, write transactions and
public-read verification in the rehearsal.

## Rehearsal before calling the lifecycle verified

1. Confirm the exact client/callback/origin and isolated database target. Prove
   real sign-in, return to the intended product, encrypted persistence, access
   renewal, token rotation/reuse behavior, logout and account switching.
2. Cover real normal/split/unpaid/cancelled/edited/refunded orders, exact line
   ownership, deleted products and other-account attempts. A successful lookup
   with no eligible line may open unverified feedback; lookup errors must not.
3. Submit both verified and unverified text, confirm pending privacy and duplicate
   handling, then exercise owner approval/rejection, hide/restore and official
   reply create/edit/remove. Verify public body, badge, totals, reply and product
   JSON-LD, including selected-design changes and paging beyond twenty rows.
4. Edit a published review and reject the edit while keeping approved content
   visible. Exercise stale/uncertain writes and withdrawal/resubmission. Confirm
   exact versions and publication dates behave as intended.
5. Pause buyer collection with an active session and open editor. Confirm later
   reads/writes stop, public approved content remains and sign-out still revokes
   the session. Pause Tasks moderation separately. Resume and verify both paths.
6. Keep photos disabled until buyer UI, independent staff media decisions,
   controlled publication, lifecycle cleanup and recovery are implemented.
   Then rehearse upload/preview/edit/rejection/hide/withdraw and account changes
   on the isolated target before enabling production collection. Private GETs
   alone are not a complete media workflow.
7. Observe the agreed window with hosted monitoring. Local SQL/browser fixtures
   and the sanitized backend failure event do not establish live availability,
   latency, successful authentication or complete media monitoring.

## Recovery is within the custom system

1. Pause Store buyer flows and Tasks moderation separately and verify the new
   deployed state. Preserve encrypted-session configuration and existing data;
   reconcile in-flight writes before defining a snapshot cutoff.
2. Capture the relevant private review tables/audit and image objects, versions
   and complete public totals at the cutoff. RMT also contains Tasks data;
   review recovery must not overwrite unrelated workspace changes.
3. Restore and validate in an isolated target first. Reapply the committed
   migration profile as appropriate and verify ownership, revisions, exact
   versions, uniqueness, replies and public totals. Supabase SQL backups do not
   contain Storage file contents: prove object restoration separately.
4. Recover through a compatible custom application release/schema or a reviewed
   scoped repair. Do not delete/rewrite applied migration history or switch
   Tasks instances' credentials. Preserve reviews submitted since any earlier
   snapshot and document reconciliation rather than silently dropping them.
5. Resume the intended flows through fresh deployments, repeat buyer/staff/public
   checks and record the observation result. A working restore/recovery rehearsal
   has not yet been supplied by this project work.

## Existing automated evidence

The isolated profile runner tests RMT and shared-only PRD from empty, without
resetting the existing app stack. Current photo-read coverage adds current
selection/ownership/expiry tests to the existing attachment rollback and race
checks. Store transport/handler tests cover bounded downloads, digest checks,
removed selections, account changes, safe errors and concurrency. Real HTTP
checks verify disabled private endpoints and the photo-specific referrer rule.

Run from `apps/store`:

```sh
STORE_BASE_URL=http://127.0.0.1:39999 npx playwright test tests/review-photo-reader.spec.ts tests/review-photo-reads.spec.ts tests/review-photo-actions.spec.ts tests/custom-review-submission.spec.ts tests/my-review-actions.spec.ts tests/review-backend.spec.ts --workers=1 --output=test-results-public-reviews/photo-unit
npx playwright test --config=playwright.product-reviews.config.ts
```

Run the two profiles sequentially from `apps/tasks`:

```sh
node scripts/test-store-customer-auth.mjs
node scripts/test-store-customer-auth.mjs --target prd
```

See [media](REVIEWS_MEDIA.md), [database](REVIEWS_DATABASE.md),
[operations](REVIEWS_OPERATIONS.md) and the rebuild inventory for boundaries,
current results and work remaining. None of these checks uninstalls Judge.me,
changes Shop emails, enables a photo flag or creates real buyer content.
