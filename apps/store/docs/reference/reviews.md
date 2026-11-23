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
Judge.me is not a recovery path. Ryan confirmed it uninstalled, and Shop's
competing review-request emails turned off, on November 21, 2026.

| Area | Current implementation |
| --- | --- |
| Buyer authentication | Confidential Shopify Customer Account client, PKCE/state/nonce, verified ID tokens, encrypted persistence, renewal, ordinary logout and account switching. |
| Purchase verification | Owned exact-line checks, bounded order discovery, current-session rechecks and Shopify-derived names. Customer API is pinned to 2026-10. |
| Submission | Half-star ratings from 0.5 to 5, required title/body, signed-in verified and unverified feedback, duplicate protection, pending revisions. |
| Buyer management | `/reviews/mine`, twenty-row keyset paging, rejection guidance, edit/withdraw, uncertain-write recovery, account isolation and recent-purchase suggestions. |
| Staff moderation | Owner-only Tasks `/store-reviews`, waiting badge, product and pending/published/hidden/rejected/all filters, paging, approve/reject/hide/restore, publish rejected text, replies and audited permanent deletion. |
| Public reviews | Approved active text, verified-purchase and verified-Etsy-purchase badges (Etsy reviews imported through `scripts/import-etsy-reviews.ts`), replies, complete product totals, star-rating and source filters, date/rating sorting, text search on `/reviews`, numbered server-side pages and product JSON-LD. |
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
paths and verified-purchase badges. Product links open the product/style page
when it still exists. Removed products keep their saved product title with a
question-mark button beside it. Its popover explains the item’s availability and
offers “Request its return,” which opens `/contact` on the product-return topic with
the item name filled in. This also appears on the shop-wide `/reviews` feed.
The request goes through the existing contact delivery to store support; it
requires contact details and an item name, with no order details required.
A failed catalog lookup keeps the saved title without claiming the item was
removed or offering a return request. Long bodies have a compact preview.

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

## Store-wide rating on /reviews

The /reviews header shows stars, the average and the count across every
published review in the shop: store and Etsy reviews alike, including Etsy
listings that never came to the store and products no longer sold. It reads the
service-only `reviews.shopSummary` command, which calls `store_review_summary`
with a null product list (migration `20261121170000`). It is read per request
with the feed and has no minimum count. When there are no published reviews, or
the read fails, the line is left out and the feed still renders.

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

Product reviews default to newest first. Readers can filter by star, where each
option covers that star and the half star below it (4.5–5 stars), filter by
source (verified purchase, verified Etsy purchase, or no matching order), and
sort by newest, oldest, highest rated or lowest rated. Rating ties use
newest first, then the review ID for a stable order. The average and total always
describe the whole product. A filtered empty state is separate from a product
without reviews, and reset restores all ratings, all sources and newest first.

Product pages initially display up to four review cards with the full rating
summary. **See all reviews** opens the complete list and records `reviewPage=1`
in the URL; explicit review views, filters and review permalinks bypass the
preview. This leaves related products closer to the purchase area without
changing totals or product JSON-LD.

Full review lists use numbered pages: the shared `Pagination` control from
`@ryanmeetup/ui` and the shared `usePagination` hook, the same pair as the
Tasks list views. Readers choose 10, 25 (the default) or 50 reviews per page,
and the browser remembers that choice. Storage does the filtering, sorting,
searching and counting through the service-only `store_public_review_search`
reader, so each page change reads only the page on screen, and the count in
the pager ("Showing 26–50 of 168 reviews") covers every match. Changing a
filter, sort or search starts again at page one; a page number past the end
lands on the last page. While a page loads, skeleton cards stand in for the
results and paging is disabled; a failed read keeps the current page and offers
a deliberate retry.

The page, page size, filters and search live in the URL, so a view can be
shared. `/reviews` uses `page`, `pageSize`, `rating`, `source`, `sort` and
`q`, and renders the requested page on the server. Product pages prefix their
names (`reviewPage`, `reviewPageSize`, `reviewRating`, `reviewSource`,
`reviewSort`) so they never collide with the product's own parameters; the
server renders the first unfiltered page and the browser reads any other page
the URL names. Switching a style resets the review view. Unreadable URL values
fall back to the defaults, while the public `/api/reviews/page` and
`/api/reviews/feed` routes refuse unknown, repeated or malformed parameters.

The public `/reviews` page uses the same controls across the whole shop.
Feed product links open the plain product/style page without a review anchor,
since the reader has already read the review there. A debounced search box
matches review titles and text, reviewer names and saved product titles.

Buyer management preserves a stored public name when its style is unchanged.
Changing to a named style requires a fresh Shopify profile; anonymous remains
available without that name lookup. Private paging, mutations and suggestion
loads recheck the session. Account equality markers prevent a previous account's
stale list/editor from being reused; they are not sign-in credentials.

Published reviews with a current storefront product include a direct link to
their public review, including when a newer edit is waiting or rejected. Links
use the canonical product/style URL and a `#review-<id>` anchor. The product page
asks storage which approved page holds that review, clearing filters that could
hide it, then opens that page and scrolls to and focuses the review. Removed or hidden reviews show an unavailable message; failed reads
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
