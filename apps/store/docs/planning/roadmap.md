# Store remaining work

Only what is still open. Finished work is deleted rather than ticked; what the
store does today is described in the [references](../README.md#technical-references),
and its history is in Git. Item numbers stay stable for existing links.

| # | Work | Next action |
| --- | --- | --- |
| 4 | [Shopify/Printful operating setup](#4-shopify-and-printful-operating-setup) | Printful certificate approval, accountant questions, product contact details, January rate cleanup. |
| 8 | [Note to seller and personalization](#8-note-to-seller-and-personalization) | Confirm a note on the first real order; decide which personalization is needed. |
| 14 | [Store reviews](#14-store-reviews) | Edge-case orders, recovery drills, monitoring and retention. |
| 15 | [Search and shopping discovery](#15-search-and-shopping-discovery) | Submit to Search Console; decide on free Shopping listings. |
| 16 | [Checkout marketing consent](#16-checkout-marketing-consent) | Decide on Shopify's "email me with news" checkbox. |
| 17 | [Black RYDay wind-down](#17-black-ryday-wind-down) | After the sale ends November 30, 2026 (ET). |
| 18 | [Listing highlight sales](#18-listing-highlight-sales) | Confirm a real order is recorded. |

### 4. Shopify and Printful operating setup

- [ ] Add a public business mailing address as the product business contact.
      Ryan does not authorize publishing his apartment address. Removing the
      placeholder text from descriptions did not complete Printful's seller
      contact request; see [Printful's GPSR guidance](https://help.printful.com/hc/en-us/articles/50262212333329-What-is-the-General-Product-Safety-Regulation-for-the-EU).
- [ ] Confirm Printful approves the NY resale certificate (about two business
      days), then that a New York checkout quote taxes a mug but not a hoodie.
      See [sales tax](../how-to/sales-tax.md).
- [ ] Ask an accountant how to report the New York orders shipped before
      registration, and whether UK VAT applies to orders of £135 or less.
- [ ] Remove the custom-rate $0.40 holiday allowance after January 17, 2027,
      following a fresh rate check. Custom rates do not update themselves.

### 8. Note to seller and personalization

- [ ] On the first real order with a note, confirm it appears on the Shopify
      order (the cart side is verified), and record whether Printful receives it
      before any copy calls it a gift message.
- [ ] Confirm which Etsy listings need personalization. For those, model it
      through product configuration and cart line attributes with required
      fields, and verify it reaches the order and fulfillment.

### 14. Store reviews

Live reviews are verified. The [reviews reference](../reference/reviews.md)
describes them and [operations](../how-to/review-operations.md) owns the
rehearsal and recovery procedures.

- [ ] Confirm the first scheduled cleanup run (08:41 UTC, November 25) succeeds
      in Vercel → store → Cron Jobs.
- [ ] Verify owned/foreign orders, split fulfillment, partial payment,
      cancellation, edits, nullable variants and long order histories. Record
      Printful delivery evidence before using it to time review requests.
- [ ] Establish an isolated HTTPS buyer/owner test target. Never use production
      RMT or PRD as a Preview test.
- [ ] Prove separate database/object restore and collection pause/resume using
      the [recovery procedure](../how-to/review-operations.md#recovery-within-the-custom-system).
- [ ] Define retention, customer export/removal and deletion-audit handling.
      Withdrawal is not erasure; SQL backups exclude Storage bytes.
- [ ] Add hosted logs, availability/latency signals, alert thresholds and
      response ownership across auth, Shopify reads, writes, moderation and media.
- [ ] Confirm hosted photo collection settings.

Only if needed:

- Fulfillment-child pagination if real orders exceed fifty children.
- A distributed refresh claim if token rotation needs serializing across workers.
- Review request emails (need delivery evidence, timing, rechecks, opt-outs).
- Account extensions, revocation UI, verification overrides, delegated
  moderators or audit browsing, each with its own authorization design.

### 15. Search and shopping discovery

- [ ] Add `store.ryanmeetup.com` to Google Search Console and submit
      `https://store.ryanmeetup.com/sitemap.xml`; check a product in the Rich
      Results Test.
- [ ] Enter shipping and the no-returns policy in Search Console's shipping and
      returns settings; the page markup omits rates that only checkout quotes.
- [ ] Decide on Shopify's Google & YouTube channel for free Shopping listings.
      First confirm Merchant Center accepts product links on
      `checkout.ryanmeetup.com/products/…` that redirect here by script, with
      `noindex`; see [hosted pages](../how-to/shopify-hosted-pages.md).

### 16. Checkout marketing consent

- [ ] Decide whether checkout shows Shopify's "email me with news and offers"
      checkbox. It collects only buyers who opt in, kept in Shopify. The
      RyanMeetup.com newsletter stays separate.

### 17. Black RYDay wind-down

After the sale ends at 11:59 p.m. ET on Monday, November 30, 2026:

- [ ] Remove the three Black RYDay automatic discounts in Shopify Admin.
- [ ] Set `currentPromotion` to `null` in `lib/promotion.ts`.
- [ ] Decide on the launch bug banner (`<BugReportBanner />` in the root
      layout), which reappears December 1 promising a discount code for reports:
      keep, rewrite or retire it. The footer's Report a bug link stays.

### 18. Listing highlight sales

- [ ] After the next real order, check that a `sale` row appears in
      `store_product_activity`. See [listing highlights](../reference/listing-highlights.md).

## Decisions retained

- Basic, conservative custom shipping tiers stay; don't change the plan, prices
  or variant weights as routine setup.
- Sales are final: no refunds offered, though exceptions remain possible.
- Etsy stays live until Ryan retires it. Favorites, a gift-options feature and
  storefront product search were dropped.
- Display currency estimates never change cart amounts; the International
  market checks out in local currency.
- Custom reviews replaced Judge.me (November 20) with no rollback; Etsy shop
  reviews are imported as "Verified Etsy purchase".
