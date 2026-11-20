# Review cutover and rollback runbook

Updated November 20, 2026, against the direct-RMT storefront and Tasks owner
moderation code. The collection pause has synthetic local coverage; the full
live rehearsal/recovery evidence remains incomplete. Production is recorded as
switched to custom mode on November 20 in [the removal record](REVIEWS_JUDGEME_REMOVAL.md);
that environment change does not establish that all release gates passed.
The private staging migration is applied to RMT; this runbook itself changes
no deployment, provider setting or buyer review content.

Use [the rebuild inventory](REVIEWS_REBUILD.md) for implementation status.
Claude's verified/unverified submission changes are committed, and migration
`20261120210000` and staging version `20261120220000` are confirmed in RMT.
Record the completed Shopify/lifecycle evidence separately from the provider
switch, and verify the exact release candidate deployed.
Existing Judge.me reviews remain there without import or custom-storefront
display, per the November 20 decision. Export a copy before eventual uninstall.
Custom request emails remain Phase 2.

## Release record

Complete this record for the rehearsal, then a separate one for production.
Store secrets, buyer identifiers and exported review data outside Git.

| Field | Record before starting |
| --- | --- |
| Release owner / rollback owner | Named people responsible for the window and recovery. |
| Store / Tasks source | Exact reviewed commit for each app, fresh deployment URLs and deployment times. |
| Store / Tasks target | Intended storefront origin and RMT project `lvfaartgcpphuokoswcm`; never PRD. |
| Test isolation | Record a target supported by both apps. The Store allows RMT or non-production loopback; Tasks moderation expects a pinned HTTPS Supabase project origin. A fully isolated buyer/owner target still needs deliberate configuration/code support. |
| Shopify client | Client identifier, shop, registered callback/origin and link to the redacted live test evidence; no client secret. |
| Review policy | Final verified/unverified behavior, duplicate rules, moderation policy and tests from Claude's completed implementation. |
| Migration state | Exact committed RMT-only versions applied, with remote verification. Do not assume a local draft is applied. |
| Recovery evidence | Private location of the review snapshot, cutoff totals/timestamps and successful isolated restore evidence. |
| Historical reviews | Judge.me history stays there and does not appear in custom reads. No import is planned; export a copy before uninstalling Judge.me. |
| Collection entry points | Product CTA, customer-account buttons, existing Judge.me request links and queued emails; record which remain active. |
| Scope and window | Explicit photo-launch scope, start time, observation window and conditions for resuming or pausing. No duration is assumed here. |

## What the current controls actually do

These are separate app settings. Retain database, Shopify and encryption
configuration during a pause; removing credentials is not the pause mechanism.

| Control | Effect |
| --- | --- |
| Store `REVIEWS_PROVIDER=custom` | Public reads use custom storage; the review POST uses the custom submission path. It does not by itself open buyer sign-in. |
| Store `STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED=false` with custom provider | Stops new sign-in and ordinary session loading. Valid submissions and My reviews reads/edits/withdrawals return unavailable. Published review reads continue when storage is configured. This also pauses already signed-in buyers; it is not a new-buyers-only switch. |
| Store `STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED=true` | Allows configured buyer authentication and session loading in either provider mode. Custom writes/My reviews additionally require the custom provider, current submission rules and storage. |
| Tasks `STORE_REVIEWS_CUSTOMER_AUTH_ENABLED=false` | Disables the store moderation scope, including owner queue/API reads and decisions/replies. It does not stop storefront writes, and does not change other Tasks workspace data. |
| Store `REVIEWS_PROVIDER=judgeme` | Switches public reads and the hosted customer-account collection link to Judge.me. The local anonymous POST relay is retired and returns `410`; switching providers cannot reopen it. External Judge.me forms/request emails are separate collection entry points and may still accept reviews. |

Review sign-out deliberately bypasses the sign-in-enable/provider gates, so it
can revoke an existing review session during a pause if its client, database
and keyring remain configured. It does not end the separate Shopify account
session. The local pause test below does not establish live logout behavior.

Environment changes need fresh deployments from the intended `main` version.
Record the newly deployed settings/version rather than redeploying an older
artifact with an earlier environment snapshot. Never change either Tasks
instance's Supabase identity to enable store review tools.

## Rehearse before scheduling production

1. Verify the exact isolated database/project and HTTPS callback before buyer
   tests. On a tunnel host use the deployment/environment provider; the browser
   provider selector is available only on loopback hosts. No test writes go
   to production RMT. A local Store/database plus HTTPS tunnel satisfies the
   Store guard, but Tasks moderation currently rejects a loopback Supabase
   URL. Establish a supported owner-side target too; the synthetic browser
   transport fixtures are not live configuration support. Do not bypass these
   checks against production as a rehearsal shortcut.
