# RY-D code audit

Status: in progress (5 of 12 items completed). Audited 2026-10-30, after the
full-export import and the 10 MB upload limit landed (`e1c1d082`, `544b8982`, `eaaa9156`). Tick each item as it
lands and note its commit.

This covers `/ryd`: `app/api/ryd`, `lib/ryd`, `lib/server/ryd*`, and
`components/ryd`. The foundation is sound — retry-safe RPCs, fail-closed
access, thorough tests. Most of what follows is leftover from handoff flows
that have since been replaced, plus one slow path in bulk Verify.

Line numbers are as of the audit and will drift.

## Suggested order

1. Fixes 1–4, Improvement 7, Refactors 9–10: removals and tightening, nothing
   a user sees change.
2. Decision 5, then Refactor 12 if that flow stays.
3. Improvement 6 and Refactor 11, each its own commit.
4. Improvement 8 when convenient; it needs a migration on both instances.

## Fixes

### 1. Bulk Verify reads the whole Google Form once per order

- [ ] Done

`decideSelected` in `components/ryd/RydPageClient.tsx:560` sends one PATCH per
order, one after another. For any order verified from a suggestion,
`reviewRydOrder` calls `rydSubmissionForm` (`lib/server/ryd-mutations.ts:48`),
which re-reads the whole form with `fresh: true`, bypassing the ten-second
cache. Verifying 77 suggested orders is up to 77 serial full form reads.

**Fix:** a bulk decision RPC that checks provenance once for the union of
submission keys and applies every decision in one transaction, keeping the
existing behavior: failed orders stay selected, unfinished cards are skipped,
locked orders are left alone.

### 2. The Google connection asks for spreadsheet write access it never uses

- [x] Done — `fd4eb591`

`SCOPES` in `lib/server/ryd-google.ts:48` includes
`https://www.googleapis.com/auth/spreadsheets` — read and write on every sheet
the form owner has. Only the dead sheet-ticking path (Refactor 9) used it.

**Fix:** drop the scope. `hasRydGoogleScopes` only gets looser, so the existing
connection keeps working. Reconnect once afterwards so Google drops the old
grant. Do this together with Refactor 9 and Fix 4.

Implementation is complete. After deployment, disconnect and reconnect the RY-D
Google connection once; an existing grant still retains its previous scopes
until it is replaced.

### 3. Some routes answer before the instance and access gate

- [x] Done — `001338ef`

`RYD_VERIFICATION.md` promises every `/api/ryd` route answers as if it doesn't
exist when RY-D is off. These call `readJson` before `rydContext()`, so a
malformed body returns 400 instead of 404 on PRD:

- `app/api/ryd/batches/route.ts`
- `app/api/ryd/cards/route.ts`
- `app/api/ryd/dismissals/route.ts`
- `app/api/ryd/production/route.ts`
- `app/api/ryd/reminders/route.ts`
- `app/api/ryd/settings/route.ts`
- `app/api/ryd/submitter-contacts/route.ts`
- `app/api/ryd/orders/[orderId]/route.ts`

**Fix:** call `rydContext()` first, as `imports/route.ts` already does. Add one
route test that a bad body on a disabled instance is a 404. Low severity:
`readJson` rejects cross-origin requests either way.

### 4. Stale comments and setup docs about ticking the response sheet

- [x] Done — `fd4eb591`

- `lib/ryd/ryd-decisions.ts:19`: "the pairing is what lets the send step tick
  the right rows in the response sheet."
- `lib/server/ryd-google.ts:36`: "tick `Verified?` in the form's linked
  response sheet."
- `docs/RYD_VERIFICATION.md` setup step 2 lists the Sheets API and the
  `spreadsheets` scope.

## Decision needed

### 5. Two overlapping fulfillment handoffs

- [ ] Decided: deferred by Ryan on 2026-10-30. Leave both active fulfillment
  handoffs unchanged for now; explain the tradeoffs before revisiting.

The Verified view offers both:

- **Card files**: the four-column card CSV fulfillment asked for (Order ID#,
  First & Last, Location, Date). It marks orders sent in the same transaction.
- **Generate email & CSV** (`RydSendDialog`, `/api/ryd/batches`,
  `lib/server/ryd-fulfillment.ts`): attaches fulfillment's original order file
  with a `Verified?` ✅ column, which has no card details. Its email lists
  names read from the linked form responses rather than the approved cards.
  Orders are marked sent separately.

Options:

- **Retire it.** Card files become the only handoff. This removes
  `RydSendDialog`, the batches route, `generateRydFulfillment`,
  `rydOrderExportCsv`, and `lib/ryd/emails.ts`'s fulfillment draft.
- **Keep the email, attach the card file.** The draft lists the approved card
  names, and nothing is read from Google to write it.

## Improvements

### 6. The queue reloads every verified order ever, with raw rows

- [ ] Done

`loadRydQueue` (`lib/server/ryd.ts:279`) selects `*`, raw CSV row included,
for everything open plus every verified order, done or not. With the full
export, raw is about 120 columns per order. At about 77 orders a week, that is
roughly 4,000 rows a year, all read on every refresh and all shipped to the
browser.

**Fix:**

- select only the columns the page uses (raw is only needed for the unsaved
  card draft, email, and total);
- leave orders marked Done more than about 30 days ago out of the live queue.
  They stay in the database and in card batches. Decide how a reviewer reaches
  them: a "Show older" filter, or nothing.

### 7. Two queries per refresh feed nothing

- [x] Done — `eb1df103`

`clearedCount` and `lastBatch` (`lib/server/ryd.ts:287–290`) are read on every
queue load and returned in `RydQueue`; no component reads them. Remove both
queries and both fields from `lib/ryd/queue-types.ts`.

