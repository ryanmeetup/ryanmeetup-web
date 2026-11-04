# Store launch roadmap

What `store.ryanmeetup.com` still needs before it can take real orders and stand
in for the Etsy shop (`ryanmeetup.etsy.com`). Work through it one item at a time.
When an item is finished, delete its row and section and add a line to the
[Log](#log). Item numbers are kept stable rather than renumbered, so a gap means
an item is done.

The baseline is "do just about everything the Etsy storefront can do". The Etsy
comparison is against Etsy's standard shop features; the live shop could not be
read automatically (Etsy returns 403), so confirm items marked **check Etsy**
against the real listings.

Last reviewed: 2026-11-04.

## Already in place

- Catalog, collection, and type pages; listings with Style, color, and size
  selection (see the [README](../README.md)).
- Type and size filters on collection pages.
- Cart drawer and cart page backed by the Shopify cart API, refreshed from
  Shopify on load, cleared after checkout, and emptied on confirmation.
- Shopify hosted checkout and a thank-you page.
- Judge.me product reviews, read and submitted server-side.
- About (including shipping and returns), Contact, and the sitemap.
- Policy pages at `/policies/<handle>` for each policy written in Shopify Admin,
  linked from the footer and listed in the sitemap.
- **Your orders** links to Shopify's customer account (order status and
  tracking) in the header, mobile menu, thank-you page, and Contact hints.
- Sale prices: a compare-at price above the price in Shopify adds a **Sale**
  label and the struck-through original on cards, the product page, and cart
  lines.
- Product search at `/search?q=` from the header (or the mobile menu), matching
  titles, product types, and Style names as the shopper types.

## Status

