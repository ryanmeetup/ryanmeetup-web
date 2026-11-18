# Buyer review management checkpoint

Completed November 18, 2026. Judge.me remains the environment default and the
browser testing switch remains available in development/Preview. No collection
flags, deployed credentials, or Shopify configuration were changed. Judge.me
content imports remain deferred at Ryan's request.

## Small commits

| Commit | Reviewable chunk |
| --- | --- |
| `3de33a8c` | RMT-only buyer projection, scoped line lookup, version-checked transactions, and database tests. |
| `def7b97a` | Shared private contracts, bounded pagination, backend dispatch, and route tests. |
| `5445467b` | Buyer HTTP read/edit/withdraw boundary and session/ownership tests. |
| `93f74662` | My reviews screen, reusable editor support, and client recovery after uncertain outcomes. |
| `60891925` | Product picker excludes reviewed lines and links buyers to management. |
| `62517262` | Isolated browser fixture, responsive coverage, and CI job. |

## Behavior and boundaries

`/reviews/mine` is private, excluded from indexing, and available only in custom
mode with the configured buyer session service. It shows pending, published,
rejected, hidden, and withdrawn reviews, twenty at a time. Creation-time keyset
pagination reaches older records without the previous 100-review ceiling.
Product composers check only their eligible purchased lines, independently of
the length of the buyer's review history. Withdrawn lines may be resubmitted.

Edits create a pending revision while the approved version remains public.
Rejected reviews can be revised; hidden reviews can only be withdrawn by the
buyer. Withdrawal removes public content and its rating immediately. A later
resubmission receives a fresh publication date when staff approve it.

The subject comes from the encrypted server session. Shop scope comes from the
backend configuration. Browser fields cannot choose either identity or a public
display name. Unchanged name styles preserve their stored name; switching to a
named style requires a fresh Shopify profile, while anonymous remains available
without that lookup. Reads and mutations recheck the immutable session after
their lookups. No subject, session lookup hash, or token enters browser props.
The browser receives a one-way equality marker to discard the previous account's
list when another tab changes sign-in between pages.

Edit and withdrawal compare the exact six-digit database timestamp under the
review row lock. A stale editor reloads for a deliberate new decision. Unknown
write outcomes never retry automatically: stale controls disappear until a
fresh read succeeds. Confirmed saves with failed reloads are reported as saved.

## Database rollout

`20261120180000_store_buyer_reviews.sql` is committed in the canonical Tasks
migration history and declared RMT-only. The old `20261120150000` draft was
never applied or committed; it was moved after the existing moderation/reply
migrations before completion. No applied SQL or migration history was rewritten.

The RMT rollout used a separate linked snapshot matching the committed SQL.
Its dry run selected only version `20261120180000`, which was applied. Remote
history contains that version and no synthetic `20261120150000` entry. The final
linked comparison reported **no schema changes**. Live service-role checks read
empty buyer/line lists and returned `not_found` for writes against nonexistent
review IDs; they created no customer, review, or audit data. PRD needs no SQL.

## Verification

- Final isolated RMT reset/replay: 267 SQL assertions, two encrypted-storage
  integration checks, and both callback/logout concurrency checks passed in the
  shared worktree. That run also included the separate pending buyer-session
  revocation extension; it was not included in this migration's rollout.
- Isolated PRD profile: 65 Tasks assertions passed, with no Store objects or
  synthetic excluded-version history.
- 24 Tasks review/moderation route checks and 20 Store buyer/backend checks
  passed. Nine browser scenarios passed, including another buyer's ID, logout,
  mode switching, 125-review pagination, stale editors, lost acknowledgements,
  and saved writes whose reload fails.
- Light/dark screenshots inspected at 390/1024/1280/1536 pixels. Long product
  names wrap in the list and editor. The mobile editor retains its fixed footer
  and scroll affordance.
- Changed-file ESLint, TypeScript, `git diff --check`, Store production build,
  and Tasks production build with its normal RMT contract preflight passed.

Repeat the browser suite with `npm run test:e2e:my-reviews` from `apps/store`.
It starts independent local servers with synthetic encrypted sessions and
transport fixtures; it never connects to live Shopify or Supabase. It does not
prove real Shopify client permissions or authentication.

## Next small chunk

Configure the real confidential Shopify Customer Account client and an isolated
HTTPS preview backend using `REVIEWS_SHOPIFY_AUTH.md`. Verify buyer login,
purchase eligibility, renewal, and logout with real provider responses. Then
prove submit → approve → reply → edit/reapprove → withdraw, checking the public
rating totals throughout. Keep production on Judge.me until those checks pass.
Photos follow the working text-review flow. Expired auth-record cleanup remains
a separate backend task.

Concurrent order-state guidance and buyer-session revocation work may still be
uncommitted. Preserve it; it is separate from the commits above.
