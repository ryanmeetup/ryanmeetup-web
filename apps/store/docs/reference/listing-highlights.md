# Listing highlights and sale hype

Product cards and pages show earned labels and rounded milestones so shoppers
can see what people actually buy and love. Every signal is real and clears a
floor first; a quiet listing shows nothing rather than a small number. Never
seed, pad or fake a figure, and never claim scarcity: everything is made to order.

## What shoppers see

| Signal | Rule | Source |
| --- | --- | --- |
| Best seller | Top 5 products by units sold in 30 days, each with 5+ | Order webhook |
| Trending | 4+ units this week and at least double the week before | Order webhook |
| Hot right now | 5+ distinct carts added it in 24 hours | Cart route |
| Top rated | Pooled rating of 4.8+ (cards need 5+ reviews to rate) | Reviews |
| New | Created after the launch catalog (November 13, 2026), for 30 days | Shopify |

A listing gets one label, strongest first, as a black chip stacked under the
sale sticker on cards and above the title on its page. Sold-out and off-Shopify
listings get none. Rules and floors live in `highlightRules` in
`lib/listing-highlights.ts`.

The product page also shows one milestone, rounded down to 10, 25, 50, 100, 250,
500 or 1,000: units sold during the running sale, then this month, then carts
this week ("25+ sold during Black RYDay"). Below 10 it says nothing.

While a sale runs, its last three days count down in the banner, the product-page
note and the takeover ("Last 3 days", "Ends tomorrow", "Ends tonight"), in
Eastern calendar days, from the browser's clock.

## Data

`store_product_activity` in RMT (migration `20261124010000`, RMT-only) holds one
row per sold order line (`sale`) and per cart and product (`cart_add`). Rows
carry no buyer, email or order details: a sale's key is its order and line ID,
and a cart add's key holds a truncated SHA-256 of the cart ID. Test and cancelled
orders are excluded; rows older than 180 days are pruned as orders arrive.

- **Sales** come from the `orders/create` and `orders/cancelled` webhooks at
  `/api/webhooks/shopify`, signed with `SHOPIFY_WEBHOOK_SECRET` like the catalog
  topics. Redelivery is recorded once.
- **Cart adds** are recorded by `/api/cart` after its response, best effort.
- **Reads** go through `store_product_activity_summary`, cached for 10 minutes
  (`productActivityTag`). A failed or missing read hides sales-based labels and
  milestones; ratings and newness still apply.

To backfill sales from before the webhooks, read orders with the Catalog Admin
app (read-only orders scope covers 60 days) and insert the same rows that
`orderActivityRows` builds; the unique key makes a rerun harmless.
