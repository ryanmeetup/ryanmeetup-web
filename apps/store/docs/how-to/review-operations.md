# Review operations, release verification and recovery

Reviewed November 20, 2026 against the custom-only Store, Tasks moderation and
CI definitions. This guide combines diagnostics and the former release runbook.
No hosted log destination, alert, retention policy, deployment flag or recovery
rehearsal was configured by this documentation work.

## Release evidence to maintain

Keep deployment-specific evidence private and dated. The
[overview](../reference/reviews.md) describes built features;
[database](../reference/review-database.md) records the migration inventory. Local tests and
an applied migration list do not establish a working live buyer lifecycle.

| Evidence | What to record |
| --- | --- |
| Owners and deployments | Store/Tasks commits, fresh deployment URLs/times, responsible release/observation/recovery owners. |
| Isolation | Supported synthetic-data buyer/owner test target. Store permits RMT or nonproduction loopback; Tasks expects a pinned HTTPS project origin. A combined isolated target needs deliberate configuration. Preview must not use production RMT as its test database. |
| Shopify | Intended confidential client, exact HTTPS callback/origin/root logout registration, protected customer/order permissions and redacted live results. |
| Database and objects | RMT migration/schema verification, private SQL and object snapshot locations, restore result, cutoff versions/totals and reconciliation. Store extensions never target PRD. |
| Scope and observation | Text/photo scope, entry points, buyer verification rules, availability/latency/failure signals, observation window, thresholds, escalation owner and pause/resume criteria. |

## Collection controls

| Setting | Effect |
| --- | --- |
| Store `STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED=false` | Stops start/callback and ordinary session loading, including existing-session writes and My reviews reads/edits/withdrawals. Public approved text and photos remain available with storage configured. |
| Store `STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED=true` | Enables configured buyer flows, subject to current session/purchase/backend checks. Photo attachments follow their own collection setting below. |
| Store `STORE_REVIEW_PHOTOS_ENABLED` unset, blank or `true` | Default. Makes photo attachments available in product reviews, Ready to Review and My reviews edits, with configured RMT storage and buyer sign-in. |
| Store `STORE_REVIEW_PHOTOS_ENABLED=false` | Stops upload/discard/context/selection/preview operations and nonempty photo selections in writes. Text-only edits retain private selections; an explicit empty edit array may remove them. Already-approved public images remain available independently of this collection flag. |
| Tasks `STORE_REVIEWS_CUSTOMER_AUTH_ENABLED=false` | Stops configured staff queue, decision/reply/photo/deletion reads or writes independently of Store collection and other Tasks data. |
| Old Judge.me/provider settings | Ignored. They cannot restore a legacy reader or provide recovery. Judge.me was uninstalled on November 21. |

Retain database, client and encryption configuration during a pause. Ordinary
review logout can still revoke its Store session; **switch account** needs the
enabled sign-in service. Ordinary logout does not end Shopify's separate
session. Environment changes need a fresh deployment and a check of that
instance. They do not cancel work that already passed its checks; reconcile
in-flight writes before choosing a recovery cutoff.

## Live lifecycle rehearsal

1. Confirm a supported isolated target and client permissions. Prove real
   login/return, denial/failure, encrypted persistence, renewal/rotation/reuse,
   logout and switching to a different Shopify account.
2. Check real owned/foreign, normal/split/unpaid/cancelled/edited/refunded orders,
   nullable variants and deleted products. Healthy no-eligible-line results can
   permit unverified feedback; lookup failures must remain unavailable.
3. Submit verified and unverified reviews. Confirm pending privacy, duplicate
   handling, owner approval/rejection, rejected/product filters, publish-anyway,
   hide/restore and official reply create/edit/remove. Verify the public badge,
   text/reply, complete totals, selected-design JSON-LD and paging beyond twenty.
4. Edit/reject while approved text stays public. Exercise stale/unknown write
   outcomes and withdrawal/resubmission. Check exact versions and publication
   dates. Test permanent policy deletion on an approved synthetic fixture and
   verify the restricted audit, public removal and photo-cleanup reporting.
5. Pause with an active session/editor: later buyer reads/writes stop, public
   approved text remains and ordinary logout revokes. Pause Tasks separately;
   resume and check both paths with fresh deployments.
6. Photo attachments, staff media review and controlled publication are built.
   Collection is enabled by default; use the explicit false setting to pause it.
   Cleanup and recovery remain open work. On the isolated target, rehearse
   upload/preview/edit, separate text/photo approval and rejection, queue/badge
   retention, old public-path revocation on hide/withdraw/replacement/delete,
   failed preview recovery and account changes as part of hosted release verification.
7. Observe the agreed window using hosted monitoring. Record results instead
   of inferring health from a successful build or absence of error events.

## Sanitized Store backend failures

Search Store server logs for `store_review_operation_failed`. The event has
exactly four fields:

```json
{"event":"store_review_operation_failed","operation":"reviews.page","failure":"storage_error","code":"PGRST202"}
```

