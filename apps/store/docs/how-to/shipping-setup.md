# Shipping on Shopify Basic

Reviewed November 20, 2026. **Partly verified:** the November 15 operating
record says the US name tag shirt/hoodie tiers were applied and matched quotes
for 1–3 and 10 shirts, 1–2 hoodies and a mixed cart. This audit did not inspect
today's Admin assignments or obtain new quotes. Other families/international
rates and the highest supported weights still need recorded verification.

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

Printful's current holiday notice confirms a $0.40 US surcharge per order from
October 15, 2026 through January 17, 2027. Custom rates need the allowance
removed manually after that period. Including it in each profile can collect
more than $0.40 on mixed-profile orders; this is a conservative allowance, not an exact
pass-through. Do not add it again as a handling fee. Printful's automatic
surcharge switch does not establish that custom Shopify rates were updated.

## Applying and verifying

Shopify is gradually moving some stores to shipping options by market; inspect
the current Admin layout before following profile-era labels. Keep the verified
rate logic and quote checks if the controls have moved.

In **Shopify → Settings → Shipping and delivery**, create each custom profile,
assign confirmed products and the Printful fulfillment location, and add a US
zone. Add **Standard shipping → Rate type → Weight**, enter the verified ranges
and prices, and save. Capture original assignments for rollback first.

Ensure old unrestricted flat or express options do not still apply to the same
products and location, allowing an underpriced choice. Preserve unrelated
products' rates. International rates and restrictions require a separate review.

Test one item, multiple identical items, mixed sizes, mixed products and
profiles, tier boundaries, package weight, and the highest supported weight.
Compare the cheapest eligible shipping charge with Printful's cost. Confirm
assignments survive a Printful sync. Quote tests require no order or payment.

Open destination/profile setup and the holiday-allowance follow-up are tracked
in [the roadmap](../planning/roadmap.md#4-shopify-and-printful-operating-setup).
The procedure above applies whenever rates or assigned products change.

## Sources

- [Printful Shopify shipping](https://help.printful.com/hc/en-us/articles/50262284973841-How-do-I-set-up-shipping-for-my-Shopify-store)
- [Printful published rates](https://www.printful.com/shipping)
- [US holiday surcharge](https://help.printful.com/hc/en-us/articles/41396792413457-What-is-the-holiday-shipping-surcharge-and-does-it-affect-my-orders)
- [Shopify weight-based rates](https://help.shopify.com/en/manual/fulfillment/setup/shipping-rates/setting-up-shipping-rates)