2. Complete a real Shopify login, renewal, logout and account switch. Record
   purchase and no-matching-purchase cases under the final policy, plus
   split fulfillment, refunds, edited orders and another account's IDs.
3. Exercise submit → approve → public display → official reply → buyer edit
   → reapprove → withdraw. Confirm pending edits remain private and public
   rating totals follow canonical publication state. Check selected-product
   scope, JSON-LD, stale editors and uncertain responses. Public reply display
   and pagination now have local adapter/browser coverage; the real
   owner-to-public loop still needs this rehearsal. Load beyond twenty rows,
   exercise a failed-page retry and switch products during a pending load.
   Confirm verified custom reviews say “Verified purchase,” published
   unverified reviews have no verification badge, and Judge.me reviews retain
   “Verified review” under their existing verification rules.
4. Exercise the agreed photo scope. [Server processing/private staging](REVIEWS_MEDIA.md)
   are tested and the RMT infrastructure is applied, but the upload HTTP/UI
   boundary, revision association and media moderation/publication are not
   implemented yet; a text-only launch must be recorded as an explicit
   scope change rather than checking photos off as complete.
5. Exercise the pause below with a real active session and an open editor,
   then resume it. Confirm a draft opened before the pause cannot save after
   the pause takes effect. Observe in-flight requests; a flag change cannot
   recall a transaction already accepted by an older running request.
6. Preserve reviews created after the candidate release, perform the chosen
   recovery path below and compare their state, revisions, replies and totals.
   Test restoration on an isolated target. The shared RMT production database
   is not a disposable review-only stack.
7. Run the normal Store and Tasks checks for the release versions, including
   builds and the Tasks database-contract preflight. The isolated Store demo
   build now passes; production configuration and the live database contract
   still need release evidence. Do not bypass the contract/type check.
8. Complete the [monitoring evidence](REVIEWS_OPERATIONS.md): connect the Store
   storage failure event to the chosen log destination/alerts, verify it on an
   isolated target, and record ownership/thresholds. Add checks for availability
   and the auth/purchase/moderation paths this event does not cover. The local
   diagnostic tests are not proof of a live alert or healthy configuration.

## Pause custom collection while retaining published reviews

1. Keep the Store on the custom provider and set this server configuration:

   ```dotenv
   REVIEWS_PROVIDER=custom
   STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED=false
   ```

   Retain the intended `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, shop/client,
   registered callback and encryption keyring. Make a fresh Store deployment
   and verify that production is serving it.
2. If the operation needs a stable review snapshot, also set Tasks
   `STORE_REVIEWS_CUSTOMER_AUTH_ENABLED=false` and freshly deploy Tasks. This
   pauses moderation/replies separately; the Store flag alone does not.
3. Check a known published product: reviews and complete totals should still
   load. With otherwise valid same-origin input, `/api/reviews` POST and
   `/api/reviews/mine` GET/POST should return 503 and `Cache-Control: no-store`.
   Malformed or cross-origin requests may still fail validation with another
   status before they reach the session gate.
4. For sign-in start/callback, an `Accept: application/json` request receives
   503 when the service is disabled. Browser HTML navigation instead redirects
   to the sign-in problem page; do not mistake that redirect for a working login.
   Verify sign-out separately with an existing session if logout is needed.
5. Wait for already-started app operations to settle and record the cutoff.
   Compare the read-only counters below at two observation points; investigate
   continued changes before calling a snapshot stable. These flags gate app
   routes, not arbitrary service-role SQL or future background workers.
6. Capture the agreed private review snapshot and release record. Keep buyer
   communication consistent with the paused edit/withdraw path; this mode does
   not provide a separate still-open withdrawal API.

To resume custom collection, verify the same source, database, client/keyring
and migration contract, then freshly deploy the Store with the sign-in flag
`true`. Restore the intended Tasks moderation configuration independently.
Reload lists/editors before making new decisions; preserve exact database
versions instead of replaying old pending requests.

## Cut over from Judge.me

1. Complete the rehearsal and release record. Take the agreed private
   snapshot/recovery evidence; the counters below are verification, not backup.
2. Close or deliberately redirect the old collection entry points and record
   Judge.me's queued request-email behavior. Keep Judge.me installed through
   the observation window. This runbook does not install/uninstall it or change
   its configuration automatically.
3. Verify the deployed release source contains the retired anonymous Judge.me
   POST branch: default/explicit Judge.me mode returns `410` with
   `Cache-Control: no-store` and makes no upstream create-review request.
   This is implemented and tested locally; deployed evidence is still needed.
   Keep Judge.me reads available if the recovery plan needs them. An older
   artifact predating this retirement can still reopen the relay.
4. Deploy the reviewed custom version with collection paused. Verify the
   intended RMT connection, approved public reads, product scope/JSON-LD,
   owner permissions and the chosen historical-review presentation. No import
   or automatic Judge.me/custom merge is part of this release.
5. Once those checks pass, open collection using the Store sign-in flag and
   independent Tasks moderation configuration. Record the enable time. Do not
   start a custom review-request worker; that feature is not built.
6. Perform the planned production check with the agreed account/purchase,
   observe errors and totals, and record the result. New production review
   content is real data and must be preserved through any recovery.

## Recovery paths

**Supported holding state: custom reads, collection paused.** Use the pause
procedure, freeze moderation if preserving a stable snapshot, retain all
review records and diagnose/fix the reviewed release. This retains published
custom content while collection is paused. Buyer management
is unavailable until session loading is enabled again.

**Return to Judge.me: conditional, still to rehearse.** First pause custom
collection/moderation, let in-flight operations settle and preserve all custom
reviews since cutoff. Switch providers only on a release version that contains
the anonymous POST retirement; the current source returns `410` in Judge.me
mode, and deployment must be verified. Judge.me collection/account entry
points and emails must follow the recorded recovery plan; do not blindly
reopen both collectors for the same purchase.

Custom reviews are not copied into Judge.me by provider switching. Keep a
private reconciliation record for reviews collected during the custom window,
including their purchased-line or account/product uniqueness and publication
state. Before reopening either collection path, record how existing reviews,
withdrawals, pending edits, replies and duplicate claims will be handled.
Import tooling remains deferred; do not pretend reconciliation is automatic.

Neither recovery path requires dropping review tables, rewriting migration
history, deleting custom reviews, changing PRD or restoring the shared live
RMT database to an older point. Retain compatible schema and encryption keys.
An older app artifact may have incompatible contracts; prefer a reviewed fix
or revert built freshly from `main` with the current environment.

## Read-only cutoff verification on RMT

Run on **RMT `lvfaartgcpphuokoswcm`**, not PRD. The Shopify shop ID below is the
documented Ryan Meetup shop `71870054511`; confirm it against the release
configuration. This block reads counts/timestamps, not review bodies or buyer
identifiers. Save all four result sets with the release record and compare
after the chosen drain interval. Stable counts alone do not prove there are
no in-flight transactions, and these results do not replace the private backup.

```sql
select r.state, count(*) as reviews,
       count(*) filter (where r.approved_revision_id is not null) as approved,
       max(r.updated_at) as last_review_change
