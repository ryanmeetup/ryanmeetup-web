# RY-D verification audit

Reviewed October 20, 2026; remaining work updated October 21, 2026. Scope: the Orders, Follow-up, and Unmatched views;
review, upload, reminder, fulfillment, and settings dialogs; matching and CSV
rules; all RY-D API and Google OAuth routes; migrations and access gates; the
sales connector; and the public `/cards/verify` redirect.

This is the remaining-work list. Resolved findings and repair history are
removed as fixes land. Next priorities are reliable sheet reconciliation and
the enabled RY-D contract checks.

## Remaining findings, in priority order

P2 marks concrete reliability, performance, or usability work. These are
source-level failure paths; no concurrency tests wrote to production customer data.

### 1. P2 — Sheet reconciliation relies on the first tab and loose identity

[markRydSubmissionsVerified](../lib/server/ryd-google.ts) assumes the first tab
is the response tab, then takes the first timestamp match within 1.5 seconds.
A missing email cell bypasses the email comparison. Reordering tabs or having
ambiguous timestamps can select the wrong cell or skip the correct one. A
successful partial tick count does not explain which rows remain unresolved.

Identify and validate the response tab, require an unambiguous row match, and
report matched, already ticked, missing, and ambiguous responses separately.
Never guess a row when more than one candidate fits.

### 2. P2 — Contract checks and end-to-end coverage stop short of RY-D

[The build preflight](../scripts/check-database-contract.mjs) verifies other
workspace contracts but not the enabled RY-D tables, columns, grants, or access
metadata. A successful build is therefore not proof that RY-D migrations are
present on both instances. The canonical review, fulfillment, import, reminder,
and bulk-operation RPCs have real database permission, rollback, and concurrency
coverage, but the committed browser suite still has no RY-D workflow coverage.

Conditionally check the enabled RY-D contract, including its private RPCs and
constraints. Add a committed synthetic browser fixture covering the full
import → link → decide → export → confirm → production lifecycle, including
feature-off, anonymous, denied member, and settings-authority cases.

## Smaller consolidations and policy gaps

- Title-based form-question inference is heuristic. Validate the name/email
  question mapping and surface ambiguity.
- The public redirect and reminder URL are separate from the editable form
  setting. An owner can point review at a different form from the one buyers
  reach. Show or validate that relationship. RY-D draft signatures and the
  verification URL also bypass instance branding/settings; either explicitly
  define RY-D as a Ryan Meetup-only feature or make those values configurable.
- The sales connector intentionally bypasses member page permissions under its
  separate bearer-token authority; that is documented behavior. Its typed email
  field is reduced to a domain, but free-text notes/answers and social URLs are
  returned. Do not describe that payload as fully anonymized or email-free.
- RY-D reads and recipient resolution still inherit the global “missing row
  is open” rule if the access metadata is deleted while the access RPC exists.
  The new write RPCs require actual page metadata or ownership. Align the read
  gate and recipient resolver with that fail-closed write rule.

## Validation and rollout

Review, fulfillment, import/reminder, and bulk-operation migrations
(`20261028000000` through `20261031000000`) were applied and metadata-verified
on RMT. PRD still needs all three complete SQL blocks in
[the cumulative dashboard handoff](PRD_RYD_FULFILLMENT_SQL.md).
Its verification must return one row with all fifteen values true.

Local migrations were applied from empty and diffed against RMT. Database
coverage includes 144 assertions and ten synchronized two-session races.
The latest races cover repeated production moves and contact confirmations;
earlier races cover overlapping imports, duplicate uploads, and reminders.
Audit failures roll back the operation and its receipt. Snapshot coverage also
checks more than 1,000 rows. All 128 Tasks unit/route files and 872 tests passed.
TypeScript, changed-file ESLint, `git diff --check`, and the production build
passed; the build ran its normal
RMT database preflight. The isolated staged source also passed all 126 committed
test files and 850 tests, plus TypeScript.

The committed synthetic Google fixture measures a queue load followed by 24
evidence files. Requests fell from 147 to 51, token refreshes from 49 to one,
and Forms calls from 50 to two. With a fixed ten-millisecond delay per network
leg, per-file latency fell from 60 to 20 milliseconds; this is a deterministic
comparison, not a production latency measurement. Coverage includes paginated
reads, cache expiry/capacity, large-result retention limits, connection/form
isolation, fresh provenance reads, cancellation of shared reads and streamed
bodies, deadlines after headers arrive, and access rechecks. Retention and
revocation are specified in [the data policy](RYD_VERIFICATION.md#data).

Local Playwright component checks use synthetic data at 390, 1024, 1280,
and 1536 pixels in light and dark themes. Unmatched checks cover complete
response details in both layouts, shared-upload deduplication, repeated
question titles, short social answers, long unbroken content, keyboard opening
and closing with focus restored, and a contained keyboard-scrollable table.
People remain intact across pages, and search covers every response's name,
email, social text, and other answers. Pending searches disable stale results,
and filtered bulk selections include every matching page while excluding
email-less identities from contact actions. Detail/draft opening records no
writes. Direct page links survive unrelated order counts, and removing the
last person on a page clamps the page even when reloading fails. Committed
unit tests cover evidence references, full response rendering, stable ordering,
search content, and pagination boundaries.

Refresh checks cover confirmed
reviews, normalized notes, link/unlink, settings, Google disconnection, response
removal/restoration, and rejected writes retaining their drafts. Explicit
refresh bypasses the Google cache, exposes pending state, loads new answers,
and retries reads without repeating writes. HTTP failures and partial Google
failures keep the last complete queue and confirmed changes visible. The
settings write returns its saved row without a second database read. Shared
matching rules recompute suggestions after acknowledged evidence changes,
retaining claims on finished orders outside the active queue.
Committed unit/route tests cover canonical reconciliation, saved revisions,
partial read failures, and refresh/error ordering. Bulk checks cover production
progress through a second-group failure, stable retry payloads, independent bounded
contact drafts, no writes on draft open/close, reload failure after a saved
contact, mail-link copy fallback, and disabled production/email actions while
search is pending. Out-of-order reloads cannot replace newer reloads or
canonical writes; committed unit tests cover that ordering rule. Reminder
checks cover independent draft confirmations, no writes on draft open or
close, stable operation keys on retry, shared row/review entry points, and
successful writes despite reload failure. Upload checks cover a stable retry
key and reload-failure handling.
Route tests also exercise oversized chunked uploads with absent or false
Content-Length and reject malformed files before database writes. Screenshots
were visually inspected. Earlier checks cover fulfillment snapshots, settings,
and separate email-less identities in both unmatched layouts.
These checks substitute Next navigation/image wrappers; they are not an
authenticated end-to-end test. Google consent, Drive media, sheet writes, and
PRD's live database remain untested.