### 8. Summary-imported orders never pick up card details

- [ ] Done

`ryd_import_orders` inserts with `on conflict (order_id) do nothing`. An order
first imported from the order summary (no `Options Detail`) keeps a
billing-name draft card even when the full export later includes it.

**Fix:** a migration that, for an existing order with no saved card and no
`Options Detail` in its raw row, merges the newly uploaded `Options Detail`
in. Report how many were filled in the upload summary. Follow the Supabase
process in `AGENTS.md`: commit the migration, push it to RMT, and give PRD the
SQL block for its SQL Editor.

## Refactors

### 9. Remove dead code (~700 lines)

- [x] Done — `fd4eb591`

No importers outside tests were found for any of these:

- the Google Sheets write path: `markRydSubmissionsVerified`
  (`lib/server/ryd-google.ts:241`), `lib/ryd/sheet-reconciliation.ts`,
  `lib/ryd/sheet-columns.ts`, `components/ryd/RydSheetReport.tsx`, and
  `tests/unit/ryd-google-sheet.test.ts`. Also check whether `linkedSheetId`
  and `questionTitles` on the form read are still needed once this goes;
- `setRydProductionStage` (`lib/server/ryd.ts:405`);
- the `/api/ryd/export` route and `rydFulfillmentCsv`; nothing in the UI calls
  them.

The database keeps the legacy RPCs and tables (`ryd_set_production`,
`ryd_prepare_fulfillment`, `ryd_finish_fulfillment`,
`ryd_fulfillment_snapshots`, `ryd_fulfillment_batches`) because the contract
check requires them. Retiring those is a separate migration and contract
change; it isn't needed for this item.

### 10. Remove fallbacks for migrations that are now guaranteed

- [ ] Done

`ryd_contract_health` (latest in
`supabase/migrations/20261114000000_ryd_settings_workspace_wide_only.sql`) now
requires every RY-D table and column, and the production build fails without
them. These tolerances can no longer trigger on an instance with RY-D on:

- `isMissingRelation` fallbacks in `loadDismissedKeys`,
  `loadSubmitterContacts`, `listRydCardBatches`, and `loadRydQueue`'s
  `emptyQueue(false)` (check whether `installed: false` is still reachable);
- the optional `production_sent_at?`, `done_at?`, and `card_*?` fields on
  `RydOrderRow`;
- the `updated_at` cast at `lib/server/ryd.ts:365`. Add `updated_at` to
  `RydOrderRow` instead.

Keep `isMissingFunction` in `rydMutationFailure`; it still gives a clear 503
during the deploy-before-migration window.

### 11. Split `RydPageClient.tsx` (1,498 lines)

- [ ] Done

It holds 15 `useState`s, 15 `useMemo`s, every view's toolbar, and all bulk
actions. Follow the shape `RydUnmatchedView` already has:

- one component per view: Queue, Follow-up, Verified/production;
- a `useRydSelectionActions` hook owning decide, contact, cancel, and move,
  plus their dialog state;
- small cleanups along the way, e.g. `contacting = contactOperation ? "*" :
  null` (line 237) and the `Dialog` union.

No behavior change. The RY-D Playwright suite (`npm run test:e2e:ryd`) is the
safety net.

### 12. Fulfillment email generation reads every link

- [ ] Done (or obsolete after Decision 5)

`generateRydFulfillment` (`lib/server/ryd-fulfillment.ts:46`) reads every row
of `ryd_order_submissions`, then filters in code to the selected orders.
Filter with `.in("order_id", …)` in the query instead.

## Notes for whoever picks these up

- Every change to user-visible RY-D behavior also updates
  `docs/RYD_VERIFICATION.md` and the current changelog entry
  (`changelog/v9-a-tidier-workspace.md`).
- Validation: `npx vitest run tests/unit tests/routes`,
  `npm run test:e2e:ryd`, `npx tsc --noEmit -p .`, ESLint on changed files,
  `git diff --check`.
- RY-D is off on PRD, but migrations still go to both instances.

## Initial implementation pass — 2026-10-30

- `001338ef`: instance and page gates precede body parsing on all eight affected
  routes, including both dismissal methods. Regression tests cover malformed
  bodies on disabled instances and denied page access.
- `fd4eb591`: remove the unused Sheets write integration, sheet lookup helpers,
  legacy snapshot export route, and unused production wrapper. Keep the database
  objects required by the contract and both active fulfillment handoffs. Update
  Google setup instructions and verify narrower scopes accept existing grants.
- `eb1df103`: remove the unused cleared-order count and last-batch queries,
  payload fields, and obsolete test fixtures. Cover the actual queue query count.

No database migrations or deployments are part of this pass. The Google
reconnection remains a post-deployment step. Next priority is item 1's bulk
verification transaction; items 6, 8, 10, and 11 remain open. Item 5 is deferred
at Ryan's request, so item 12 remains untouched too.

Validation for this pass:

- `npx vitest run tests/unit tests/routes`: 1,063 tests passed across 138 files.
- `npm run test:e2e:ryd`: all 44 desktop/dark and mobile/light checks passed.
  The anonymous-download check now targets the active card download route.
- `npx next typegen` and `npx tsc --noEmit -p .`: passed after regenerating the
  removed export route's stale generated types.
- ESLint on changed TypeScript/TSX files and `git diff --check`: passed.
- `npm run build`: passed, including the real RMT database contract preflight
  for `lvfaartgcpphuokoswcm`.

Existing staged and uncommitted work was preserved, including the public-site
RY-D route rename and buyer verification URL updates.
