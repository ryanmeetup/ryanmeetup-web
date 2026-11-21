# Adding products to the Ryan Meetup Store

Reviewed November 21, 2026 against the catalog, grouping, designer and webhook
code. Collection names below are examples, not a fresh Shopify inventory audit.

How to set up a product in Shopify so it shows up in the right places on
`store.ryanmeetup.com`. Everything here happens in Shopify Admin; no code changes
or developer help are needed for everyday listing work.

## How the store reads Shopify

After a successful catalog webhook, changes appear on the next uncached page
load. Shopify sends a signed webhook to `/api/webhooks/shopify`, which expires
the store's catalog cache; a five-minute refresh is the fallback. The subscriptions
live in Shopify Admin under **Settings → Notifications → Webhooks**, and their
signing secret is `SHOPIFY_WEBHOOK_SECRET` in the Vercel **store** project. If
the store's domain changes, update each subscription's URL; if the secret is
rotated, update Vercel and redeploy.

The store pulls everything from Shopify. These settings on each product decide
what customers see:

| Shopify setting | What it controls on the store |
| --- | --- |
| **Status** and **Sales channels** | Whether the product appears at all. |
| **Product type** | Whether it appears on the **Apparel** or **Accessories** page. |
| **Category** | Which grouping it sits in on that page, such as T-Shirts, Hats, or Flags. |
| **Collections** | Which theme it belongs to, and whether the home page features it. |
| **`listing:` tag** | Whether it is combined with similar products into one listing with a **Style** dropdown. |
| **Title** | The product name, and the option name in that Style dropdown. |
| **`designer:` tags** | The names credited under **Designed by Ryan** on the product page. |

If the webhook is missing or delayed, the five-minute cache refresh is the
fallback. Confirm webhook delivery before expecting immediate freshness.

## Checklist for every new product

Create and sync the product through Printful as usual, then open it in Shopify
(**Products → the product**) and work through this list.

