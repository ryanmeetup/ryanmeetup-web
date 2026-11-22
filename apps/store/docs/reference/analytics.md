# Store analytics: events and the questions they answer

Reviewed November 21, 2026 against the repository. Vercel Web Analytics was
enabled for the store project on Team Ryan's Pro plan that day. This guide
describes what the storefront records and how to read it for design
decisions; implementation history belongs in Git.

## What is collected

| Layer | Source | Where to read it |
| --- | --- | --- |
| Page views, visitors, referrers, countries, devices | `<Analytics />` in [`store-analytics.tsx`](../../components/store-analytics.tsx) | Vercel → store project → Analytics |
| Custom interaction events (below) | `trackStoreEvent` in [`lib/analytics.ts`](../../lib/analytics.ts) | Vercel → Analytics → Events |
| Orders, revenue, completed checkouts | Shopify | Shopify admin; **not** in Vercel |

The storefront hands buyers to Shopify-hosted checkout. `checkout_clicked`
only proves that handoff. Use Shopify order data for purchases and revenue;
an emptied cart or a return visit is not evidence of a sale.

### Privacy rules

[`lib/analytics-events.ts`](../../lib/analytics-events.ts) keeps reports to
public catalog and interface data:

- Every URL loses its query string and fragment, so contact prefills, search
  text, variant IDs and checkout tokens are never sent.
- `/api` and `/auth` page views are dropped entirely.
- Paths outside the known store routes are reported as `/other`.
- Properties are product handles, collection paths, placements, counts and
  fixed enum values. Never add form values, names, emails, order numbers,
  click text or free-form strings.

Tests in [`tests/analytics-events.spec.ts`](../../tests/analytics-events.spec.ts)
cover these rules.

### Limits and cost

As of November 21, 2026: Pro allows two properties per custom event, and
events are billed at $3 per 100,000, drawn against Team Ryan's monthly
usage credit. The Analytics Plus add-on is not needed. Every event type in
`StoreEvents` is limited to two properties at the type level.

`product_card_viewed` is the highest-volume event, since a single home or
catalog visit can record many cards. If it starts to dominate usage, sample
or remove it before cutting anything else.

## Placements

Clicks and card views carry a `placement` that says where on the page the
interaction happened. It comes from the nearest `data-analytics-placement`
ancestor; links inside `<header>` or `<footer>` fall back to `header` or
`footer`, and anything else is `content`.

| Placement | Area |
| --- | --- |
| `home_hero`, `home_favorites`, `home_spotlight`, `home_collections`, `home_reviews` | Home page sections, top to bottom |
| `catalog`, `popular_picks` | Collection grid and its popular picks |
| `product`, `product_gallery`, `product_details` | Product page, its gallery and description disclosure |
| `related_products` | "Related" listings under a product |
| `reviews` | `/reviews` and the product page reviews section |
| `cart_drawer`, `cart_page` | Cart surfaces |
| `header`, `mobile_navigation`, `footer` | Site chrome |
| `content` | Anything unmarked |

To measure a new area, add its name to `analyticsPlacements` and set
`data-analytics-placement` (clicks) and/or `data-analytics-section`
(visibility) on its container.

## Event catalog

### Discovery: did they see it, did they go there?

| Event | Properties | Fires when | Answers |
| --- | --- | --- | --- |
| `section_viewed` | `section`, `viewport` | Any part of a marked section stays visible for 1s; once per section per page view. `viewport` is `narrow` (<640px), `medium` (<1280px) or `wide`. | How far down the home page people actually get, by device size. |
| `page_scrolled` | `depth`, `page` | Scroll passes 25, 50, 75 and 100% of the page; once per threshold per page view. | Whether long pages lose people before the content that matters. |
| `product_card_viewed` | `product`, `placement` | Half a product card is visible for 1s; once per product and placement per page view. | Impressions: the denominator for card click-through. |
| `product_clicked` | `product`, `placement` | A link to `/products/<handle>` is clicked. | Which placements send people to products. |
| `external_product_clicked` | `product`, `placement` | A product card links off-site (for example to Etsy). | Demand for listings sold elsewhere. |
| `collection_clicked` | `collection`, `placement` | A link to a collection, `/apparel` or `/accessories` is clicked. | Which category entry points get used. |
| `navigation_clicked` | `destination`, `placement` | Another internal link is clicked, including `/#collections` and `/#reviews`. | Which nav and footer links earn their space. |
| `external_link_clicked` | `host`, `placement` | Any other off-site link is clicked. | Outbound traffic to social and partner sites. |
| `mobile_navigation_toggled` | `expanded` | The mobile menu opens or closes. | Whether phone visitors use the menu at all. |
| `disclosure_toggled` | `section`, `expanded` | A disclosure inside `data-analytics-disclosure` is toggled (currently the product description). | Whether hidden detail is worth hiding. |

### Choosing: how do they narrow down?

