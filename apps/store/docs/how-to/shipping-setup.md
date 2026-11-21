# Shipping on Shopify Basic

Reviewed November 21, 2026. The November 15 operating record says the US name
tag shirt/hoodie tiers were applied and matched quotes for 1–3 and 10 shirts,
1–2 hoodies and a mixed cart. On November 21 Ryan enabled the International
market (27 regions), completed a delivered Canadian order (one shirt, $13.00 CAD
shipping) and confirmed checkout quotes for EU and Australian addresses, a
hoodie, a mug or flag and a mixed cart. The same day, Storefront cart quotes
covered the heaviest variants (see [heaviest-item quotes](#heaviest-item-quotes)).

Ryan chose to keep Basic and use conservative weight-based tiers on November
14, 2026. Shipping charges may appear entirely in hosted checkout. Do not change
the Shopify plan, retail prices, or product weights to implement this.

## Configuration

Create custom shipping profiles rather than editing Printful-managed profiles,
which Printful can overwrite. Keep products separate when their Printful
shipping category, first-item rate, additional-item rate, or minimum variant
weight differs. Inspect current Admin assignments and Printful mappings before
moving products.

The earlier catalog audit covered 88 products and 1,878 variants; those are
historical counts, not a current inventory constraint. Product types are too
broad for shipping: Apparel includes children's clothing, while Accessory
includes mugs, flags, and pins. That audit found minimum variant weights from
0.25 oz to 53.969 oz. Recheck current weights; do not apply adult-shirt tiers globally.

For each confirmed US profile:

1. Record Printful's first-item cost `B` and additional-item cost `A` in USD.
   Separately packaged products need their own verified calculation.
2. Choose a positive whole-gram unit `q` strictly below the lightest assigned
   variant's weight in grams. Do not round up or edit product weights.
3. The first tier spans 0–`2q` grams and costs `B`. Tier `k >= 2` spans
   `kq`–`(k + 1)q` grams and costs `B + (k - 1)A`.
4. Add the US holiday allowance below to each tier.
5. Use the same shipping option name across profiles, such as
   **Standard shipping**, so Shopify can combine them.

Every item weighs more than `q`, so even the cheaper rate at a shared tier
boundary covers the maximum possible item count at that weight. Larger sizes
can enter higher tiers and pay more than Printful's actual shipping charge.
Package weight can also raise the tier; inspect Shopify's default package when
testing.

Keep every tier bounded. An unlimited final flat rate eventually undercharges
larger carts. Before activation, extend the table to the supported maximum
order weight and determine how larger orders are handled; they must not
silently receive the last flat price.

## Current profiles

Admin read on November 21, 2026: products sit in custom profiles named
`RMT standard: <family> <minimum weight> (<Printful rate group>)`, for example
`RMT standard: hoodies 16 oz (FRG1002)` and
`RMT standard: doormats 53.969 oz (FRG89)`. Each mirrors Printful's zones:
US, CA, GB, Europe, EFTA, Australia & New Zealand, JP and Worldwide (the
International market's other countries, such as Singapore or the UAE). Each zone
has 38 bounded **Standard shipping** weight tiers; the doormat table reaches
765 kg, so no realistic cart runs off the end.

The **General profile** holds no variants. Its old $8 / free-over-$70 domestic
rates and carrier-calculated international rates would apply to any product not
moved into a custom profile, so assign every new product to the matching custom
profile (see [adding products](adding-products.md)).

## Initial name tag family tables

The earlier audit observed shirt weights of 5.8–10.7 oz and hoodie weights of
16–26.3 oz. Confirm current weights, family membership and Printful fulfillment
locations in Admin before moving products. Other products require their own
verified profiles.

The November 15 examples used US shirt shipping of $4.95 plus $2.20 per
additional item and hoodie shipping of $8.79 plus $2.50 per additional item.
Recheck Printful's current product/location rates before reusing these amounts.
The examples include a $0.40 holiday allowance per contributing profile.

| Tier | Shirt weight, grams (`q = 164`) | Shirt rate | Hoodie weight, grams (`q = 453`) | Hoodie rate |
| --- | --- | --- | --- | --- |
| 1 | 0–328 | $5.35 | 0–906 | $9.19 |
| 2 | 328–492 | $7.55 | 906–1,359 | $11.69 |
| 3 | 492–656 | $9.75 | 1,359–1,812 | $14.19 |
| 4 | 656–820 | $11.95 | 1,812–2,265 | $16.69 |
| 5 | 820–984 | $14.15 | 2,265–2,718 | $19.19 |

These are the first five tiers, not a complete table for an unrestricted cart.
Before package weight, two 5.8 oz shirts use the $7.55 tier; two 10.7 oz shirts
use the conservative $9.75 tier.

**Holiday allowance.** Printful's current holiday notice confirms a $0.40 US surcharge per order from
October 15, 2026 through January 17, 2027. Custom rates need the allowance
removed manually after that period. Including it in each profile can collect
more than $0.40 on mixed-profile orders; this is a conservative allowance, not an exact
pass-through. Do not add it again as a handling fee. Printful's automatic
surcharge switch does not establish that custom Shopify rates were updated.
After January 17, 2027, check Printful's rates again, subtract $0.40 from every
US tier in each `RMT standard` profile, and rerun the
[live quote check](#live-quote-check).

## Applying and verifying

Shopify is gradually moving some stores to shipping options by market; inspect
the current Admin layout before following profile-era labels. Keep the verified
rate logic and quote checks if the controls have moved.

In **Shopify → Settings → Shipping and delivery**, create each custom profile,
assign confirmed products and the Printful fulfillment location, and add a
zone for the US and for the International market's countries, with
international rates calculated from Printful's costs for that destination. Add **Standard shipping → Rate type → Weight**, enter the verified ranges
and prices, and save. Capture original assignments for rollback first.

Ensure old unrestricted flat or express options do not still apply to the same
products and location, allowing an underpriced choice. Preserve unrelated
products' rates. Every profile needs a rate for every enabled country: one
missing zone makes a mixed cart fail with no shipping available. When countries
are added to or removed from Markets, update the zones and the shipping policy's
country list together.

Test one item, multiple identical items, mixed sizes, mixed products and
profiles, tier boundaries, package weight, and the highest supported weight.
Compare the cheapest eligible shipping charge with Printful's cost. Confirm
assignments survive a Printful sync. Quote tests require no order or payment.

The holiday-allowance follow-up is tracked in
[the roadmap](../planning/roadmap.md#4-shopify-and-printful-operating-setup).
The procedure above applies whenever rates or assigned products change.

### Live quote check

From `apps/store`, `npm run quote:shipping` reads the live catalog, picks the
heaviest purchasable variant in each Shopify category, and asks Shopify's cart
for shipping to one country per zone (US, CA, GB, DE, CH, AU, JP, SG). It also
quotes two of the heaviest variant and a cart mixing the two heaviest
categories. Add `-- --all` after a Markets change to quote every enabled
country. It uses only `SHOPIFY_STORE_DOMAIN` and the public Storefront token
from `.env.local`, creates throwaway carts (no order, payment or Printful job),
and exits nonzero if any cart has no shipping option. Compare the printed
prices, in each market's currency, with Printful's costs by hand.

Shopify throttles cart creation per client. The script paces itself; a burst of
parallel carts can lock this machine out of cart creation for several minutes.

### Heaviest-item quotes

Storefront cart quotes on November 21, 2026, cheapest **Standard shipping**
option, in each market's checkout currency:

| Cart | US | CA | DE | GB | AU | JP |
| --- | --- | --- | --- | --- | --- | --- |
| Doormat (54 oz) ×1 | $21.69 | $85 CAD | €67.95 | £57 | $113 AUD | ¥11,800 |
| Doormat ×2 | $42.18 | $128 CAD | €123.95 | £104 | $205 AUD | ¥21,500 |
| Hoodie 5XL (26.3 oz) ×1 | $9.19 | $16 CAD | €6.95 | £6 | $20 AUD | ¥1,300 |
| Hoodie 5XL ×3 | $16.69 | $26 CAD | €13.95 | £12 | $30 AUD | ¥2,600 |
| Doormat + hoodie 5XL | $30.88 | $100 CAD | €74.95 | £63 | $132 AUD | ¥13,100 |

Every cart had a rate. Doormats are expensive abroad because their profile
follows Printful's doormat rates ($57.99 to Canada, $73.29 to most other
international zones, before conversion); that is a cost, not a missing zone.

## Sources

- [Printful Shopify shipping](https://help.printful.com/hc/en-us/articles/50262284973841-How-do-I-set-up-shipping-for-my-Shopify-store)
- [Printful published rates](https://www.printful.com/shipping)
- [US holiday surcharge](https://help.printful.com/hc/en-us/articles/41396792413457-What-is-the-holiday-shipping-surcharge-and-does-it-affect-my-orders)
- [Shopify weight-based rates](https://help.shopify.com/en/manual/fulfillment/setup/shipping-rates/setting-up-shipping-rates)
