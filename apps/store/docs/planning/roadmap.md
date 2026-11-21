# Store readiness and remaining work

Reviewed November 21, 2026 against the repository and the prior dated operating
records. The store already accepts orders; this is a remaining-work list, not
an assertion that checkout is still waiting to launch. Etsy stays alongside it
until Ryan chooses otherwise.

This audit read RMT migration history and current provider documentation. It
did not log into Shopify/Printful Admin, change deployments, place an order or
exercise a real buyer login. Items requiring those checks stay explicit rather
than inheriting an old "not started" or "done" label.

## Already implemented

- Shopify catalog, theme collections, category-driven Apparel/Accessories,
  grouped listings, style/color/size selection, curated/fallback home features,
  designer credits, sales, sorting and display-only currency conversion.
- Cart drawer/page using Shopify cart IDs and `checkoutUrl`; expired/checked-out
  carts recover on the next load. Shopify hosts payment, confirmation, order
  status and customer accounts.
- Signed catalog webhooks with five-minute cache freshness as a fallback;
  About, support, policy pages, sitemap and branded error pages.
- Six newest published reviews on the home page, with ratings, approved photos
  and links to their product reviews.
- A paginated shop-wide review feed at `/reviews` with debounced search,
  filters and sorting; rating summaries on product cards.
- Custom text reviews with Shopify sign-in, half-star ratings (0.5 to 5),
  verified/unverified feedback, management/suggestions, full product totals,
  paging, replies and owner moderation in Tasks, including rejected/product
  filters and audited deletion.
- Review write budgets (`store_review_write_budgets`): per-buyer hourly/daily
  and per-network hourly limits on submissions, per-buyer hourly limits on
  edits. Sign-in itself is not yet throttled.
- Photo processing/staging/associations and buyer controls, separately gated;
  owner previews and per-photo approval/rejection with reasons shown to the
  buyer in Tasks; approving a review approves its undecided photos;
  approved-only public images with revocation on hide/withdraw/replacement/deletion. Attachments are
  enabled by default for signed-in reviews, with an explicit collection pause.
  Cleanup, recovery and hosted proof remain open.

The November 15 record confirms paid checkout, Printful SKU mapping, branded
checkout/accounts and US name-tag shirt/hoodie shipping quote checks. It does
not prove every current Admin setting, delivery, tax or notification case.

## Remaining work

Item numbers remain stable for existing references.

