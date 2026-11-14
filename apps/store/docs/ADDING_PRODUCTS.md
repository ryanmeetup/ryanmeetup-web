# Adding products to the Ryan Meetup Store

How to set up a product in Shopify so it shows up in the right places on
`store.ryanmeetup.com`. Everything here happens in Shopify Admin; no code changes
or developer help are needed for everyday listing work.

## How the store reads Shopify

Product, collection, and inventory changes appear on the next page load.
Shopify sends a signed webhook to `/api/webhooks/shopify`, which expires the
store's catalog cache; a five-minute refresh is the fallback. The subscriptions
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
| **Collections** | Which collection page lists it, and whether the home page features it. |
| **`listing:` tag** | Whether it is combined with similar products into one listing with a **Style** dropdown. |
| **Title** | The product name, and the option name in that Style dropdown. |
| **`designer:` tags** | The names credited under **Designed by Ryan** on the product page. |

Changes show up on the store within about **5 minutes**. If something looks
wrong right after a change, wait and refresh before troubleshooting.

## Checklist for every new product

Create and sync the product through Printful as usual, then open it in Shopify
(**Products → the product**) and work through this list.

1. **Title.** Follow the [title patterns](#titles) below.
2. **Status: Active.** Draft and archived products never appear.
3. **Sales channels: include Ryan Meetup Store Headless.** In the **Publishing**
   box, click **Manage** and tick it. An Active product without this channel is
   invisible on the store. This is the step most often missed.
4. **Product type: `Apparel` or `Accessory`.** Spelled exactly that way, singular.
   - **Apparel** is anything you wear: shirts, hoodies, polos, hats.
   - **Accessory** is everything else: mugs, totes, doormats.

   Any other spelling leaves the product off both pages; it only appears under
   Collections.
5. **Category.** Pick the closest Shopify category (T-Shirts, Hoodies, Mugs, Door
   Mats, …). Shopify uses it for its own organization and tax rules; the store
   does not use it today, but keep it filled in.
6. **Collection.** Add the product to one design collection. See
   [Collections](#collections).
7. **`listing:` tag, only if the product is a version of something else.** See
   [Listings](#listings-combining-similar-products).
8. **Designer credits.** Add a `designer:Ryan Name` tag for each contributor you
   want to credit. See [Designer credits](#designer-credits).
9. **Check the store** after about 5 minutes: the product's page, its collection
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
  with the same design are separate products; put them in the same
  [collection](#collections) instead.
- **Products that stand alone get no `listing:` tag**, such as the Trademark Logo
  Shirt or the No Bryans Allowed Doormat.
- **Never merge the products themselves in Shopify.** Each one must stay a
  separate Shopify product so Printful keeps printing the right thing.
- **Keep the Product type the same** across a listing's products.

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

## Collections

Collections are how the store is organized into themes, and they build the home
page. There are three kinds.

**Design collections**: currently **I ❤️ RY**, **Name Tag**, and **Ryan
Classics**. Each one gets its own page and a tile on the home page that leads
there. The tile shows the collection's image from Shopify, or its first
product's photo when it has none.

- Add **every** product to a design collection. A product in none of them still
  appears on the Apparel/Accessories pages, but under Collections it falls into
  a catch-all "More Ryan goods" section at the bottom.
- Add products from the product page (**Product organization → Collections**),
  or select several in the **Products** list and use **More actions → Add to
  collection(s)**.
- Design collection pages put matching Best Sellers first, then follow sales
  popularity. Manual collection order still controls the curated Best Sellers
  and Spotlight picks.

**Best Sellers** is special. It is the favorites row on the home page, showing
up to **four** listings in the collection's order, directly below the hero. Use it for hand-picked
highlights, not every product. If it is ever empty, the store shows the actual
best-selling products there instead. Matching Best Sellers also lead other
catalog pages. Apparel then orders the remaining goods as T-shirts,
hoodies/sweatshirts, hats, other goods, and flags, with sales popularity within
each department. Customers can still choose newest or price sorting.

**Spotlight** is special too. Create a manual collection with the handle
`spotlight` (published to Ryan Meetup Store Headless) and its **first** product
becomes the large featured drop on the home page. The collection's title is the
small label above the product name (for example *Fresh off the press*), and its
description, if any, replaces the product's own intro. To change the drop,
reorder or swap the product; to retire it, empty the collection. With no
spotlight product, the newest in-stock listing takes the spot as a *New
arrival*. A popular spotlight product stays in the Best Sellers row too. The
Spotlight collection itself never gets a tile or a menu entry.

**To create a new design collection:**

1. **Products → Collections → Create collection.**
2. Enter the **Title** customers will see. Add a **Description** if you want one
   under the section heading.
3. Choose **Manual** as the collection type.
4. In **Publishing**, add it to **Ryan Meetup Store Headless**. Without this, it
   does not appear on the store.
5. Save, then add products to it.

Its home page tile appears automatically; tiles are ordered alphabetically by
title. Don't give a collection the handle `all`, `apparel`, `accessories`, or `ryd`;
those addresses belong to the store's own catalog pages. The Collections
dropdown always offers RY-D’s at `/collections/ryd`, where the membership card
links to its external order page. `frontpage` and `spotlight` are reserved for Best Sellers and Spotlight.

## Tags

The store reads **only** `listing:` tags. Every other tag is ignored and has no
effect on search engines either. Use other tags only as private notes in Shopify
if they help you; they can also be left off entirely.

## Where a product appears

| Place on the store | What puts a product there |
| --- | --- |
| Collections | Active and on the Ryan Meetup Store Headless channel; grouped under each design collection it is in |
| Apparel page | Product type `Apparel` |
| Accessories page | Product type `Accessory` |
| Home page, featured drop | First in the `spotlight` collection, otherwise the newest in-stock listing |
| Home page, favorites row | In the Best Sellers collection (up to four shown) |
| Home page, collection tile photo | First product in that design collection, unless the collection has its own image |
| Collection page | In that collection |
| Combined with other products | Same `listing:` tag |

## Troubleshooting

| Problem | Check |
| --- | --- |
| Product doesn't appear anywhere | Status is Active, it's on the **Ryan Meetup Store Headless** channel, and 5 minutes have passed. |
| Missing from the Apparel or Accessories page | Product type is exactly `Apparel` or `Accessory`. |
| Shows under "More Ryan goods" on Collections | It isn't in a design collection yet. |
| Shows as its own card instead of joining a listing | It has the `listing:` tag, and the name after `listing:` matches the other products word for word. |
| Style option shows the whole title | The listing name isn't in the title exactly. Fix the title or the tag so they match. |
| Two Style options have the same name | Two products in the listing have titles that differ only in the listing name. Make the part after it unique. |
| Collection has no home page tile | It's on the **Ryan Meetup Store Headless** channel and has at least one product. |
| Wrong item printed or shipped | The product's Printful sync. Listings only change how products are displayed; they never change what Printful prints. |
