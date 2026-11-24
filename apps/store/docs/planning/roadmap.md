# Store readiness and remaining work

Reviewed November 24, 2026 against the repository, the live storefront and the
prior dated operating records. The store launched publicly and accepts orders; this is a remaining-work list, not
an assertion that checkout is still waiting to launch. Etsy stays alongside it
until Ryan chooses otherwise.

Shopify/Printful Admin results below are Ryan's dated confirmations; the
repository audit itself did not log into either Admin or exercise a real buyer
login. Items still needing those checks stay explicit rather than inheriting an
old "not started" or "done" label.

## Already implemented

- Shopify catalog, theme collections, category-driven Apparel/Accessories,
  grouped listings, style/color/size selection, curated/fallback home features,
  designer credits, sales, sorting and display-only currency conversion.
- Cart drawer/page using Shopify cart IDs and `checkoutUrl`; expired/checked-out
  carts recover on the next load. Shopify hosts payment, confirmation, order
  status and customer accounts.
- Signed catalog webhooks with five-minute cache freshness as a fallback;
  About, support, policy pages, sitemap and branded error pages.
- Product purchase guidance (November 23): deliberate size selection,
  Shopify-authored size-guide dialogs, final-sale notice before Add to cart,
  and production guidance sourced from the maintained shipping policy.
- Product review previews (November 23): four initial cards, with the full
  paginated list available through See all reviews, filters and permalinks.
- Processing and delivery summary (November 23, formerly item 9): product
  pages show the shipping policy's Production time and checkout's country count
  before Add to cart, and the home page's shipping strip states the production
  range, checkout's country count and email tracking, all sourced from the
  policy and Markets with no invented delivery dates. Shipping quotes stay in
  hosted checkout.
- Shorter mobile home (November 23): the running sale appears once, the hero
  uses tighter spacing and a landscape photo frame, and the support card keeps
  its headline and About link before Best Sellers.
- Simpler Name Tag gallery (November 23): style-chosen listings show only the
  selected style's photos, and cards show each fabric color once with the style
  count stated separately.
- "More from this shop" on product pages (November 21): purchasable listings
  from Shopify's `productRecommendations` (intent `RELATED`), then shared
  collections, then the same product type; grouped designs collapse into one
  listing and never recommend their own listing, with a browse fallback.