| # | Item | Priority | Status |
| --- | --- | --- | --- |
| 4 | [Launch switches and Shopify Admin setup](#4-launch-switches-and-shopify-admin-setup) | Blocker | Not started |
| 7 | [Sorting](#7-sorting) | Etsy parity | Not started |
| 8 | [Note to seller and personalization](#8-note-to-seller-and-personalization) | Etsy parity | Not started |
| 9 | [Shipping cost and delivery estimates before checkout](#9-shipping-cost-and-delivery-estimates-before-checkout) | Etsy parity | Not started |
| 10 | [Favorites](#10-favorites) | Etsy parity | Not started |
| 11 | [More from this shop](#11-more-from-this-shop) | Etsy parity | Not started |
| 12 | [Gift options](#12-gift-options) | Etsy parity | Not started |
| 13 | [Local currency](#13-local-currency) | Etsy parity | Not started |
| 14 | [Shop-wide reviews and buyer-only reviews](#14-shop-wide-reviews-and-buyer-only-reviews) | Polish | Not started |
| 15 | [Catalog revalidation webhook](#15-catalog-revalidation-webhook) | Polish | Not started |
| 16 | [Cookie consent and Shopify analytics](#16-cookie-consent-and-shopify-analytics) | Polish | Not started |

Status values: Not started, In progress, Dropped (with reason). Finished items
leave the roadmap.

## Blockers

### 4. Launch switches and Shopify Admin setup

- [ ] Done

Code:
- [ ] Remove the beta banner in [app/layout.tsx](../app/layout.tsx).
- [ ] Remove the site-wide `robots: { index: false, follow: false }` in the same
      file (keep it on `/cart` and `/thank-you`).

Shopify Admin and environment (no code):
- [ ] Production `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_STOREFRONT_API_TOKEN` set in
      Vercel.
- [ ] Payments activated and a test order refunded end to end.
- [ ] Tax collection configured for the regions shipped to.
- [ ] Shipping rates match Printful's for every region on the About page.
- [ ] Every published variant mapped to a Printful SKU.
- [ ] Checkout return URL set to `https://store.ryanmeetup.com/thank-you`.
- [ ] Checkout branding customized.
- [ ] Refund policy, shipping policy, and terms of service written in Settings →
      Policies. Only the privacy policy exists today; each one appears on the
      site as soon as it has text.
- [ ] Privacy policy rewritten to match what the store actually does (no ads,
      no data sales, Vercel Analytics, the services that receive data). The
      Shopify template it replaces describes accounts, wishlists, ad partners,
      and SMS marketing the store doesn't have.
- [x] Customer accounts turned on (Settings → Customer accounts).
- [ ] Privacy policy covers customer accounts once they're on.
- [ ] `JUDGEME_PRIVATE_API_TOKEN` set in Production and Preview.
- [ ] Etsy listings retired or redirected, and `ryanmeetup.com/merch` (currently
      pointing at Etsy in `apps/ryanmeetup`) switched to the store.

**Done when.** A real order placed on production is charged, taxed, shipped by
Printful, and confirmed by email.

## Etsy parity

### 7. Sorting

- [ ] Done

**Problem.** Etsy offers sorting by most recent and by price; the store's order is
fixed.

**Approach.** A `DropdownSelect variant="compact"` next to the existing filters in
[components/collection-grid.tsx](../components/collection-grid.tsx), with a
readable `?sort=` (`featured`, `newest`, `price-low`, `price-high`). Sort listings
by their minimum price.

**Done when.** Each collection and type page sorts, and the choice survives reload.

### 8. Note to seller and personalization

- [ ] Done — **check Etsy** for which listings take personalization.

**Problem.** Etsy has a cart "note to seller" and per-listing personalization
fields. The store supports neither.

**Approach.**
- Cart note: a text area in the cart page and drawer saved with
  `cartNoteUpdate`.
- Personalization: line `attributes` on `cartLinesAdd`, driven by a Shopify
  metafield or tag on the products that accept it (no handle checks in code).
  Mark the field required when the product needs it. Confirm the attributes reach
  Printful or the order, and decide how they are fulfilled.

**Done when.** A note and any personalization show on the Shopify order.

### 9. Shipping cost and delivery estimates before checkout

- [ ] Done

**Problem.** Etsy shows shipping cost and an estimated arrival on each listing.
The store says only "calculated at checkout".

**Approach.** Show a short shipping and processing summary on the product page
(sourced from the Shopify shipping policy or a metafield rather than
hard-coded claims), and, if wanted, a free-shipping threshold in the cart.

**Done when.** A shopper can see roughly what shipping costs and how long it takes
before checkout.

### 10. Favorites

- [ ] Done

**Problem.** Etsy shoppers can favorite items.

**Approach.** Start with a per-browser favorites list (`localStorage`, wrapped in
try/catch) with a heart button on cards and product pages and a `/favorites` page.
Move it to customer accounts once they're on if wanted, and add that to the
privacy policy when it happens.

**Done when.** Favorites persist across visits in the same browser.

### 11. More from this shop

- [ ] Done

**Problem.** Product pages don't suggest other products.

**Approach.** A section below the product details using Shopify's
`productRecommendations`, falling back to the product's collection, with listings
grouped so a listing appears once.

**Done when.** Every product page suggests other listings.

### 12. Gift options

- [ ] Done — **check Etsy** for whether gift options are used.

**Problem.** Etsy has "this order is a gift" with a message.

**Approach.** A gift checkbox and message in the cart, saved as cart attributes
(reuse item 8's plumbing). Confirm Printful can omit prices from the packing slip.

**Done when.** Gift orders carry the message on the Shopify order.

### 13. Local currency

- [ ] Done

**Problem.** The store ships to most of the world but shows only USD.

**Approach.** Enable Shopify Markets, then pass `@inContext(country:)` on catalog
and cart queries, chosen from the request's country header with a manual
selector. Mind the five-minute ISR cache: cache per country or price on the
client.

**Done when.** A visitor outside the US sees prices in their currency, matching
checkout.

## Polish

### 14. Shop-wide reviews and buyer-only reviews

- [ ] Done

**Problem.** Etsy shows a shop rating and only buyers can review. Here reviews are
per product and anyone can submit.

**Approach.** Show the overall Judge.me rating on the home and About pages. Use
Judge.me's verified-buyer settings, or its review request emails, to limit
submissions.

### 15. Catalog revalidation webhook

- [ ] Done

**Problem.** Sold-out and catalog changes take up to five minutes to appear.

**Approach.** A route that verifies Shopify's webhook HMAC and calls
`revalidateTag("shopify-catalog")` on product, inventory, and collection updates.

### 16. Cookie consent and Shopify analytics

- [ ] Done

**Problem.** Shopify's conversion analytics for headless stores need its Customer
Privacy API, and EU and UK visitors need consent before tracking cookies.

**Approach.** Decide whether Shopify analytics is wanted beyond Vercel Analytics.
If so, add a consent banner wired to the Customer Privacy API.

## Log

Record each finished or changed item here, newest first.

| Date | Item | Change | Commit |
| --- | --- | --- | --- |
| 2026-11-04 | 6 | `/search` filters the grouped catalog in the browser with the shared `useSearchFilter`, `SearchInput`, and `PendingResults`, matching titles, product types, and Style names, with a shareable `?q=`. The catalog is small and already cached for Shop all, so this skips Shopify's `search` API. A header search button (from `sm`) and a mobile menu entry lead there; to make room, **Your orders** moves into the menu below `md` and the **Cart** label drops between `xl` and `3xl`. | — |
| 2026-11-04 | 5 | Variants read `compareAtPrice`; a value above the price shows a **Sale** label and the struck-through original on cards (beside the lowest price), the product page, and cart lines. Sale state is worked out from the variants, so grouped listings need no `compareAtPriceRange`. The demo cap is marked down to show it in preview mode. | `5cf0ce46` |
| 2026-11-04 | 3 | Customer accounts are on, but the Storefront API still returns a null `customerAccountUrl`, so the link falls back to `https://shopify.com/<shop id>/account` (the URL Shopify Admin shows). | — |
| 2026-11-04 | 3 | **Your orders** links to Shopify's customer account from the header, mobile menu, thank-you page, and Contact, driven by `shop.customerAccountUrl` so nothing appears until accounts are on. Turning accounts on and covering them in the privacy policy moved to item 4. Policy pages also gained Shopify's terms of sale, legal notice, and contact information. | `4133f799` |
| 2026-11-03 | 2 | Policies written in Shopify Admin render at `/policies/<handle>`, appear in a footer Policies column (`RyanMeetupFooter` now takes `sections`), and are in the sitemap. Writing the missing refund, shipping, and terms policies moved to item 4. | `ee346e84` |
| 2026-11-03 | 1 | Cart refreshes from Shopify on load and Back, starts fresh when a checked-out or expired cart rejects a change, clears on `/thank-you`, and has a confirmed **Empty cart** action on the cart page and drawer. | `27147be6` |
| 2026-11-03 | — | Roadmap created. | — |