from public.store_reviews r
where r.shop_id = '71870054511'
group by r.state order by r.state;

select count(*) as revisions, max(v.submitted_at) as last_submission,
       max(v.decided_at) as last_decision
from public.store_review_revisions v
join public.store_reviews r on r.id = v.review_id
where r.shop_id = '71870054511';

select count(*) as audit_events, max(e.created_at) as last_event
from public.store_review_events e
join public.store_reviews r on r.id = e.review_id
where r.shop_id = '71870054511';

select count(*) as official_replies, max(p.updated_at) as last_reply_change
from public.store_review_replies p
join public.store_reviews r on r.id = p.review_id
where r.shop_id = '71870054511';
```

An empty review store yields no state rows in the first result and counts of
zero/null timestamps in the others. A populated store has no prescribed count;
the saved cutoff and canonical review state are the comparison baseline.

## Local pause check and evidence

From `apps/store`:

```sh
npx playwright test --config=playwright.product-reviews.config.ts
```

The isolated suite uses ports 3142/54369 by default (overridable through
`PRODUCT_REVIEW_PORT`/`PRODUCT_REVIEW_FIXTURE_PORT`) and output
`.next-e2e/product-reviews`. It supplies valid synthetic Shopify configuration,
a disabled sign-in flag and a fake Supabase that permits public reads only.
Browser artifacts use `test-results-public-reviews/browser` so other local
Playwright runs do not clear them. The suite also covers product rating scope
and public official replies and pagination, including full-summary totals,
retry and stale-response handling when the selected product/provider changes.
The pause scenario checks readable published totals, refused sign-in/submission/
My reviews operations and zero attempted private storage operations. It does
not use live credentials, reset a database or prove real buyer logout, provider
access, staff pause, in-flight draining, deployment switching or restore.

The full release/recovery rehearsal remains open until its evidence is recorded.
For implementation details see the [sign-in setup](REVIEWS_SHOPIFY_AUTH.md),
[moderation checkpoint](REVIEWS_MODERATION.md) and
[database policy](REVIEWS_DATABASE.md).

The anonymous relay retirement has separate server-free regression coverage:

```sh
STORE_BASE_URL=http://127.0.0.1:39999 npx playwright test tests/reviews-api.spec.ts tests/review-provider.spec.ts tests/review-preview-api.spec.ts --workers=1 --output=test-results-public-reviews/relay-unit
```

The placeholder URL prevents server startup; these tests import the route and
replace provider transports. The focused retirement/read/custom-submission
run passed 55 tests, and the isolated Store production build passed. This
does not establish that a deployed version contains the retirement.
