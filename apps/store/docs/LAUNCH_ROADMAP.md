# Store launch roadmap

What `store.ryanmeetup.com` still needs before it can take real orders and stand
in for the Etsy shop (`ryanmeetup.etsy.com`). Work through it one item at a time.
When an item is finished or dropped, delete its row and section and add a line
to the [Log](#log). Item numbers are kept stable rather than renumbered, so a gap
means an item is done or dropped.

The baseline is "do what the Etsy storefront does that shoppers actually rely
on", not every Etsy feature. The live shop could not be read automatically (Etsy
returns 403), so confirm items marked **check Etsy** against the real listings.

Last reviewed: 2026-11-15, against the code, Vercel, the live Storefront API,
and the live checkout.

## Already in place

- Catalog, collection, and type pages; listings with Style, color, and size
  selection (see the [README](../README.md)).
- Type and size filters, plus sorting (Featured, Newest, price low to high,
  price high to low) in a readable `?sort=`, on every collection and type page.
- Cart drawer and cart page backed by the Shopify cart API, refreshed from
  Shopify on load; a checked-out cart clears on the shopper's next page load.
- Shopify hosted checkout at `checkout.ryanmeetup.com`, branded with the
  wordmark, with payments live. Shopify's Thank-you page is the order
  confirmation; its **Continue shopping** button returns to the store through
  the theme redirect.
- Customer accounts, also branded; **Your orders** links to them from the
  header, mobile menu, and Contact hints.
- Every published variant (1,878 across 86 products) is mapped to a Printful
  SKU.
- US shipping for name tag shirts and hoodies uses weight tiers that cover
  Printful's cost (see [SHIPPING_SETUP.md](SHIPPING_SETUP.md)).
- Judge.me product reviews, read server-side.
- About (including shipping and returns), Contact, and the sitemap.
- Policy pages at `/policies/<handle>` for each policy written in Shopify Admin,
  linked from the footer and listed in the sitemap.
- Sale prices: a compare-at price above the price in Shopify adds a **Sale**
  label and the struck-through original on cards, the product page, and cart
  lines.
- A currency menu on product price badges shows estimated prices in USD (the
  default), EUR, GBP, CAD, or AUD; cart and checkout stay in USD.
