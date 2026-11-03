# RY-D code audit: open work

What is left from the 2026-10-30 audit of `/ryd` (`app/api/ryd`, `lib/ryd`,
`lib/server/ryd*`, `components/ryd`). Completed items are removed from this
file as they land; their commits and validation live in git history. Line
numbers drift.

## Pending rollout

Committed and applied to RMT; PRD still needs its dashboard SQL, in this order:

- [ ] [Card-contract repair](PRD_RYD_CARD_CONTRACT_REPAIR_SQL.md)
  (`20261116000000`)
- [ ] [Import card details](PRD_RYD_IMPORT_CARD_DETAILS_SQL.md)
  (`20261117000000`)

After deploying, disconnect and reconnect the RMT RY-D Google connection once,
so Google drops the old `spreadsheets` grant.

## Decision needed

### 5. Two overlapping fulfillment handoffs

Deferred by Ryan on 2026-10-30: leave both handoffs unchanged for now, and
explain the tradeoffs before revisiting.

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

## Notes for whoever picks these up

- Every change to user-visible RY-D behavior also updates
  `docs/RYD_VERIFICATION.md` and the current changelog entry
  (`changelog/v9-a-tidier-workspace.md`).
- Validation: `npx vitest run tests/unit tests/routes`,
  `npm run test:e2e:ryd`, `npx tsc --noEmit -p .`, ESLint on changed files,
  `git diff --check`.
- RY-D is off on PRD, but migrations still go to both instances.
