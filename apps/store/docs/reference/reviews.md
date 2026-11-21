# Store reviews: architecture and behavior

Reviewed November 20, 2026 against the repository. RMT migration history was
also read during this audit; live Shopify buyer flows, deployed flags and
external app settings were not exercised. This is the current overview;
implementation history belongs in Git.

## Current system

The Store uses its own reviews in RMT. Judge.me's reader, anonymous submission
path, provider switch and localhost review-mode selector have been removed.
Old `REVIEWS_PROVIDER`, `REVIEWS_PREVIEW_ENABLED` and `JUDGEME_*` settings have
no effect. Ryan chose retirement without exporting or importing the old reviews;
Judge.me is not a recovery path. External uninstall/settings cleanup is tracked
in the [roadmap](../planning/roadmap.md#14-store-reviews).

| Area | Current implementation |
| --- | --- |
| Buyer authentication | Confidential Shopify Customer Account client, PKCE/state/nonce, verified ID tokens, encrypted persistence, renewal, ordinary logout and account switching. |
| Purchase verification | Owned exact-line checks, bounded order discovery, current-session rechecks and Shopify-derived names. Customer API is pinned to 2026-10. |
| Submission | Whole stars, required title/body, signed-in verified and unverified feedback, duplicate protection, pending revisions. |
| Buyer management | `/reviews/mine`, twenty-row keyset paging, rejection guidance, edit/withdraw, uncertain-write recovery, account isolation and recent-purchase suggestions. |
| Staff moderation | Owner-only Tasks `/store-reviews`, waiting badge, product and pending/published/hidden/rejected/all filters, paging, approve/reject/hide/restore, publish rejected text, replies and audited permanent deletion. |
| Public reviews | Approved active text, verified-purchase badges, replies, complete product totals, star-rating filters, date/rating sorting, twenty-row paging and product JSON-LD. |
| Photos | Server normalization, private staging, upload budget, atomic revision associations, buyer selection/upload/remove/retry and authenticated blob previews. Owner previews and independent decisions; only approved media on active published text is served through revocable Store routes. |
| Database | Canonical Store migrations are RMT-only; the [database guide](review-database.md) records applied versions. |
| Operations | Fixed, sanitized Store backend failure events; feature gates; session-revocation RPCs; isolated tests and CI definitions. |

The code and prior docs record production's move to custom reviews on November
20. That record does not establish that every live authentication, purchase,
media or recovery case has been tested. See [operations](../how-to/review-operations.md)
for the evidence to collect rather than treating unrecorded checks as passed.

## Latest reviews on the home page

The bottom of the home page shows up to six newest published reviews across the
shop, including low ratings. It reuses product review cards, approved photo
paths and verified-purchase badges. Product links open the exact review when
the product still has a storefront page; unavailable products keep their saved
review title without a broken link. Long bodies have a compact preview.

The server uses the service-only `store_latest_reviews` reader and the canonical
public projection. It never requests buyer sessions or private moderation data.
The showcase reads per request so hiding, withdrawal and deletion are reflected
on the next load. Catalog caching is unchanged. Empty or unavailable reads omit
the section; no demo testimonials or partial-feed rating average is shown.

## Ratings on product cards

Product cards on the home page, collections, departments, and garment pages
show stars, the average, and the review count once a listing has at least
`MIN_LISTING_RATING_REVIEWS` (5) published reviews, so one outlier can't define
it. A design group's card pools every design's reviews, weighted by count.
`lib/listing-ratings.ts` reads per-product totals through the service-only
`reviews.summaries` command, which calls `store_review_summary` once per
product. Ratings follow the listing pages' five-minute revalidation, so a newly
approved review can take that long to move a card. A failed read leaves the
cards without ratings rather than failing the page.

## Buyer and publication rules

- Shopify sign-in is required. Identity, purchase snapshots and public names
  come from the server, never browser claims. IDs remain strings.
- A healthy lookup with an eligible paid/fulfilled order line requires that
  exact line and produces a verified purchase. A healthy lookup with no eligible
  line permits one unverified review per buyer/product. A lookup failure stays
  unavailable; it cannot grant the unverified path.
- Verified reviews are unique per shop/order/line, regardless of quantity.
  Unverified reviews are separately unique per shop/buyer/product.
- Every submission or edit waits for approval. An approved version remains
  public while an edit waits or is rejected. Approving a version also approves
  its undecided photos; photos staff rejected first stay rejected. Approval
  does not unhide a hidden review.
- Buyers can edit pending, published or rejected reviews and withdraw hidden
  ones. Withdrawal removes public text/rating on subsequent reads; staff cannot
  restore it. Resubmission uses the record again and gets a fresh publication
  date on approval. Withdrawal does not erase history.
- Buyer/staff writes compare exact six-digit database timestamps. Unknown write
  outcomes require a fresh read, not an automatic retry.
- Staff deletion is separate from rejection/withdrawal. It requires a policy
  reason and confirmation, permanently removes review history/reply/photo
  records, and preserves a restricted deletion audit. Failed object removal
  is reported and needs cleanup. See [moderation](review-moderation.md).
- Public payloads exclude tokens, buyer/order identifiers, private reasons,
  staff identity, concurrency versions and private photo context.

Product reviews default to newest first. Readers can filter by an exact whole-star
rating and sort by newest, oldest, highest rated or lowest rated. Rating ties use
newest first, then the review ID for a stable order. The average and total always
describe the whole product. A filtered empty state is separate from a product
without reviews, and reset restores all ratings and newest first.

The default list loads twenty reviews at a time. Selecting a filter or a
nondefault sort loads the remaining approved-only pages before displaying the
result, then reuses them for subsequent selections. This avoids treating the first
page as the whole product without a new database API. The tradeoff is that this
first selection reads every public review for that product; large review volumes
should move filtering and sorting into database paging. Loading is announced,
failed reads can be retried from the last completed page, and product changes
discard both the cached pages and selections.

The public `/reviews` page uses the same rating filter, four sort orders and
reset control across the whole shop. It starts with twenty reviews and loads
the remaining approved-only feed pages on the first refinement, reusing public
review cards and their product links. Matching results appear only after
every page loads; a failed continuation retains completed pages for a deliberate
retry. Until the full feed is loaded, the displayed count describes loaded
reviews rather than claiming a shop-wide total. As with product reviews, large
volumes should move these refinements into database paging.

Buyer management preserves a stored public name when its style is unchanged.
Changing to a named style requires a fresh Shopify profile; anonymous remains
available without that name lookup. Private paging, mutations and suggestion
loads recheck the session. Account equality markers prevent a previous account's
stale list/editor from being reused; they are not sign-in credentials.

Published reviews with a current storefront product include a direct link to
their public review, including when a newer edit is waiting or rejected. Links
use the canonical product/style URL and a `#review-<id>` anchor. The product page
loads approved public pages until it finds that review, then scrolls to and
focuses it. Removed or hidden reviews show an unavailable message; failed reads
wait for a deliberate retry and never fall back to private buyer content.

## Planning and operating procedures

The [roadmap](../planning/roadmap.md#14-store-reviews) owns future review work and
release gaps. Use [review operations](../how-to/review-operations.md) for diagnostic,
collection-pause, rehearsal and recovery procedures.

## Guide ownership and verification

| Guide | Owns |
| --- | --- |
| [Database](review-database.md) | RMT ownership, migration inventory, grants and database validation. |
| [Shopify authentication](review-authentication.md) | Client settings, encryption, sessions, login/logout/switch and renewal. |
| [Purchase eligibility](review-purchase-verification.md) | Exact-line rules, bounded reads, unverified fallback and suggestions. |
| [Media](review-media.md) | Processing, staging, attachment, private previews, staff decisions and revocable public delivery. |
| [Moderation](review-moderation.md) | Tasks owner UI/API, decisions, replies and policy deletion. |
| [Operations](../how-to/review-operations.md) | Diagnostics, release rehearsal, collection gates and recovery. |

Shared contracts are in `packages/reviews/src`. Store orchestration lives in
`lib/custom-review-access.ts`, `lib/custom-review-submission.ts`,
`lib/my-review-actions.ts`, `lib/review-backend.ts` and `lib/review-suggestions.ts`.
Tasks moderation lives in `apps/tasks/components/store-reviews` and
`apps/tasks/lib/server/store-reviews`. See each guide for focused commands and
`.github/workflows/store-review-tests.yml` for the maintained Store CI coverage.
Synthetic tests establish local contracts; they do not prove live provider
permissions, deployment flags or a hosted recovery rehearsal.