`operation` is a fixed backend command: public paging, buyer paging/individual
reads, reviewed-line/product checks or submit/edit/withdraw. An operation that
uses multiple read RPCs emits one failure event at this boundary. Photo
attachment failures inside submit/edit are covered; standalone photo calls are
not. Expected `exists`, `forbidden`, `conflict`, `closed`, `invalid_photos` and
`not_found` outcomes are not storage failures.

| Failure | Meaning |
| --- | --- |
| `storage_error` | Supabase client error, including transport errors normalized by that client. |
| `invalid_response` | Decoded result failed strict contract or scope checks. |
| `unexpected_error` | Exception outside the expected storage-error wrapper. |

`code` is from the fixed allowlist in
[`review-diagnostics.ts`](../../lib/review-diagnostics.ts), null when missing/empty,
or `unrecognized`. Arbitrary error properties are not safe merely because they
are called codes. Never add command payloads, raw errors/messages/details,
review text, buyer/order/review IDs, sessions, credentials or connection URLs.
A throwing log sink must not replace the caller's original safe failure.

| Code family | First investigation; not a proven root cause |
| --- | --- |
| `PGRST202`, `42883` | RPC signature/migration state and schema cache. |
| `PGRST204`, `PGRST205`, `42703`, `42P01` | Tables/columns, schema visibility and deployed contract. |
| `PGRST203` | RPC overload/signature ambiguity. |
| `42501`, `PGRST301`, `PGRST302` | Server credentials/grants and intended RMT connection, without printing secrets or borrowing PRD credentials. |
| `PGRST000`–`PGRST003`, `08000`, `08003`, `08006` | Database/pool connectivity. |
| `53300`, `53400`, `57014` | Capacity, configured limits and cancellations. |
| `23502`, `23503`, `23505`, `23514`, `22P02`, `22023` | Input/schema contract; ordinary duplicates should be domain outcomes. |
| `40001`, `40P01` | Concurrency; refresh before deciding whether a write can be repeated. |
| `57P01`, `XX000`, null, unrecognized | Service health and isolated private reproduction. |

This event excludes unavailable/missing configuration, auth/Shopify lookups,
Tasks moderation, standalone media calls, browser networking, latency and
successful traffic. Counts are failed backend operations, not all requests or
reviews. Use deployment version/time alongside them. References:
[PostgreSQL codes](https://www.postgresql.org/docs/current/errcodes-appendix.html),
[PostgREST errors](https://docs.postgrest.org/en/stable/references/errors.html).

Tasks deletion has a separate `store_review_photo_removal` server-failure path
when SQL committed but object removal failed. Its orphan files stay private and
unreferenced. There is no automatic cleanup worker yet; do not repeat a review
write blindly or claim that a failed HTTP acknowledgement means SQL rolled back.

## Recovery within the custom system

Judge.me was retired without importing/exporting its old content and is not a
fallback. Recover with compatible custom code/schema or a reviewed scoped repair.

1. Pause Store buyer flows and Tasks moderation separately. Verify the deployed
   controls and reconcile in-flight writes; preserve keys and existing records.
2. Capture private review/auth/audit tables as appropriate, image objects,
   exact versions and complete public totals at a recorded cutoff. RMT includes
   Tasks data: a review restore must not overwrite unrelated workspace changes.
3. Restore to an isolated target first. Verify ownership, revision/uniqueness,
   replies, deletion audit, public totals and object associations. SQL backups
   [exclude Storage bytes](https://supabase.com/docs/guides/platform/backups);
   prove object recovery separately.
4. Reconcile post-snapshot reviews and policy deletions deliberately. Never
   silently drop newer writes, republish removed content, rewrite applied SQL
   history or swap instance credentials to make recovery work.
5. Resume through fresh deployments, repeat buyer/staff/public checks and
   record the observation result. No successful hosted restore is asserted here.

## Operational readiness

Use the deployment record above to track which procedures have been rehearsed
and who operates the service. Unbuilt monitoring, abuse protection, cleanup and
retention capabilities are tracked in the
[roadmap](../planning/roadmap.md#14-store-reviews).

## Repeatable local checks

From `apps/store` (synthetic, server-free handler/transport tests):

```sh
STORE_BASE_URL=http://127.0.0.1:39999 npx playwright test tests/review-diagnostics.spec.ts tests/review-backend.spec.ts tests/public-review-page.spec.ts tests/custom-review-submission.spec.ts tests/my-review-actions.spec.ts tests/review-purchase-lookups.spec.ts --workers=1
```

The placeholder `STORE_BASE_URL` avoids starting a browser server for these unit
specs. For isolated browser behavior, use the maintained configurations:

```sh
npm run test:e2e:my-reviews
npx playwright test --config=playwright.review-photos.config.ts
npx playwright test --config=playwright.product-reviews.config.ts
```

Tasks uses `npm run test:e2e:reviews`; database validation runs the RMT and PRD
profiles sequentially from the [database guide](../reference/review-database.md). CI wiring
is in `.github/workflows/store-review-tests.yml` and
`.github/workflows/tasks-tests.yml`. These suites use synthetic transports and
cannot establish live Shopify permissions or a hosted recovery rehearsal.
