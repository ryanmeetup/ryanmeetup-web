# Review storage diagnostics

Updated November 20, 2026. The Store backend now emits structured failure
events to its server error log. This is local implementation and synthetic
test evidence; no hosted log destination, retention policy, alert rule or
production rehearsal was configured by this work.

## Event and coverage

Search the Store server logs for `store_review_operation_failed`. Each entry
is one JSON string with exactly these four fields:

```json
{"event":"store_review_operation_failed","operation":"reviews.page","failure":"storage_error","code":"PGRST202"}
```

`operation` is the validated backend command name. It can identify public
paging (`reviews.page`), buyer paging/individual reads (`reviews.mine`,
`review.mine`), reviewed-line/product checks (`reviews.reviewedLines`,
`reviews.reviewedProducts`), or buyer writes (`review.submit`, `review.edit`,
`review.withdraw`). Public paging uses two read RPCs but emits one event if
that backend operation fails, even when both reads fail.

| Failure | Meaning at this boundary | First investigation |
| --- | --- | --- |
| `storage_error` | The Supabase client returned an error, including transport errors it normalized. | Check the known code, intended RMT connection, applied migrations and provider availability. |
| `invalid_response` | A decoded result failed the expected public/private contract or scope checks. | Compare deployed code and database contracts; reproduce with a synthetic response. |
| `unexpected_error` | Execution threw outside the expected storage-error wrapper. | Reproduce on an isolated target; investigate the database client/call path. |

`code` is either a code from the fixed allowlist in
[`lib/review-diagnostics.ts`](../lib/review-diagnostics.ts), `null` for a
missing/empty code, or `"unrecognized"` for every other value. A field named
`code` can itself contain arbitrary content, so a pattern match alone does not
make it safe to log. Expand the allowlist only with a known code and a test.

The logger never receives a command payload, database row, raw exception,
error message/detail/hint, buyer/order/review identifiers, review text,
session material, credential or connection URL. It records no successes.
Expected domain answers such as `exists`, `forbidden`, `conflict`, `closed`,
`invalid_photos` and `not_found` are not storage failures. Rejected commands
never reach this log boundary. If the log sink throws, callers still receive the original
generic storage failure.

This instrumentation does **not** cover disabled/missing configuration that
returns no backend, Shopify identity/purchase lookups, Judge.me requests,
Tasks moderation, standalone photo processing/staging/budget calls, browser
network errors, latency or successful traffic. Photo attachment RPC failures
within review submit/edit do use this event; `invalid_photos` remains a normal
domain outcome.
Those paths retain their existing behavior/logging. An absence of events does
not establish health or a successful live integration; check public availability
and the corresponding private flow separately. Counts here are failed backend
operations, not a complete request denominator or a review count.

## Triage from the safe code

Use the deployment version and observation time alongside the event. These
are investigation starting points; the code alone does not establish the
root cause.

| Code | Investigation |
| --- | --- |
| `PGRST202`, `42883` | Check the expected RPC/signature and committed RMT migration state; a stale schema cache is also possible. |
| `PGRST204`, `PGRST205`, `42703`, `42P01` | Compare table/column contracts, migrations and schema visibility/cache. |
| `PGRST203` | Check RPC overload/signature ambiguity. |
| `42501`, `PGRST301`, `PGRST302` | Check server credentials and explicit grants without printing secrets or borrowing PRD credentials. |
| `PGRST000`–`PGRST003`, `08000`, `08003`, `08006` | Check database connectivity and connection-pool availability. |
| `53300`, `53400`, `57014` | Check capacity, configured limits and cancellation/timeout evidence. |
| `23502`, `23503`, `23505`, `23514`, `22P02`, `22023` | Compare the write/input contract with the schema; ordinary duplicate submissions should return a domain outcome. |
| `40001`, `40P01` | Check concurrency. Refresh the current review/version before deciding whether a user action can be repeated. |
| `57P01`, `XX000`, `null`, `"unrecognized"` | Check service health and reproduce privately; do not add raw error output to this event. |

The code definitions come from the
[PostgreSQL error-code appendix](https://www.postgresql.org/docs/current/errcodes-appendix.html)
and [PostgREST error reference](https://docs.postgrest.org/en/stable/references/errors.html).
The investigation steps above also depend on this repository's RMT-only
connection and migration rules.

A lost write response does not prove the transaction failed. Refresh buyer
or staff state before retrying. For an incident, use the collection pause in
the [release runbook](REVIEWS_RELEASE.md); do not delete reviews, change
database identities or replay pending writes as a diagnostic.

## Release evidence still needed

Choose a log destination/retention policy, alert conditions and a responsible
owner before launch. Verify the deployed event on an isolated target and
verify the matching unavailable response without copying private payloads.
Record the selected observation windows and thresholds against actual traffic;
none is assumed or activated here. Add availability/latency and the uncovered
auth, purchase and moderation paths to the monitoring plan.

The local regression command is server-free and uses synthetic transports:

```sh
# From apps/store; the placeholder URL prevents Playwright server startup.
STORE_BASE_URL=http://127.0.0.1:39999 npx playwright test tests/review-diagnostics.spec.ts tests/review-backend.spec.ts tests/public-review-page.spec.ts tests/custom-review-submission.spec.ts tests/my-review-actions.spec.ts tests/review-purchase-lookups.spec.ts --workers=1 --output=test-results-public-reviews/diagnostics-unit
```

The diagnostics subset covers public/private failures, malicious code values,
invalid response shapes, normalized transport failures, unexpected exceptions,
normal domain outcomes, public error privacy and a broken logging sink. It
does not use live credentials or apply a migration.