| # | Work | Current evidence / next action |
| --- | --- | --- |
| 4 | [Shopify/Printful operating setup](#4-shopify-and-printful-operating-setup) | Partially verified historically; finish/verify markets, other shipping families, taxes, emails and a real order lifecycle. |
| 11 | [More from this shop](#11-more-from-this-shop) | Unimplemented product-page recommendations. |
| 8 | [Note to seller and personalization](#8-note-to-seller-and-personalization) | Neither storefront input is implemented; confirm which personalization is actually needed. |
| 14 | [Store reviews](#14-store-reviews) | Text and photo publication built; cleanup/recovery, external cleanup and live proof remain. |
| 9 | [Optional processing and delivery summary](#9-optional-processing-and-delivery-summary) | Optional product-page guidance; no storefront rate estimator is required. |

### 4. Shopify and Printful operating setup

- [ ] Confirm the countries the store should serve. The last recorded Markets
      check (November 15) was US-only. Align policy wording with the actual
      enabled countries, Printful restrictions and available checkout rates.
- [ ] Verify shipping profiles for every product family and intended destination,
      including highest supported weights and mixed profiles. Only US name-tag
      shirts/hoodies have recorded quote evidence. Use [shipping setup](../how-to/shipping-setup.md).
- [ ] Verify tax configuration and checkout results for the intended regions in
      Admin; the repository cannot establish collection settings.
- [ ] Finish/verify notification branding and direct store links using
      [hosted pages](../how-to/shopify-hosted-pages.md#2-point-the-emails-at-the-store).
- [ ] Complete a real buyer order through charge, correct shipping/tax,
      Printful fulfillment, confirmation/shipping email and account/order links.
      The second order was recorded as in fulfillment, not delivered, on
      November 15. Do not assume a later delivery outcome.
- [ ] Remove the custom-rate $0.40 holiday allowance after January 17, 2027,
      following a fresh rate check. Printful documents the surcharge through
      that date; custom rates do not update themselves.

Admin API access previously returned access-denied responses. Verify current
permissions only when an Admin operation is needed; do not treat speculative
scope grants as a storefront feature or change credentials as documentation
cleanup. Manual Admin configuration remains a valid path.

**Complete when:** intended destinations have appropriate rates/policy/tax
settings and a dated end-to-end order/email result exists. Current product/SKU
counts are catalog data, not a permanent completion criterion.

### 11. More from this shop

Product pages render their selected listing and reviews but no related-listings
section. Add recommendations using the current product/collection context and
existing cards/grid, deduplicating grouped listings and excluding the current
one. Confirm an appropriate Shopify operation/schema if using API recommendations.

**Complete when:** product pages offer other relevant, purchasable listings with
an empty-state fallback. Existing popularity sorting is not this feature.

### 8. Note to seller and personalization

The cart has no editable order note and the product form has no personalization
input. Confirm the Etsy listings that need personalization before adding it.

- Add an order-level note in the cart page/drawer and persist it in Shopify.
- For products that actually require it, model per-line personalization through
  product configuration and cart line attributes, with clear required fields.
- Verify the data reaches the Shopify order and the fulfillment process; do not
  assume a Printful print file can be changed by arbitrary line attributes.

**Complete when:** notes and any required personalization survive checkout and
have a confirmed fulfillment procedure. Gift messages may use the order note;
no separate gift-options feature is planned.

### 14. Store reviews

The [reviews reference](../reference/reviews.md) describes current implementation.
This section owns the review backlog; [operations](../how-to/review-operations.md) owns
the repeatable rehearsal and recovery procedures. Sign-in is required; eligible
exact-line purchases receive a verified badge, and healthy lookups without an
eligible line can submit
unverified product feedback. All submissions wait for approval.

#### Release verification

- [ ] Establish a supported isolated HTTPS buyer/owner target. The Store accepts
      RMT or nonproduction loopback, while Tasks moderation expects a pinned
      HTTPS project origin. Do not use production RMT or PRD as a Preview test.
- [ ] Record real client permissions and sign-in/return, denial/failure,
      encrypted persistence, renewal/rotation/reuse, logout and account switching.
- [ ] Verify owned/foreign orders, normal/split fulfillment, partial payment,
      cancellation, edits, refunds before/after receipt, deleted products,
      nullable variants and bounded order histories. Record Printful delivery
      evidence before using it to time review requests.
- [ ] Record the complete buyer → owner → public lifecycle, unverified feedback,
      duplicate protection, stale/uncertain writes, policy deletion and public
      totals/JSON-LD. Follow the [rehearsal](../how-to/review-operations.md#live-lifecycle-rehearsal).
- [ ] Prove separate database/object restore and collection pause/resume with
      in-flight-write reconciliation, using the
      [recovery procedure](../how-to/review-operations.md#recovery-within-the-custom-system).

#### Implementation required for media and operations

- [x] Independent staff media decisions, approved-only projections and revocable
      revision-bound public delivery. The Judge.me image-host allowlist is removed.
      Synthetic database, route and browser tests cover these contracts; hosted
      rehearsal and deployed configuration verification remain separate.
- [ ] Implement bounded auth authorization/session/tombstone, draft and upload-budget
      expiry; abandoned/historical/orphan object cleanup; and retryable cleanup
      after a committed review deletion whose Storage removal failed.
- [ ] Define retention, customer export/removal and deletion-audit/private-note
      handling. Withdrawal is not erasure; SQL backups exclude Storage bytes.
- [ ] Add hosted logs/retention, availability/latency signals, alert thresholds,
      an observation window and response ownership. Cover auth, Shopify reads,
      text writes, moderation and standalone media in addition to current
      sanitized backend failures.
- [ ] Add sign-in abuse controls. Submission/edit write budgets and upload
      budgets exist; Shopify sign-in and session renewal remain unthrottled. Confirm hosted photo collection settings and record lifecycle,
      cleanup and recovery evidence.

#### Conditional and optional features

- Add fulfillment-child pagination if real supported orders exceed the current
  fifty-child limit; preserve bounded/fail-closed reads meanwhile.
- Add a distributed refresh claim if the intended client's real token-rotation
  behavior requires serialization across workers.
- Add a shop-wide rating on home/About if wanted, plus displayed distribution
  and sorting as separate public-review features.
- Request emails need delivery-event evidence, timing, eligibility rechecks,
  deduplication, opt-outs and monitored delivery. They are not implemented.
- Customer-account extensions, support session-revocation UI, staff verification
  overrides, delegated moderators and full audit/deletion-log browsing need
  explicit scope, authorization and audit design before implementation.

#### External cleanup

- [ ] Confirm Judge.me is uninstalled in Shopify, including its order-review
      button/account entry points. Ryan chose no old-review export/import.
- [ ] Disable competing Shop product-review prompts/feedback-request emails
      where available in Admin and verify the actual buyer-facing entry points.

**Complete when:** the selected text/media scope has live lifecycle and recovery
proof. A photo requirement is not met merely by private uploads or text approval.
Judge.me cannot be used as a recovery provider; see [operations](../how-to/review-operations.md).

### 9. Optional processing and delivery summary

Shipping quotes may remain entirely in hosted checkout, as Ryan chose on
November 14. No product/cart shipping-rate estimator is required. If useful,
add a concise processing/delivery summary sourced from maintained policy or
product data; do not hard-code unverified delivery promises.

## Decisions retained

- Basic and conservative custom shipping tiers remain the recorded choice;
  do not change the plan, prices or variant weights as routine setup.
- Etsy stays live until Ryan decides to retire it. Favorites, a separate gift
  feature, storefront product search and Shopify conversion analytics were
  deferred/dropped; they are not unfinished launch blockers.
- Display currency estimates do not change USD cart/checkout amounts.
- Custom reviews replaced Judge.me on November 20; legacy reviews were not
  imported and no provider rollback remains.

Earlier item-by-item implementation logs and audit snapshots remain in Git.
Current procedures belong in the focused guides rather than duplicate logs.