| Event | Properties | Fires when | Answers |
| --- | --- | --- | --- |
| `quick_add_opened` | `product`, `mode` | A card's quick-add control is used. `options` opens a picker, `direct` adds a one-variant item, `product_page` sends the visitor to the product page. | Whether quick add saves a trip or just redirects. |
| `card_color_previewed` | `product`, `color` | A color swatch on a card is pressed. | Which colors draw interest before the product page. |
| `product_option_changed` | `product`, `choice` | A size, color or quantity changes on the product page; `choice` reads like `Size: M`. | Which options people consider and whether defaults fit. |
| `product_design_changed` | `product`, `design` | A grouped listing switches design. | Which designs within a group pull attention. |
| `product_photo_selected` | `product`, `photo` | A gallery photo is chosen (1-based position). | How deep into the gallery people look. |
| `catalog_filter_changed` | `filter`, `value` | The type or size filter changes. | Which filters are used and which can go. |
| `catalog_sort_changed` | `collection`, `sort` | The sort order changes. | Whether the default sort is the one people want. |
| `catalog_results` | `collection`, `count` | A collection grid loads, and again after each filter or sort change, with the visible result count. | How often filters lead to empty or tiny results. |
| `collection_toggled` | `collection`, `expanded` | A collapsed collection group is expanded or collapsed. | Whether collapsed groups get opened. |

### Cart and checkout: did they commit?

These are recorded only when Shopify commerce is configured, or in local
development.

| Event | Properties | Fires when | Answers |
| --- | --- | --- | --- |
| `add_to_cart` | `product`, `source` | An add succeeds; `source` is `product_page` or `quick_add`. Failed requests do not count. | Buying intent per product and per entry path. |
| `cart_quantity_changed` | `product`, `quantity` | A saved line quantity actually changes. | Whether people buy multiples (relevant to tiered discounts). |
| `remove_from_cart` | `product`, `quantity` | A line is removed. | Which products get second thoughts. |
| `cart_emptied` | `quantity` | The whole cart is cleared. | Abandonment inside the store. |
| `cart_drawer_opened` | `quantity`, `source` | The drawer opens from `navigation`, a product page's "View cart" (`product_page`), or automatically after an add (`add_to_cart`). | How people reach the cart. |
| `cart_drawer_closed` | `quantity` | The drawer closes. | Drawer opens that end without checkout. |
| `checkout_clicked` | `placement`, `subtotal` | The Shopify checkout link is followed from `cart_drawer` or `cart_page`; `subtotal` is the cart's amount and currency. | Handoff rate and typical basket size. |
| `cart_error` | `operation`, `reason` | A cart request fails: `network`, `rejected` (4xx), `server` (5xx) or `invalid_response`. | Technical friction that interrupts buying. |
| `currency_changed` | `from`, `to` | The display currency changes. | Which markets browse in their own currency. |
| `currency_error` | `currency` | A currency switch fails. | Broken market or rate configuration. |

### Reviews, contact and errors

| Event | Properties | Fires when | Answers |
| --- | --- | --- | --- |
| `review_filter_changed` | `filter`, `value` | Rating, source or sort changes, or filters reset (`filter: reset`). | What shoppers look for in reviews. |
| `review_photo_opened` | `photo`, `count` | A review photo is opened. | Whether review photos get attention. |
| `review_composer_opened` | `access` | "Write a review" is pressed; `access` is `signed-out`, `ready` or `reviewed`. | Whether sign-in is a barrier to reviewing. |
| `review_submitted` | `outcome` | A review submission returns `success` or `error`. | Review completion and failure rate. |
| `contact_started` | `topic` | The first edit to the contact form, by selected topic. | What people reach out about. |
| `contact_submitted` | `topic`, `outcome` | The contact form succeeds or fails. | Contact completion per topic. |
| `page_error` | `page` | The store error page renders. | Which routes break. |
| `page_retry` | `page` | "Try again" is pressed on the error page. | Whether retry recovers people. |

## Reading the data for design work

Vercel's Events view breaks down a single event by one property at a time.
These comparisons answer most design questions:

- **Section reach.** `section_viewed` by `section`, split by `viewport`,
  against home page views. A section with low reach on `narrow` sits too far
  down on phones.
- **Card click-through.** `product_clicked` ÷ `product_card_viewed` for the
  same `placement`. Compare `home_favorites`, `popular_picks`, `catalog` and
  `related_products` to see which placements earn their space.
- **Entry path to purchase intent.** `add_to_cart` by `source`, against
  `quick_add_opened` by `mode`. Many `product_page` quick-add modes and few
  quick-add adds mean the shortcut is mostly a detour.
- **Product interest vs commitment.** Per product, compare
  `product_clicked`, `product_option_changed`, `add_to_cart` and
  `remove_from_cart`. Heavy option changes with few adds can point to sizing
  doubts or missing information.
- **Cart handoff.** `checkout_clicked` against `cart_drawer_opened` and
  unique visitors, then against Shopify's orders for the same days to see how
  many handoffs become sales.
- **Friction.** Any steady `cart_error`, `currency_error`, `page_error` or
  `review_submitted` with `outcome: error` is a bug to fix before it is a
  design question.

Let a change run for at least a week, or a full campaign such as a sale,
before drawing conclusions. Small stores produce small numbers, so look for
large, consistent differences rather than a few percent.

## Adding or changing an event

1. Add the event and its at-most-two properties to `StoreEvents` in
   `lib/analytics-events.ts`. Prefer handles, placements, counts and fixed
   enum values.
2. Call `trackStoreEvent` after the action succeeds, not when it is
   attempted, unless the event is explicitly about attempts or failures.
3. Link clicks need no code: the global listener in `store-analytics.tsx`
   classifies them. Mark a link `data-analytics-ignore` when a dedicated event
   already covers it, as `checkout_clicked` does.
4. Add the event to this guide with the question it answers. An event nobody
   can name a decision for should not be added.
