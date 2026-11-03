# RY-D code audit: open work

What is left from the 2026-10-30 audit of `/ryd` (`app/api/ryd`, `lib/ryd`,
`lib/server/ryd*`, `components/ryd`). Completed items are removed from this
file as they land; their commits and validation live in git history. Line
numbers drift.

## Pending rollout

Both migrations (`20261116000000`, `20261117000000`) are applied to RMT and,
through the dashboard SQL, to PRD (2026-11-03).

- [ ] Push `main` and deploy both instances.

Optional hardening: after deploying, disconnect and reconnect the RMT RY-D
Google connection once. Until then the stored grant still includes the unused
`spreadsheets` scope (edit access to every sheet that account can reach).

## Parked

### 5. Two overlapping fulfillment handoffs

Decided by Ryan on 2026-11-03: keep both handoffs as they are, as manual as
possible, until he automates the flow himself. No code change.

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