- Lighter, cached storefront (November 24): product cards receive only the
  fields they read and share one image object per photo, cutting live-catalog
  pages by about 35–40% (`/apparel` 141 → 89 KB gzipped). Public review reads
  that pages render are cached for a minute, so the home page is served from
  the CDN again; Tasks moderation reaches it within that minute (see
  [moderation](../reference/review-moderation.md#when-decisions-reach-the-storefront)).
  Product pages stay per-request because they check the visitor's review
  sign-in and render the `?color=` choice on the server.
- Offer-level structured data (November 24): every product offer states the
  no-returns policy for checkout's countries. Shipping is not marked up, since
  rates come from checkout's weight tiers; see item 15.
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
  edits; sign-in starts limited to 30 an hour per network.
- Daily review cleanup (November 21): a Store cron deletes expired sign-in,
  budget and photo-draft rows and unreferenced photos, and removes orphaned
  photo objects, retrying failed deletion removals. See
  [operations](../how-to/review-operations.md#daily-cleanup).
- Photo processing/staging/associations and buyer controls, separately gated;
  owner previews and per-photo approval/rejection with reasons shown to the
  buyer in Tasks; approving a review approves its undecided photos;
  approved-only public images with revocation on hide/withdraw/replacement/deletion. Attachments are
  enabled by default for signed-in reviews, with an explicit collection pause.
  Recovery and hosted proof remain open.

Operating evidence: paid international order #1004 (Canada) delivered with
working emails and account links; 28-country market, checkout quotes, shipping
policy and branded notifications confirmed November 21. Details are in
[shipping setup](../how-to/shipping-setup.md) and Git history.

## Remaining work

Item numbers remain stable for existing references.

| # | Work | Current evidence / next action |
| --- | --- | --- |
| 4 | [Shopify/Printful operating setup](#4-shopify-and-printful-operating-setup) | NY sales tax (registration pending), accountant questions and January rate cleanup. |
| 8 | [Note to seller and personalization](#8-note-to-seller-and-personalization) | Order note built (November 24); confirm it on the first real order, and which personalization is actually needed. |
| 14 | [Store reviews](#14-store-reviews) | Live reviews verified working (November 24) and `CRON_SECRET` set; edge-case orders, recovery drills, monitoring and retention remain. |
| 15 | [Search and shopping discovery](#15-search-and-shopping-discovery) | Sitemap and structured data are live; submit them to Search Console and decide on free Shopping listings. |
| 16 | [Checkout email recovery](#16-checkout-email-recovery) | No storefront email capture; confirm abandoned-checkout emails and decide on checkout marketing consent. |
| 17 | [Black RYDay wind-down](#17-black-ryday-wind-down) | Due after the sale ends November 30, 2026 (ET). |
| 18 | [Listing highlight webhooks](#18-listing-highlight-webhooks) | Code, table, backfill and both order webhooks live (November 24); confirm one live order is recorded. |

### 4. Shopify and Printful operating setup

- [ ] Complete the product business-contact information using a public business
      mailing address. On November 23 the 89-product audit found 24 descriptions
      with fictitious company/address placeholders; those were removed in Shopify
      while retaining SINDEN VENTURES LIMITED's EU responsible-person contact,
      product warnings and size tables. Ryan does not authorize publishing his
      apartment address. This copy cleanup does not complete Printful's requested
      seller contact information; see [Printful's GPSR guidance](https://help.printful.com/hc/en-us/articles/50262212333329-What-is-the-General-Product-Safety-Regulation-for-the-EU).
- [ ] Turn on New York sales tax once the Certificate of Authority arrives.
      The store belongs to Ryan Meetup Incorporated (a New York not-for-profit
      corporation without IRS exemption); its application, tied to the
      corporation's EIN, was submitted November 21. Then: enter the ID under
      Settings → Taxes and duties → United States → New York; quote a hoodie
      and a mug to a New York address (clothing under $110 an item is exempt
      from the 4% state rate and fully in NYC; other products are taxed); give
      Printful a NY resale certificate (ST-120) so it stops charging tax on
      resold goods. See [sales tax](../how-to/sales-tax.md).
- [ ] Ask an accountant how to report the New York orders shipped before
      registration, and whether UK VAT applies to orders of £135 or less.
      International buyers otherwise pay import charges on delivery, as the
      shipping policy says.
- [ ] Remove the custom-rate $0.40 holiday allowance after January 17, 2027,
      following a fresh rate check. Printful documents the surcharge through
      that date; custom rates do not update themselves.

The Catalog Admin app's Admin API access covers products, publications,
Markets and shipping profiles, plus read-only orders. Policies, notifications
and taxes are configured by hand in Admin; do not treat speculative scope grants as a storefront feature or
change credentials as documentation cleanup.

**Complete when:** New York collection is on and verified and the accountant
questions are answered. Current product/SKU counts are catalog data, not a
permanent completion criterion.

### 8. Note to seller and personalization

Since November 24 the cart drawer and cart page share a "Note for Ryan" field
(500 characters) saved to Shopify's cart note with `cartNoteUpdate`; checkout
waits for a note still saving. Its copy promises only that Ryan sees it with
the order, not that it reaches the package. The product form still has no
personalization input. Confirm the Etsy listings that need personalization
before adding it.

- [ ] On the first real order with a note, confirm it appears on the Shopify
      order, and record whether Printful receives it (for example on a packing slip)
      before any copy calls it a gift message.
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

Ryan verified reviews working live on November 24, 2026: sign-in and return,
submission, moderation and public display. The items below are what that pass
did not cover.

- [ ] Establish a supported isolated HTTPS buyer/owner target. The Store accepts
      RMT or nonproduction loopback, while Tasks moderation expects a pinned
      HTTPS project origin. Do not use production RMT or PRD as a Preview test.
- [ ] Verify owned/foreign orders, normal/split fulfillment, partial payment,
      cancellation, edits, refunds before/after receipt, deleted products,
      nullable variants and bounded order histories. Record Printful delivery
      evidence before using it to time review requests.
- [ ] Prove separate database/object restore and collection pause/resume with
      in-flight-write reconciliation, using the
      [recovery procedure](../how-to/review-operations.md#recovery-within-the-custom-system).

#### Implementation required for media and operations

- [ ] Define retention, customer export/removal and deletion-audit/private-note
      handling. Withdrawal is not erasure; SQL backups exclude Storage bytes.
- [ ] Add hosted logs/retention, availability/latency signals, alert thresholds,
      an observation window and response ownership. Cover auth, Shopify reads,
      text writes, moderation and standalone media in addition to current
      sanitized backend failures.
- [ ] Confirm hosted photo collection settings and record cleanup and recovery
      evidence. `CRON_SECRET` was set in the Store's Vercel production
      environment on November 24, 2026; confirm the first scheduled run (08:41 UTC)
      succeeds.

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

**Complete when:** the selected text/media scope has live lifecycle and recovery
proof. A photo requirement is not met merely by private uploads or text approval.
Judge.me cannot be used as a recovery provider; see [operations](../how-to/review-operations.md).

### 15. Search and shopping discovery

The sitemap lists every indexable page and product pages carry `ProductGroup`
data with per-offer return policies (see [metadata](../reference/metadata.md#structured-data)).

- [ ] Add `store.ryanmeetup.com` to Google Search Console and submit
      `https://store.ryanmeetup.com/sitemap.xml`.
- [ ] Enter shipping (and the no-returns policy) in Search Console's shipping
      and returns settings. Google uses these ahead of page markup, and they are
      the only place shipping costs are stated, because the markup omits rates
      that only checkout quotes.
- [ ] Decide whether to add Shopify's Google & YouTube channel for free Shopping
      listings. Before relying on it, confirm Merchant Center accepts product
      links that land on `checkout.ryanmeetup.com/products/…` and redirect here
      by script, with `noindex`; see [hosted pages](../how-to/shopify-hosted-pages.md).

**Complete when:** the sitemap is processed without errors, the Rich Results
Test passes for a deployed product, and the Shopping-channel decision is recorded.

### 16. Checkout email recovery

The storefront collects no email addresses. The RyanMeetup.com newsletter covers
events and general news and stays separate.

- [ ] Confirm abandoned-checkout emails are on in Shopify Admin (Marketing
      automations or Settings → Notifications), branded like the other notifications.
- [ ] Decide whether checkout shows Shopify's "email me with news and offers"
      checkbox. It collects only buyers who opt in, kept in Shopify.

**Complete when:** both settings are confirmed and recorded here.

### 17. Black RYDay wind-down

After the sale ends at 11:59 p.m. ET on Monday, November 30, 2026:

- [ ] Remove the three Black RYDay automatic discounts in Shopify Admin.
- [ ] Set `currentPromotion` to `null` in `lib/promotion.ts`; the storefront
      already stops advertising the sale at its end time.
- [ ] Decide on the launch bug banner (`<BugReportBanner />` in the root
      layout). It is hidden while a sale runs and reappears on December 1 with
      "Ryan-tested, not yet Ryan-proofed" and a promise of a discount code for
      reports. Keep it, rewrite it, or retire it; the footer's Report a bug link stays either way.

**Complete when:** the discounts are gone, the promotion is null, and the
banner decision is deployed.

### 18. Listing highlight webhooks

[Listing highlights](../reference/listing-highlights.md) count sales from Shopify
order webhooks. Orders through November 24, 2026 were backfilled into RMT.

- [x] In Shopify Admin → **Settings → Notifications → Webhooks**, add **Order
      creation** and **Order cancellation** (JSON, latest API version) pointing at
      `https://store.ryanmeetup.com/api/webhooks/shopify`, the same URL as the
      catalog webhooks, so they share `SHOPIFY_WEBHOOK_SECRET`. Added November 24, 2026.
- [ ] Place or confirm a real order and check that a `sale` row appears in
      `store_product_activity`.

**Complete when:** both subscriptions exist and one live order has been recorded.

## Decisions retained

- Basic and conservative custom shipping tiers remain the recorded choice;
  do not change the plan, prices or variant weights as routine setup.
- Etsy stays live until Ryan decides to retire it. Favorites, a separate gift
  feature and storefront product search were deferred/dropped; they are not
  unfinished launch blockers. Vercel Web Analytics with custom shopping
  events went live on November 21; purchases and revenue still come from
  Shopify (see [the analytics guide](../reference/analytics.md)).
- Display currency estimates do not change USD cart amounts. On November 21
  Ryan chose local-currency checkout for the International market (Norway
  currently checks out in USD); storefront labels say the final price is shown
  at checkout rather than promising USD.
- Custom reviews replaced Judge.me on November 20; Judge.me's reviews were not
  imported and no provider rollback remains. Etsy shop reviews are imported
  separately as "Verified Etsy purchase" reviews; see
  [the database guide](../reference/review-database.md#imported-etsy-reviews).

Earlier item-by-item implementation logs and audit snapshots remain in Git.
Current procedures belong in the focused guides rather than duplicate logs.
