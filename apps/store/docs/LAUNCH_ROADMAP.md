# Store launch roadmap

What `store.ryanmeetup.com` still needs before it can take real orders and stand
in for the Etsy shop (`ryanmeetup.etsy.com`). Work through it one item at a time.
When an item is finished or dropped, delete its row and section and add a line
to the [Log](#log). Item numbers are kept stable rather than renumbered, so a gap
means an item is done or dropped.

The baseline is "do what the Etsy storefront does that shoppers actually rely
on", not every Etsy feature. The live shop could not be read automatically (Etsy
returns 403), so confirm items marked **check Etsy** against the real listings.

Last reviewed: 2026-11-04, against the code and the live Storefront API.

## Already in place

- Catalog, collection, and type pages; listings with Style, color, and size
  selection (see the [README](../README.md)).
- Type and size filters, plus sorting (Featured, Newest, price low to high,
  price high to low) in a readable `?sort=`, on every collection and type page.
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
- A currency menu on product price badges shows prices in USD (the default),
  EUR, GBP, CAD, or AUD. Converted prices are estimates from reference exchange rates;
  cart and checkout prices stay in USD.
- Designer credits on product pages from `designer:` product tags (see
  [ADDING_PRODUCTS.md](ADDING_PRODUCTS.md#designer-credits)).

## Status

| # | Item | Priority | Status |
| --- | --- | --- | --- |
| 2026-11-04 | 4 | Refund, shipping, terms, and contact information policies written in Shopify, and the privacy policy updated for customer accounts and the no-returns rule. About's fine print now says all sales are final and links the shipping and refund policies when they exist; the cart page and drawer repeat "All sales are final" with a return policy link; the contact form's return topics became refund wording; and policy pages make store links relative. | — |
| 4 | [Launch switches and Shopify Admin setup](#4-launch-switches-and-shopify-admin-setup) | Blocker | In progress |
| 9 | [Shipping cost and delivery estimates before checkout](#9-shipping-cost-and-delivery-estimates-before-checkout) | Etsy parity | Not started |
| 11 | [More from this shop](#11-more-from-this-shop) | Etsy parity | Not started |
| 8 | [Note to seller and personalization](#8-note-to-seller-and-personalization) | Etsy parity | Not started |
| 15 | [Catalog revalidation webhook](#15-catalog-revalidation-webhook) | Polish | Not started |
| 14 | [Shop-wide reviews and buyer-only reviews](#14-shop-wide-reviews-and-buyer-only-reviews) | Polish | Not started |

Rows are in suggested working order. Status values: Not started, In progress.
Finished and dropped items leave the roadmap.

## Blockers

### 4. Launch switches and Shopify Admin setup

- [ ] Done

Code (last, once everything below is done):
- [ ] Remove the beta banner in [app/layout.tsx](../app/layout.tsx).
- [ ] Remove the site-wide `robots: { index: false, follow: false }` in the same
      file (keep it on `/cart` and `/thank-you`).

Shopify Admin and environment (no code):
- [ ] Production `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_STOREFRONT_API_TOKEN` set in
      Vercel.
- [ ] `JUDGEME_PRIVATE_API_TOKEN` set in Production and Preview.
- [ ] Payments activated and a test order refunded end to end.
- [ ] Markets cover every country the About page says we ship to. The
      Storefront API currently reports only the United States, and shoppers
      can't check out to a country outside an active market.
- [ ] Tax collection configured for the regions shipped to.
- [ ] Shipping rates match Printful's for every region shipped to.
- [ ] Every published variant mapped to a Printful SKU.
- [ ] Checkout return URL set to `https://store.ryanmeetup.com/thank-you`.
- [ ] Theme redirect pasted into `layout/theme.liquid` and
      `layout/password.liquid`, so the Shopify theme sends shoppers here
      ([snippet](SHOPIFY_HOSTED_PAGES.md#1-redirect-the-theme-to-the-store)).
- [ ] Email templates branded and their store links pointed at
      `https://store.ryanmeetup.com`
      ([steps](SHOPIFY_HOSTED_PAGES.md#2-point-the-emails-at-the-store)).

**Done when.** A real order placed on production is charged, taxed, shipped by
Printful, and confirmed by email.

## Etsy parity

### 9. Shipping cost and delivery estimates before checkout

- [ ] Done

**Problem.** Etsy shows shipping cost and an estimated arrival on each listing.
The store says only "calculated at checkout", and the product page no longer
mentions production time at all.

**Approach.** Show a short shipping and processing summary on the product page
(sourced from the Shopify shipping policy or a metafield rather than
hard-coded claims), and, if wanted, a free-shipping threshold in the cart. Do
it after the shipping policy in item 4 exists, so there is one source to quote.

**Done when.** A shopper can see roughly what shipping costs and how long it takes
before checkout.

### 11. More from this shop

- [ ] Done

**Problem.** Product pages don't suggest other products, so a shopper who lands
on one from a link has nowhere obvious to go next.

**Approach.** A section below the product details using Shopify's
`productRecommendations`, falling back to the product's collection, with listings
grouped so a listing appears once. Reuse the existing product card and grid.

**Done when.** Every product page suggests other listings.

### 8. Note to seller and personalization

- [ ] Done — **check Etsy** for which listings take personalization. No product
      in Shopify is set up for it today.

**Problem.** Etsy has a cart "note to seller" and per-listing personalization
fields. The store supports neither.

**Approach.**
- Cart note: a text area in the cart page and drawer saved with
  `cartNoteUpdate`. A shopper can use it for a gift message too.
- Personalization, only if a listing needs it: line `attributes` on
  `cartLinesAdd`, driven by a Shopify metafield or tag on the products that
  accept it (no handle checks in code). Mark the field required when the product
  needs it. Confirm the attributes reach Printful or the order, and decide how
  they are fulfilled.

**Done when.** A note, and any personalization, show on the Shopify order.

## Polish

### 15. Catalog revalidation webhook

- [ ] Done

**Problem.** Catalog, price, and availability changes take up to five minutes to
appear, which [ADDING_PRODUCTS.md](ADDING_PRODUCTS.md) has to warn about.

**Approach.** A route that verifies Shopify's webhook HMAC and calls
`revalidateTag("shopify-catalog")` on product, inventory, and collection updates.

### 14. Shop-wide reviews and buyer-only reviews

- [ ] Done

**Problem.** Etsy shows a shop rating and only buyers can review. Here reviews are
per product and anyone can submit.

**Approach.** Show the overall Judge.me rating on the home and About pages. Use
Judge.me's verified-buyer settings, or its review request emails, to limit
submissions.

## Log

Record each finished or changed item here, newest first.

| Date | Item | Change | Commit |
| --- | --- | --- | --- |
| 2026-11-04 | 13 | Added a currency button to product price badges: USD → EUR → GBP → CAD → AUD. The preference persists across pages and reloads. Cached Frankfurter reference rates supply approximate display conversions; Shopify cart and checkout amounts remain in USD. Local-currency checkout through Markets remains deferred. | — |
| 2026-11-04 | 4 | Etsy stays live alongside the store for now: `ryanmeetup.com/merch`, the main site's **Merch** link, and the Etsy listings are no longer launch work. Switch them when Ryan decides to retire Etsy. | — |
| 2026-11-04 | — | Audited against the code and the live Storefront API. Item 4 gained the Markets check (only the US is active), the `apps/ryanmeetup` Etsy links, and the privacy policy's returns wording; the privacy and customer-accounts lines that were done left. Remaining items reordered by suggested working order. | — |
| 2026-11-04 | 16 | Dropped cookie consent and Shopify analytics. Vercel Analytics is cookieless and covers traffic; Shopify Admin already reports orders. Revisit only if ads or Shopify's conversion analytics are wanted. | — |
| 2026-11-04 | 13 | Dropped local currency. Only the US market is active, and per-country pricing would mean per-country caching for a small catalog. Revisit after launch if international orders show up. | — |
| 2026-11-04 | 12 | Dropped gift options as a separate feature; the cart note in item 8 carries a gift message. | — |
| 2026-11-04 | 10 | Dropped favorites. With about a dozen listings, a per-browser list adds little over the cart and Shop all. | — |
| 2026-11-04 | 6 | Removed product search from the header and mobile menu, along with the search page. Collections, Shop all, and the existing filters cover browsing for now; reconsider search when the catalog needs it. Shopify theme search redirects now point to Shop all in the setup snippet. | — |
| 2026-11-04 | 7 | A **Sort** control joins the collection filters with `?sort=featured`, `newest`, `price-low`, or `price-high` through the shared `useQueryParamState`, sorting within each Shop all section. Newest uses Shopify's `createdAt` (a grouped listing takes its newest design's date) because `publishedAt` was reset for every product on 2026-11-03. The filter bar now stays stacked until `lg`, where the controls go inline. | `d11fe784` |
| 2026-11-04 | 6 | `/search` filters the grouped catalog in the browser with the shared `useSearchFilter`, `SearchInput`, and `PendingResults`, matching titles, product types, and Style names, with a shareable `?q=`. The catalog is small and already cached for Shop all, so this skips Shopify's `search` API. A header search button (from `sm`) and a mobile menu entry lead there; to make room, **Your orders** moves into the menu below `md` and the **Cart** label drops between `xl` and `3xl`. | `52791f57` |
| 2026-11-04 | 5 | Variants read `compareAtPrice`; a value above the price shows a **Sale** label and the struck-through original on cards (beside the lowest price), the product page, and cart lines. Sale state is worked out from the variants, so grouped listings need no `compareAtPriceRange`. The demo cap is marked down to show it in preview mode. | `5cf0ce46` |
| 2026-11-04 | 3 | Customer accounts are on, but the Storefront API still returns a null `customerAccountUrl`, so the link falls back to `https://shopify.com/<shop id>/account` (the URL Shopify Admin shows). | — |
| 2026-11-04 | 3 | **Your orders** links to Shopify's customer account from the header, mobile menu, thank-you page, and Contact, driven by `shop.customerAccountUrl` so nothing appears until accounts are on. Turning accounts on and covering them in the privacy policy moved to item 4. Policy pages also gained Shopify's terms of sale, legal notice, and contact information. | `4133f799` |
| 2026-11-03 | 2 | Policies written in Shopify Admin render at `/policies/<handle>`, appear in a footer Policies column (`RyanMeetupFooter` now takes `sections`), and are in the sitemap. Writing the missing refund, shipping, and terms policies moved to item 4. | `ee346e84` |
| 2026-11-03 | 1 | Cart refreshes from Shopify on load and Back, starts fresh when a checked-out or expired cart rejects a change, clears on `/thank-you`, and has a confirmed **Empty cart** action on the cart page and drawer. | `27147be6` |
| 2026-11-03 | — | Roadmap created. | — |
