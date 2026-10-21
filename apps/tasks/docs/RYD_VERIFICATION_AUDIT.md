# RY-D verification audit

Reviewed October 20, 2026; remaining work updated October 21, 2026. Scope: the Orders, Follow-up, and Unmatched views;
review, upload, reminder, fulfillment, and settings dialogs; matching and CSV
rules; all RY-D API and Google OAuth routes; migrations and access gates; the
sales connector; and the public `/cards/verify` redirect.

This is the remaining-work list. Resolved findings and repair history are
removed as fixes land. Remaining work concerns form-question mapping, the
buyer-facing form link, privacy language, and fail-closed read access.

## Remaining work

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
on RMT. The `20261101000000` contract migration is also applied and
health-verified on RMT. PRD's reported verification confirms that the contract
migration is recorded, but `contractOk` is false: all six failures concern the
missing `ryd_submitter_contacts` table from migration `20261024000000`.
PRD needs [the complete earlier-table repair](PRD_RYD_SUBMITTER_CONTACTS_SQL.md),
then verification must return `contractOk: true`, an empty `failures` array,
and both migration-recorded values true. The diagnostic's recorded version
alone does not establish schema health. Verification of all fifteen values in
[the cumulative dashboard handoff](PRD_RYD_FULFILLMENT_SQL.md) has not been
reported. The contract block was applied twice in a disposable database and
verified there before handoff. The earlier-table repair also reproduced PRD's
six failures in a disposable schema-only database, restored a healthy contract,
and preserved synthetic contact history when applied again.

Local migrations were applied from empty and diffed against RMT. Database
coverage includes 144 assertions and ten synchronized two-session races.
The latest races cover repeated production moves and contact confirmations;
earlier races cover overlapping imports, duplicate uploads, and reminders.
Audit failures roll back the operation and its receipt. Snapshot coverage also
checks more than 1,000 rows. All 131 Tasks unit/route files and 934 tests passed.
TypeScript, changed-file ESLint, `git diff --check`, and the production build
passed; the build ran its normal
RMT database preflight. The isolated staged source also passed all 129 committed
test files and 912 tests, plus TypeScript.

The enabled RY-D preflight now calls the read-only, service-only contract RPC.
Twenty-five pgTAP checks cover missing schema, unsafe table/column/RPC grants,
RLS policies, service privileges, RPC search paths, weakened constraints, changed
receipt keys, missing unique indexes, disabled triggers, and deleted page
metadata. Tests roll back every simulated change. Twenty-two unit cases verify
feature-off compatibility and refusal of unreadable or malformed settings and
health results. The full migration chain applied in a fresh shadow database;
the existing local database was preserved instead of reset.

The committed browser suite runs the actual Next page and API routes against
isolated Supabase and Google transports, using only synthetic credentials/data.
Its twelve desktop/mobile cases cover import → explicit link → decision → saved
CSV export → resume/confirm → production/done, confirmation replay without a
second sheet write, feature-off/anonymous/denied requests never reaching private
tables, and operator/owner settings authority. CI runs it separately from the
existing suite. The isolated staged source passed the same twelve cases, and
the existing four login checks passed against the shared test double. The
committed migration chain also diffed cleanly against RMT after application.
See [the test commands and boundaries](RYD_TESTING.md).

The committed synthetic Google fixture measures a queue load followed by 24
evidence files. Requests fell from 147 to 51, token refreshes from 49 to one,
and Forms calls from 50 to two. With a fixed ten-millisecond delay per network
leg, per-file latency fell from 60 to 20 milliseconds; this is a deterministic
comparison, not a production latency measurement. Coverage includes paginated
reads, cache expiry/capacity, large-result retention limits, connection/form
isolation, fresh provenance reads, cancellation of shared reads and streamed
bodies, deadlines after headers arrive, and access rechecks. Retention and
revocation are specified in [the data policy](RYD_VERIFICATION.md#data).

Sheet tests use synthetic Google API responses to cover non-first and copied
response tabs, duplicate/moved headers, exact seconds and normalized email,
blank/nonstring identities, duplicate rows, collisions with unselected form
responses, daylight-saving folds, existing values/formulas, missing/deleted
responses, partial results, and uncertain write acknowledgements. Explicit tab
IDs and single-cell ranges target writes; uncertain writes are never repeated.
The dialog retains its per-response report after confirmation and queue reload
failure, with accessible pagination and a manual spreadsheet link. Reports are
local to that dialog; row reads and writes remain separate requests, so
concurrent sheet sorting/editing is an operator constraint documented in
[the guide](RYD_VERIFICATION.md).

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
The component checks substitute Next navigation/image wrappers; they are not
an authenticated end-to-end test. The committed browser suite uses real Next
rendering and route authorization, with stubbed identity/database/Google
transports. Real Google consent, Drive media, and sheet writes remain untested.
PRD database checks are limited to the health result reported by the user;
direct access to that database is unavailable.