1. **Title.** Follow the [title patterns](#titles) below.
2. **Status: Active.** Draft and archived products never appear.
3. **Sales channels: include Ryan Meetup Store Headless.** In the **Publishing**
   box, click **Manage** and tick it. An Active product without this channel is
   invisible on the store. This is the step most often missed.
4. **Product type: `Apparel` or `Accessory`.** Spelled exactly that way, singular.
   - **Apparel** is anything you wear: shirts, hoodies, polos, and every hat,
     cap, and beanie.
   - **Accessory** is everything else: pins, mugs, totes, flags, doormats.

   Any other spelling leaves the product off both pages; it only appears under
   Collections.
5. **Category.** Pick the closest Shopify category (T-Shirts, Hoodies, Baseball
   Caps, Mugs, Door Mats, …). It decides the product's grouping on the Apparel or
   Accessories page. See [Groupings](#groupings-apparel-and-accessories).
   Shopify also uses it for sales tax (New York exempts clothing under $110),
   so don't leave a shirt in a non-clothing category.
6. **Collection.** Add the product to one theme collection. See
   [Collections](#collections).
7. **`listing:` tag, only if the product is a version of something else.** See
   [Listings](#listings-combining-similar-products).
8. **Designer credits.** Add a `designer:Ryan Name` tag for each contributor you
   want to credit. See [Designer credits](#designer-credits).
9. **Shipping profile.** In **Settings → Shipping and delivery**, add every
   variant to the matching `RMT standard: …` profile for its Printful rate
   group. A product left in the General profile gets old flat and
   carrier-calculated rates. See [shipping setup](shipping-setup.md#current-profiles),
   then run `npm run quote:shipping` from `apps/store` if it's the heaviest item
   in its category.
10. **Check the store** after about 5 minutes: the product's page, its collection
   page, and the Apparel or Accessories page.

## Designer credits

In Shopify Admin, open **Products → the product → Product organization → Tags**
and add a separate tag for each designer, for example `designer:Ryan Le`.
For a collaboration, add each contributor's tag. The store shows their names
under **Designed by Ryan**, alongside **Secure checkout** and **Supports Ryan Meetup**.
Use the names you want customers to see; these credits are plain text.

For grouped listings, put credits on each underlying Shopify product. The credit
follows the selected style or color, so different designs can credit different
Ryans. If the same designer created every version, add the same tag to each
product. A product without designer tags shows **Designed in-house by one of our Ryans.** instead.
Blank credits are ignored, and repeated names appear once.

## Listings: combining similar products

Printful creates a separate Shopify product for each design or print color. When
several products are really the same item, a **listing** shows them to customers
as **one product** with a **Style** dropdown, instead of a separate card for each.

| Shopify products | What customers see |
| --- | --- |
| I Heart RY Hoodie - Black, I Heart RY Hoodie - White | One **I Heart RY Hoodie**, Style: Black or White |
| Ryan Name Tag Shirt, Ryan's Dad Name Tag Shirt, Ryan's Mom Name Tag Shirt, … | One **Name Tag Shirt**, Style: Ryan, Ryan's Dad, Ryan's Mom, … |

To add a product to a listing, give it a tag of `listing:` followed by the
listing's name, in **Product organization → Tags**:

- `listing:I Heart RY Hoodie`
- `listing:I Heart RY Shirt`
- `listing:Name Tag Hoodie`
- `listing:Name Tag Shirt`
- `listing:Super Ryan Shirt`

Every product with the same `listing:` tag joins the same listing. Capitalization
and extra spaces don't matter, but the words do: `listing:Name Tag Shirt` and
`listing:Nametag Shirt` are two different listings.

**To start a new listing**, tag the products with a new name, such as
`listing:Ryan Cap`. Nothing else is needed. The listing's web address comes from
its name (`/products/ryan-cap`), so pick the name carefully: renaming a listing
later changes its address and breaks links people have already shared. Ask a
developer to set up a redirect first if a rename is unavoidable.

Rules for listings:

- **One `listing:` tag per product.**
- **Only combine products customers would see as one item.** A mug and a shirt
  with the same design are separate products; put them in the same theme
  [collection](#collections) instead.
- **Products that stand alone get no `listing:` tag**, such as the Trademark Logo
  Shirt or the No Bryans Allowed Doormat.
- **Never merge the products themselves in Shopify.** Each one must stay a
  separate Shopify product so Printful keeps printing the right thing.
- **Keep the Product type and Category the same** across a listing's products.

The listing's card shows the lowest price among its products ("From $12.00")
and its first option's photo. The store stays available as long as one option is
in stock; sold-out options are marked in the dropdown.

## Titles

The title is what customers see in the cart, at checkout, and in order emails.
For a product in a listing, the store also builds its **Style** option from the
title: **the title minus the listing name**. So the listing name must appear in
the title, spelled the same way.

**Color or print versions of one design:** `Listing name - Option`

| Tag | Title | Style option |
| --- | --- | --- |
| `listing:I Heart RY Hoodie` | I Heart RY Hoodie - Black | Black |
| `listing:I Heart RY Hoodie` | I Heart RY Hoodie - White | White |
| `listing:Super Ryan Shirt` | Super Ryan Shirt - Blue | Blue |

**Name tag designs:** `Who Name Tag Shirt` or `Who Name Tag Hoodie`

| Tag | Title | Style option |
| --- | --- | --- |
| `listing:Name Tag Shirt` | Ryan Name Tag Shirt | Ryan |
| `listing:Name Tag Shirt` | Ryan's Dad Name Tag Shirt | Ryan's Dad |
| `listing:Name Tag Hoodie` | Ryan's Grandma Name Tag Hoodie | Ryan's Grandma |

**Standalone products:** a plain descriptive title, such as *Trademark Logo
Shirt* or *I Heart RY Tote Bag*.

General conventions:

- Title Case, with **RY** in capitals: *I Heart RY Mug*, *RY or DIE Shirt*.
- Use the product word consistently: **Shirt**, **Hoodie**, **Mug**.
- Two products in the same listing must not end up with the same option name.
  If a title doesn't contain the listing name at all, its option shows the whole
  title, which is the clue that something is misspelled.
- Emoji are allowed in titles. Collection and listing names with ❤️ or ♥ get
  "heart" in their web address automatically.

## Groupings: Apparel and Accessories

The Apparel and Accessories pages split into groupings by each product's Shopify
**Category**, so a new hoodie lands under Hoodies as soon as its category is set.
Nothing else is needed.

The groupings themselves live in Shopify Admin under **Content → Metaobjects →
Store grouping**. The store's groupings when this guide was reviewed:

| Page | Groupings, in order | Categories that land there |
| --- | --- | --- |
| Apparel | T-Shirts | T-Shirts, Shirts |
| | Hoodies & Sweatshirts | Hoodies, Sweatshirts, Activewear Sweatshirts & Hoodies |
| | Hats | Anything under Hats: Baseball Caps, Beanies, … |
| | Kids | Anything under Baby & Children's Clothing |
| Accessories | RY-Ds | The RY-D membership card, sold at ryanmeetup.com |
| | Pins | Brooches & Lapel Pins, Pinback Buttons |
| | Bags | Anything under Luggage & Bags |
| | Mugs | Anything under Drinkware |
| | Home Goods | Door Mats |
| | Flags | Anything under Flags & Windsocks |

Kids sizes go under Kids even when they are hoodies or shirts. A product whose
category matches none of these, such as the polo, appears at the bottom under
"More Ryan Goods".

A grouping with nothing in it, such as Home Goods while its only doormat is
archived, drops out of the menu, its page becomes "not found", and it leaves the
sitemap. It comes back on its own when a matching product returns.

### Adding or changing a grouping

Add an entry under **Content → Metaobjects → Store grouping**, or edit one:

- **Title** and **Description** are the heading and the line under it, also
  shown in the menu.
- **Department** is `apparel` or `accessories`.
- **Position** sets the order within the department, lowest first. Current
  entries count by tens, so 25 slots between 20 and 30.
- **Shopify categories** are standard category names, typed exactly as Shopify
  shows them. A product matches when its category or any parent category has
  one of these names, so `Drinkware` covers mugs and tumblers.
- **Listings** places specific listing handles here whatever their category.
  RY-Ds uses this, since the membership card has no category.
- **Links to collection** is optional. It sends the menu link to a collection
  instead of the grouping's own page. RY-Ds uses `ryd`, which goes to
  ryanmeetup.com/cards.
- **Claims products first** gives this grouping first pick, so a youth hoodie
  goes to Kids instead of Hoodies.

The entry handle becomes the page address (`/accessories/stickers`), so choose
it before sharing links. Set the entry to **Active**; drafts stay off the store.
Changes appear within five minutes. Shopify's catalog webhooks don't cover
metaobjects, so a grouping edit waits for the normal refresh. A new grouping
gets its department's icon until a developer gives it one in `garmentIcons` in
[lib/navigation.ts](../../lib/navigation.ts).

**Don't create collections for a kind of product** such as Hats or Hoodies.
Groupings already cover that, and they stay complete without upkeep. Old links
to the retired Hats, Hoodies, Youth, Toddler, and Flags collections redirect to
the matching grouping.

## Collections

Collections are themes: what a product says, not what it is. They build the home
page. There are three kinds.

**Theme collections** include examples such as **Limited Edition**, **Not A Cult**,
**Lunch Money**, **I ❤️ RY**, **Ryan Classics**, and **Name Tag**. Each one gets
its own page and a tile on the home page that leads there. The tile shows the
collection's image from Shopify, or its first product's photo when it has none.

- Add **every** product to a theme collection. A product in none of them still
  appears on the Apparel/Accessories pages, but under Collections it falls into
  a catch-all "More Ryan Goods" section at the bottom.
- Add products from the product page (**Product organization → Collections**),
  or select several in the **Products** list and use **More actions → Add to
  collection(s)**.
- Theme collection pages put matching Best Sellers first, then follow sales
  popularity. Manual collection order still controls the curated Best Sellers
  and Spotlight picks.

**Best Sellers** is special. It is the favorites row on the home page, showing
up to **four** listings in the collection's order, directly below the hero. Use it for hand-picked
highlights, not every product. If it is ever empty, the store shows the actual
best-selling products there instead. Matching Best Sellers also lead other
catalog pages, and sales popularity orders the rest within each section.
Customers can still choose newest or price sorting, which applies within each
grouping or collection section.

**Spotlight** is special too. Create a manual collection with the handle
`spotlight` (published to Ryan Meetup Store Headless) and its **first** product
becomes the large featured drop on the home page. The collection's title is the
small label above the product name (for example *Fresh off the press*), and its
description, if any, replaces the product's own intro. To change the drop,
reorder or swap the product; to retire it, empty the collection. With no
spotlight product, the newest in-stock listing takes the spot as a *New
arrival*. A popular spotlight product stays in the Best Sellers row too. The
Spotlight collection itself never gets a tile or a menu entry.

**To create a new theme collection:**

1. **Products → Collections → Create collection.**
2. Enter the **Title** customers will see. Add a **Description** if you want one
   under the section heading.
3. Choose **Manual** as the collection type.
4. In **Publishing**, add it to **Ryan Meetup Store Headless**. Without this, it
   does not appear on the store.
5. Save, then add products to it.

Its home page tile appears automatically. Tiles, the Collections menu, and the
sections on Shop All are ordered by sales: the collection holding the store's
best-selling product comes first. Don't give a collection the handle `all`, `apparel`, `accessories`, or `ryd`;
the first three belong to the store's own catalog pages, and `ryd` is reserved
for the external membership card link. The Collections dropdown always offers
RY-Ds directly at `https://ryanmeetup.com/cards`. `frontpage` and `spotlight` are reserved for Best Sellers and Spotlight.

## Tags

The storefront uses `listing:` tags for grouped listings and `designer:` tags
for public designer credits. Other tags currently have no special storefront
behavior in this code. Shopify or another installed app may use them separately;
do not treat unused storefront tags as proof that they are safe to delete.

## Where a product appears

| Place on the store | What puts a product there |
| --- | --- |
| Collections | Active and on the Ryan Meetup Store Headless channel; grouped under each theme collection it is in |
| Apparel page | Product type `Apparel`, grouped by Category |
| Accessories page | Product type `Accessory`, grouped by Category |
| Home page, featured drop | First in the `spotlight` collection, otherwise the newest in-stock listing |
| Home page, favorites row | In the Best Sellers collection (up to four shown) |
| Home page, collection tile photo | First product in that theme collection, unless the collection has its own image |
| Collection page | In that collection |
| Combined with other products | Same `listing:` tag |

## Troubleshooting

| Problem | Check |
| --- | --- |
| Product doesn't appear anywhere | Status is Active, it's on the **Ryan Meetup Store Headless** channel, and 5 minutes have passed. |
| Missing from the Apparel or Accessories page | Product type is exactly `Apparel` or `Accessory`. |
| Shows under "More Ryan Goods" on Collections | It isn't in a theme collection yet. |
| Shows as its own card instead of joining a listing | It has the `listing:` tag, and the name after `listing:` matches the other products word for word. |
| Style option shows the whole title | The listing name isn't in the title exactly. Fix the title or the tag so they match. |
| Two Style options have the same name | Two products in the listing have titles that differ only in the listing name. Make the part after it unique. |
| Collection has no home page tile | It's on the **Ryan Meetup Store Headless** channel and has at least one product. |
| Wrong item printed or shipped | The product's Printful sync. Listings only change how products are displayed; they never change what Printful prints. |

## Maintenance

- Confirm the current Headless channel and intended theme membership in Admin
  for each new product; this document does not freeze a live collection list.
- Keep webhook subscriptions/secret synchronized and verify a delivered change.
- Before renaming grouped listings, arrange redirects for shared URLs.
- Add theme collections and garment groupings through Admin. Grouping icons and
  legacy URL redirects require a code change.

Personalization has separate work in the [roadmap](../planning/roadmap.md).
Implementation references:
[grouping](../../lib/product-groups.ts), [departments](../../lib/catalog-collections.ts),
[garments](../../lib/garments.ts), [designer credits](../../lib/product-designers.ts)
and [webhook handling](../../lib/shopify-webhook.ts).
