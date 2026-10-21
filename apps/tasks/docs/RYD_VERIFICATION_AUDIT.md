# RY-D verification audit

Reviewed October 20, 2026; remaining work updated October 21, 2026. Scope: the Orders, Follow-up, and Unmatched views;
review, upload, reminder, fulfillment, and settings dialogs; matching and CSV
rules; all RY-D API and Google OAuth routes; migrations and access gates; the
sales connector; and the public `/cards/verify` redirect.

This is the remaining-work list. Resolved findings and repair history are
removed as fixes land. Next priorities are evidence-fetch performance, bounded
bulk operations, and safer refresh state.

## Remaining findings, in priority order

P2 marks concrete reliability, performance, or usability work. These are
source-level failure paths; no concurrency tests wrote to production customer data.

### 1. P2 — Every thumbnail can re-read the entire form

[The evidence route](../app/api/ryd/evidence/[fileId]/route.ts) calls
`readRydSubmissions` for every uploaded file. Each call refreshes an OAuth token,
reads the form and all response pages, then fetches Drive metadata and media.
A view with many thumbnails repeats that work for each file. Every mutation's
full queue refresh repeats matching and the form read too. Google requests lack
explicit timeouts and cancellation.

Measure request count and latency first. Coalesce authorized reads, add bounded
timeouts and cancellation, and consider a short-lived, authenticated evidence
manifest. Any cross-request cache or signed manifest must explicitly define
revocation and retention behavior; do not put private evidence in Next's image
optimizer or an unrestricted shared cache.

### 2. P2 — Some bulk operations exceed API and email limits

Production and unmatched-contact selection can cover the whole filtered queue,
while their schemas accept at most 500 IDs or addresses and `readJson` allows
16 KiB. Long addresses can exceed that
body limit before reaching 500. Large `mailto:` URLs can also fail. The copy
fallback helps the email URL but does not fix recording the selected operation.
Production and email action bars sit outside the disabled pending-results
region; some buttons remain active while search results are stale.
Moving a mixed selection back can span two production RPCs; linking a
multi-response submitter still saves one response per request. Either action
can finish only part of the selected operation.

Buyer reminders now have bounded per-draft confirmations and retry receipts.
Apply explicit operation contracts, progress, and retry semantics to production
and unmatched contacts. Keep selection scope visible. Disable actions as well
as selection while search is pending; unmatched-contact retries need idempotency
before introducing automatic multi-request retries.

### 3. P2 — Refresh failure is confused with save failure

[The page controller](../components/ryd/RydPageClient.tsx), review, settings,
and unmatched-contact dialogs still await a full refresh in the same `try`
block as a successful mutation. A failed reload
can say the write failed and encourage a duplicate contact attempt. Concurrent
refreshes have no generation guard, so an older response can replace newer
state. There is no independent refresh control for newly arrived form answers.

Separate success from reload failure in those remaining handlers, reconcile
canonical mutation results, ignore obsolete refreshes, and offer an explicit
retry/refresh action.
Extract a focused queue controller and bulk-operation controller when doing
this; keep view rendering and domain rules in their existing owners.

### 4. P2 — The unmatched table hides evidence available in cards

[The table](../components/ryd/RydUnmatchedView.tsx) shows at most four files and
a `+N` label with no expansion action; it does not render `otherAnswers`.
There is no unmatched pagination or search. Repeated uploaded file IDs across
responses also create duplicate React keys and repeat thumbnail requests.

Add an accessible detail/expand action with the complete submission, deduplicate
file IDs, and page the results. Use the existing debounced-search contract if
search is added. Keep horizontal scrolling contained at mobile widths.

### 5. P2 — Sheet reconciliation relies on the first tab and loose identity

[markRydSubmissionsVerified](../lib/server/ryd-google.ts) assumes the first tab
is the response tab, then takes the first timestamp match within 1.5 seconds.
A missing email cell bypasses the email comparison. Reordering tabs or having
ambiguous timestamps can select the wrong cell or skip the correct one. A
successful partial tick count does not explain which rows remain unresolved.

Identify and validate the response tab, require an unambiguous row match, and
report matched, already ticked, missing, and ambiguous responses separately.
Never guess a row when more than one candidate fits.

### 6. P2 — Contract checks and end-to-end coverage stop short of RY-D

[The build preflight](../scripts/check-database-contract.mjs) verifies other
workspace contracts but not the enabled RY-D tables, columns, grants, or access
metadata. A successful build is therefore not proof that RY-D migrations are
present on both instances. The canonical review, fulfillment, import, and
reminder RPCs have real database permission, rollback, and concurrency coverage,
but the committed browser suite still has no RY-D workflow coverage.

Conditionally check the enabled RY-D contract, including its private RPCs and
constraints. Add a committed synthetic browser fixture covering the full
import → link → decide → export → confirm → production lifecycle, including
feature-off, anonymous, denied member, and settings-authority cases.

## Smaller consolidations and policy gaps

- Title-based form-question inference is heuristic. Validate the name/email
  question mapping, surface ambiguity, and retain all answers in detail views.
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

Review, fulfillment, and import/reminder migrations (`20261028000000` through
`20261030000000`) were applied and metadata-verified on RMT. PRD still needs
both complete SQL blocks in [the cumulative dashboard handoff](PRD_RYD_FULFILLMENT_SQL.md).
Its verification must return one row with all eleven values true.

Local migrations were applied from empty and diffed against RMT. Database
coverage includes 98 assertions and eight synchronized two-session races.
The latest races cover overlapping imports, duplicate upload requests, and
repeated reminder confirmations. Audit failures roll back the operation and
its receipt. Snapshot coverage also checks more than 1,000 rows. All 122 Tasks
unit/route files and 813 tests passed. TypeScript, changed-file ESLint,
`git diff --check`, and the production build passed; the build ran its normal
RMT database preflight.

Local Playwright component checks use synthetic data at 390, 1024, 1280,
and 1536 pixels in light and dark themes. Reminder checks cover independent
draft confirmations, no writes on draft open or close, stable operation keys
on retry, shared row/review entry points, and successful writes despite reload
failure. Upload checks cover a stable retry key and reload-failure handling.
Route tests also exercise oversized chunked uploads with absent or false
Content-Length and reject malformed files before database writes. Screenshots
were visually inspected. Earlier checks cover fulfillment snapshots, settings,
and separate email-less identities in both unmatched layouts.
These checks substitute Next navigation/image wrappers; they are not an
authenticated end-to-end test. Google consent, Drive media, sheet writes, and
PRD's live database remain untested.