- Designer credits on product pages from `designer:` product tags (see
  [ADDING_PRODUCTS.md](ADDING_PRODUCTS.md#designer-credits)).
- Cancelling and refunding an order is documented in
  [CANCELLING_ORDERS.md](CANCELLING_ORDERS.md).

## Status

| # | Item | Priority | Status |
| --- | --- | --- | --- |
| 4 | [Shopify Admin setup](#4-shopify-admin-setup) | Blocker | In progress |
| 11 | [More from this shop](#11-more-from-this-shop) | Etsy parity | Not started |
| 8 | [Note to seller and personalization](#8-note-to-seller-and-personalization) | Etsy parity | Not started |
| 14 | [Shop-wide reviews and buyer-only reviews](#14-shop-wide-reviews-and-buyer-only-reviews) | Polish | In progress |
| 9 | [Optional processing and delivery summary](#9-optional-processing-and-delivery-summary) | Polish | Not started |

Rows are in suggested working order. Status values: Not started, In progress.
Finished and dropped items leave the roadmap.

## Blockers

### 4. Shopify Admin setup

- [ ] Done

Next steps, in order:

| Step | Who | Where | Notes |
| --- | --- | --- | --- |
| Give the Admin API token the scopes below | Ryan | The catalog admin app's Admin API configuration | Every scope still returned `ACCESS_DENIED` on November 15, even `currentAppInstallation`. Save and install or update the app (or approve the new version, for a Dev Dashboard app), and make sure `SHOPIFY_PRIVATE_ACCESS_TOKEN` in `.env.local` is that app's token. |
| Turn on Markets for the countries we ship to | Claude, once scoped | Settings → Markets | Only the US is active, but the shipping policy says "most of the world". Agree the country list first, checked against [Printful's restrictions](https://help.printful.com/hc/en-us/articles/50265153665681-Which-countries-does-Printful-not-ship-to). Add each country's shipping rates before enabling it, or shoppers there get no rate or an underpriced one. Narrowing the policy instead is also an option. |
| Shipping profiles for every other product family and for international rates | Claude, once scoped | Settings → Shipping and delivery | Mugs, flags, pins, children's clothing, and the rest each need a verified profile; see [SHIPPING_SETUP.md](SHIPPING_SETUP.md). Do not change the plan, retail prices, or product weights. |
| Tax collection for every region shipped to | Ryan | Settings → Taxes and duties | Not possible through the Admin API. Check whether the second order showed a tax line. |
| Brand the email templates and point their links at the store | Ryan | Settings → Notifications | Not possible through the Admin API. [Steps](SHOPIFY_HOSTED_PAGES.md#2-point-the-emails-at-the-store). |
| Place a final real order | Ryan | Production | After the steps above. |
| Remove the $0.40 holiday allowance from the custom shipping rates | Ryan or Claude | Settings → Shipping and delivery | Due January 17, 2027, when Printful's surcharge ends. |

Admin API scopes to grant: `read_markets`, `write_markets`, `read_shipping`,
`write_shipping`, `read_products`, `read_locations`, `read_orders`,
`read_fulfillments`. Shopify may require approval for some shipping scopes; if
`write_shipping` can't be granted, apply the shipping profiles by hand. Drop
back to read-only scopes once setup is done.

**Done when.** A real order placed on production is charged the right shipping
and tax, ships through Printful, and sends a branded confirmation email linking
to the store. The second real order (November 15) was charged and is in Printful
fulfillment, but predates Markets, tax, and the email templates.

## Etsy parity

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

### 14. Shop-wide reviews and buyer-only reviews

- [ ] Done

**Problem.** Etsy shows a shop rating and only buyers can review. Here reviews are
per product and anyone can submit.

**Current state.** The provider is undecided. Judge.me is wired in, but its
cost is in question: the features a headless store needs sit on paid plans.
Until that's settled, treat the Judge.me-specific work below as provisional.
Today, configured product pages send **Write a review** to the Shopify customer
account, where Judge.me's account extensions collect reviews of fulfilled
purchases, host photos, and offer **My Reviews** for edits. The JSON
`POST /api/reviews` route still forwards unverified web reviews and returns 415
for photos (see the [README](../README.md#judgeme-setup)). Individual ratings
are whole stars, as Judge.me requires; averages show fractions.

**Provider limits that shape the approach.** Judge.me's create-review API needs
no authorization, accepts only whole 1–5 ratings, takes hosted photo URLs rather
than files, and can't mark a review verified or edit it. Hiding our route
therefore doesn't make reviews buyer-only. Judge.me's widgets for headless
storefronts need the paid Awesome plan; the account is on the free plan.

**Goal (Ryan, November 14).** Only buyers can review, and only products they
bought. Nobody else can get a review published, so spam has no way in.

**Remaining.**
- Remove `POST /api/reviews`, which lets anyone submit. It contradicts the goal.
- In Judge.me, stop publishing reviews that aren't from verified buyers.
  Judge.me's own create endpoint is public, so closing our route alone doesn't
  stop direct spam.
- Decide the provider. The free plan appears to cover the goal: account
  extensions collect from fulfilled orders, and our pages read reviews with the
  private API, which worked on the free plan on November 6. Paid plans add
  on-page widgets we don't use. Revisit only if a needed feature is paid.
- Test the account flow with fulfilled order #1002, following
  [REVIEWS_FIRST_ORDER_CHECK.md](REVIEWS_FIRST_ORDER_CHECK.md).
- Show the overall shop rating on the home and About pages.
- Compute the product summary from complete Judge.me totals. `lib/reviews.ts`
  averages at most the first 20 reviews; keep counts and JSON-LD consistent.
- Later: rating distribution, sorting, pagination, seller responses, and
  delivery-timed review requests.

**Done when.** The shop rating is visible, product summaries are accurate, and a
real buyer's review with a photo appears on the product page.

### 9. Optional processing and delivery summary

- [ ] Done

**Scope.** Ryan confirmed on November 14 that shipping costs can be calculated
and displayed entirely in Shopify's hosted checkout. No product-page or cart
shipping-rate estimator is required for launch. The current checkout button
already follows Shopify's cart `checkoutUrl`; shipping configuration in item 4
still applies to that checkout, including a custom checkout domain.

**Optional improvement.** Show a short processing and delivery summary on the
product page, sourced from the Shopify shipping policy or a metafield rather
than hard-coded claims. Keep final shipping charges in hosted checkout.

**Done when.** If pursued, a shopper can understand processing and delivery
expectations before checkout. This is optional polish rather than launch work.

## Log

Record each finished or changed item here, newest first.

| Date | Item | Change | Commit |
| --- | --- | --- | --- |
| 2026-11-17 | 17 | Done. `app/error.tsx` and `app/global-error.tsx` share a branded "Oops" name-tag page built on the shared `NotFoundCard`, which now accepts a badge, label, tag name, and button actions. **Try again** re-fetches the failed page; Shop All and store support are linked, with the error reference for support. Verified against an unreachable Shopify domain in both themes at 390 and 1280 px. | — |
| 2026-11-15 | — | Reviewed the roadmap. Item 4 is now a next-steps table led by the Admin API scopes it is blocked on; the superseded November 14 shipping audit left (the live tiers replaced it). "Already in place" now covers branded checkout and accounts, payments, SKU mapping, and the name tag shipping tiers. Added item 17 for branded error pages, and moved item 9 under Polish to match its priority. | — |
| 2026-11-15 | 4 | Ryan cancelled and refunded test order #1001, then placed a second real order that is going through Printful fulfillment. Shipping tiers for US name tag shirts and hoodies verified live (1–3 and 10 shirts, 1–2 hoodies, and a mixed cart all match Printful's cost plus $0.40). | — |
| 2026-11-15 | 4 | Removed Printful SKU mapping: all 1,878 published variants across 86 products carry a unique SKU in Printful's sync format (`<product>_<variant>`), none blank. Checkout and the customer-account sign-in page show the wordmark in the light scheme from [SHOPIFY_HOSTED_PAGES.md](SHOPIFY_HOSTED_PAGES.md#3-brand-checkout-and-customer-accounts); headings stay in Shopify's system font. | — |
| 2026-11-14 | 4 | Closed the checkout return URL. Shopify has no setting that sends shoppers to another site after payment, and Thank-you page extensions can only show a link, not redirect. Shopify's Thank-you page now serves as the confirmation, its **Continue shopping** button reaches the store home page through the theme redirect, and the store already drops a checked-out cart on the next page load. Removed the unreachable `/thank-you` page and its cart-clearing helper; the Playwright test now covers clearing on any page. | — |
| 2026-11-14 | — | Pruned `docs/`: removed the superseded Judge.me diagnostic, review handoff, setup audit, and parity checklist. Item 14 now carries the decisions, provider limits, and open work still in force. | — |
| 2026-11-14 | 4 | Ryan confirmed Basic and chose conservative weight-based tiers to avoid subsidizing shipping. Audited 88 products and 1,878 variant weights and prepared custom-profile instructions and initial US name tag family tables. Checkout rates remain unchanged because Shopify Admin write access is unavailable. | — |
| 2026-11-14 | 4 | Audited after Ryan's first successful production order. Done and removed: the store password (the Shopify domain now forwards to `checkout.ryanmeetup.com` instead of `/password`), payments, the theme redirect (theme pages refresh to the matching store.ryanmeetup.com page; `password.liquid` no longer matters with the password off), and the Shopify and Judge.me tokens in Vercel Production and Preview. Also removed the code launch switches and EmailJS setup, which were already ticked. Still open: Markets (the Storefront API lists only the US), the return URL (the order did not land on `/thank-you`), refund, tax, shipping rates, SKU mapping, and emails. | — |
| 2026-11-14 | 9 | Clarified that shipping quotes may appear only in Shopify's hosted checkout. Removed the storefront rate estimator from launch scope; a processing/delivery summary remains optional polish. Shopify Markets and checkout shipping configuration remain in item 4. | — |
| 2026-11-14 | 4 | Audited shipping with six temporary carts. US shirt/hoodie single-item quotes match Printful's published base rates; two shirts undercharge additional-item shipping, the current $0.40 US surcharge is absent, and Canada/UK addresses have no delivery groups. Recorded the remaining settings checks above; all carts were emptied without ordering. | — |
| 2026-11-14 | 4 | Checkout preflight preserved the selected White/M Name Tag Shirt and its $30 subtotal in Shopify's cart. Checkout then redirected to the Shopify password page. Simulated payment, order emails, and refunds remain untested; payment test mode and Printful manual order approval require Admin confirmation. | — |
| 2026-11-14 | 15 | Done. `SHOPIFY_WEBHOOK_SECRET` is set in Production and the product, collection, and inventory subscriptions point at store.ryanmeetup.com. A real product edit was delivered (200) and appeared on the next uncached page load. Setup notes moved into [ADDING_PRODUCTS.md](ADDING_PRODUCTS.md). | — |
| 2026-11-14 | 4 | Verified the current production deployment at store.ryanmeetup.com and the EmailJS settings in all three Vercel environments. The live form uses the main site's settings, received 200 OK from EmailJS, showed success, and cleared its fields. Added local settings and setup documentation; Ryan confirmed the test arrived in the support inbox. | — |
| 2026-11-14 | 4 | Removed the beta banner and site-wide noindex; cart and confirmation pages retain their own noindex. Best Sellers uses its normal storefront fallback when Shopify still supplies the original test description. | — |
| 2026-11-13 | 15 | Implemented authenticated catalog cache invalidation with immediate expiry and signed-delivery tests. Deployment, signing-secret configuration, and Shopify subscription verification remain. | — |
| 2026-11-06 | 14 | Resolved Judge.me authentication with its registered shop domain, independent of the Shopify catalog domain. Product lookup, review reads, and media settings are verified. Added the storefront account handoff and published-photo display; fulfilled-order verification remains. | — |
| 2026-11-05 | 14 | Closed the legacy anonymous review POST endpoint after confirming Judge.me's public API does not require authorization. Four security tests cover rejection, 30 concurrent spam attempts, and forged buyer claims without provider calls. A private Shopify purchase-authorized backend is the recommended next direction; no new storage is provisioned yet. | — |
| 2026-11-05 | 14 | Built the shared product-review modal with mobile full-screen layout, preserved drafts, deliberate rating selection, and retryable submission errors. Removed the title field and hardened API input validation. Shopify sign-in and purchase enforcement still await the setup recorded in the handoff. | — |
| 2026-11-05 | 14 | Recorded the live review integration audit and a Claude handoff. Modal reviews with Shopify sign-in/purchase history are the chosen direction; implementation awaits the Headless client details and a working local Judge.me credential. | — |
| 2026-11-04 | 4 | Refund, shipping, terms, and contact information policies written in Shopify, and the privacy policy updated for customer accounts and the no-returns rule. About's fine print now says all sales are final and links the shipping and refund policies when they exist; the cart page and drawer repeat "All sales are final" with a return policy link; the contact form's return topics became refund wording; and policy pages make store links relative. | — |
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
