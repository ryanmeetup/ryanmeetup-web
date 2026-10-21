# RY-D verification audit

Reviewed October 20, 2026. Scope: the Orders, Follow-up, and Unmatched views;
review, upload, reminder, fulfillment, and settings dialogs; matching and CSV
rules; all RY-D API and Google OAuth routes; migrations and access gates; the
sales connector; and the public `/cards/verify` redirect.

This is the remaining-work list. Resolved findings and repair history are
removed as fixes land. The next correctness work is transactional imports
and reminder confirmations.

## Remaining findings, in priority order

P1 means a correctness or integrity repair to do next. P2 means a concrete
reliability, performance, or usability improvement. These are source-level
failure paths; no concurrency tests wrote to production customer data.

### 1. P1 — Import and reminder history is still best effort

[recordRydEvent](../lib/server/ryd.ts) still logs an insertion error and returns
success for imports and reminder confirmations. These paths can lose required
history after their primary writes succeed. Import batch
creation and order insertion are also separate, and a concurrent duplicate
import can report or audit orders it did not insert.

Move each remaining operation and its events into one transaction. Audit only
rows actually changed and define idempotency for retries. Pairing, review, production,
and fulfillment already use transactional RPCs; retain that boundary.

### 2. P2 — Opening a draft is recorded as sending it

[Row email actions](../components/ryd/RydOrderTable.tsx) and the review dialog
write `last_emailed_at` on clicking a `mailto:` link. If the mail app does not
open, or the reviewer cancels, the buyer is still suppressed for 20 hours.
Bulk dialogs use a different, explicit “Mark as emailed” workflow. One bulk
confirmation can also mark both reminder groups when only one draft was sent.

Consolidate single and bulk reminders around one draft controller, preserving
personal greetings for one buyer and confirming each sent group separately.
Use the same source of truth for eligibility, recipient counts, and evidence
state. Keep the manual send behavior clear.

### 3. P2 — Every thumbnail can re-read the entire form

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

### 4. P2 — Bulk selection exceeds API and email limits

Selection can cover the whole filtered queue, while schemas accept at most 500
IDs or addresses and `readJson` allows 16 KiB. Long addresses can exceed that
body limit before reaching 500. Large `mailto:` URLs can also fail. The copy
fallback helps the email URL but does not fix recording the selected operation.
Production and email action bars sit outside the disabled pending-results
region; some buttons remain active while search results are stale.
Moving a mixed selection back can span two production RPCs; linking a
multi-response submitter still saves one response per request. Either action
can finish only part of the selected operation.

Add an explicit bulk operation contract with progress and retry semantics,
bounded recipient groups, and visible selection scope. Disable actions as well
as selection while search is pending. Contact attempts need idempotency before
introducing automatic multi-request retries.

### 5. P2 — Refresh failure is confused with save failure

[The page controller](../components/ryd/RydPageClient.tsx) and dialogs await a
full refresh in the same `try` block as a successful mutation. A failed reload
can say the write failed and encourage a duplicate contact attempt. Concurrent
refreshes have no generation guard, so an older response can replace newer
state. There is no independent refresh control for newly arrived form answers.

The fulfillment dialog already separates confirmation success from reload
failure. Apply that distinction to the remaining controllers, reconcile
canonical mutation results, ignore obsolete refreshes, and offer an explicit retry/refresh action.
Extract a focused queue controller and bulk-operation controller when doing
this; keep view rendering and domain rules in their existing owners.

### 6. P2 — The unmatched table hides evidence available in cards

[The table](../components/ryd/RydUnmatchedView.tsx) shows at most four files and
a `+N` label with no expansion action; it does not render `otherAnswers`.
There is no unmatched pagination or search. Repeated uploaded file IDs across
responses also create duplicate React keys and repeat thumbnail requests.

Add an accessible detail/expand action with the complete submission, deduplicate
file IDs, and page the results. Use the existing debounced-search contract if
search is added. Keep horizontal scrolling contained at mobile widths.

### 7. P2 — Sheet reconciliation relies on the first tab and loose identity

[markRydSubmissionsVerified](../lib/server/ryd-google.ts) assumes the first tab
is the response tab, then takes the first timestamp match within 1.5 seconds.
A missing email cell bypasses the email comparison. Reordering tabs or having
ambiguous timestamps can select the wrong cell or skip the correct one. A
successful partial tick count does not explain which rows remain unresolved.

Identify and validate the response tab, require an unambiguous row match, and
report matched, already ticked, missing, and ambiguous responses separately.
Never guess a row when more than one candidate fits.

### 8. P2 — Contract checks and end-to-end coverage stop short of RY-D

[The build preflight](../scripts/check-database-contract.mjs) verifies other
workspace contracts but not the enabled RY-D tables, columns, grants, or access
metadata. A successful build is therefore not proof that RY-D migrations are
present on both instances. Review and fulfillment RPCs now have real database
permission, rollback, and concurrency coverage, but the committed browser suite still has
no RY-D workflow coverage.

Conditionally check the enabled RY-D contract, including its private RPCs and
constraints. Extend database coverage to the remaining import and reminder
writes. Add a synthetic browser fixture covering the full
import → link → decide → export → confirm → production lifecycle, including
feature-off, anonymous, denied member, and settings-authority cases.

## Smaller consolidations and policy gaps

- Make CSV parsing reject malformed quoted records and surface skipped rows
  rather than silently accepting a damaged file. Bound streamed upload bytes;
  checking `File.size` after `request.formData()` does not bound parsing memory
  when Content-Length is absent or false.
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

The review and fulfillment migrations (`20261028000000` and `20261029000000`)
were applied and metadata-verified on RMT. PRD still needs both complete SQL
blocks in [the cumulative dashboard handoff](PRD_RYD_FULFILLMENT_SQL.md), which
includes the prerequisite review update. Its verification must return one row
with all ten values true.

Local migrations were applied from empty and diffed against RMT. Database
coverage includes 67 assertions and five synchronized two-session races:
competing claims, dismissal versus linking, production versus a stale decision,
preparation versus a ready decision, and concurrent send confirmations. A
1,004-row snapshot verifies that server preparation avoids the Data API row
cap. All 120 Tasks unit/route files and 795 tests passed. TypeScript,
changed-file ESLint, `git diff --check`, and the production build passed; the
build ran its normal RMT database preflight.

Local Playwright component checks use synthetic data at 390, 1024, 1280,
and 1536 pixels in light and dark themes. Fulfillment checks cover a matching
download/draft/confirmation identity, preparation and conflict retries,
confirmation success despite reload failure, explicit cancellation, and closing
without releasing a reservation. Screenshots, including scrolled mobile
actions, were visually inspected. Earlier checks cover review, settings,
reminders, and separate email-less identities in both unmatched layouts.
These checks substitute Next navigation/image wrappers; they are not an
authenticated end-to-end test. Google consent, Drive media, sheet writes, and
PRD's live database remain untested.
