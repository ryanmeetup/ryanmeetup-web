# Adding products to the Ryan Meetup Store

How to set up a product in Shopify so it shows up in the right places on
`store.ryanmeetup.com`. Everything here happens in Shopify Admin; no code changes
or developer help are needed for everyday listing work.

## How the store reads Shopify

The store pulls everything from Shopify. Five settings on each product decide
what customers see:

| Shopify setting | What it controls on the store |
| --- | --- |
| **Status** and **Sales channels** | Whether the product appears at all. |
| **Product type** | Whether it appears on the **Apparel** or **Accessories** page. |
| **Collections** | Which section of the home page it appears in, and which collection page lists it. |
| **`listing:` tag** | Whether it is combined with similar products into one listing with a **Style** dropdown. |
| **Title** | The product name, and the option name in that Style dropdown. |

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
8. **Check the store** after about 5 minutes: the product's page, its collection
   section on the home page, and the Apparel or Accessories page.

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
page. There are two kinds.

**Design collections**: currently **I ❤️ RY**, **Name Tag**, and **Ryan
Classics**. Each one gets its own section on the home page (showing its first
four listings, with a link to see all) and its own page.

- Add **every** product to a design collection. A product in none of them still
  appears on the Apparel/Accessories pages, but on the home page and Collections it
  falls into a catch-all "More Ryan goods" section at the bottom.
- Add products from the product page (**Product organization → Collections**),
  or select several in the **Products** list and use **More actions → Add to
  collection(s)**.
- The order of products inside a collection in Shopify is the order on the store.

**Best Sellers** is special. It is the featured section at the top of the home
page, showing up to **eight** listings in the collection's order. Use it for
hand-picked highlights, not every product. If it is ever empty, the store shows
the actual best-selling products there instead.

**To create a new design collection:**

1. **Products → Collections → Create collection.**
2. Enter the **Title** customers will see. Add a **Description** if you want one
   under the section heading.
3. Choose **Manual** as the collection type.
4. In **Publishing**, add it to **Ryan Meetup Store Headless**. Without this, it
   does not appear on the store.
5. Save, then add products to it.

Its home page section appears automatically; sections are ordered alphabetically
by title. Don't give a collection the handle `all`, `apparel`, or `accessories`;
those addresses belong to the store's own Collections, Apparel, and Accessories
pages.

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
| Home page, top section | In the Best Sellers collection (up to eight shown) |
| Home page, collection sections | In that design collection (first four shown) |
| Home page, "More Ryan goods" | In no design collection |
| Collection page | In that collection |
| Combined with other products | Same `listing:` tag |

## Troubleshooting

| Problem | Check |
| --- | --- |
| Product doesn't appear anywhere | Status is Active, it's on the **Ryan Meetup Store Headless** channel, and 5 minutes have passed. |
| Missing from the Apparel or Accessories page | Product type is exactly `Apparel` or `Accessory`. |
| Shows under "More Ryan goods" | It isn't in a design collection yet. |
| Shows as its own card instead of joining a listing | It has the `listing:` tag, and the name after `listing:` matches the other products word for word. |
| Style option shows the whole title | The listing name isn't in the title exactly. Fix the title or the tag so they match. |
| Two Style options have the same name | Two products in the listing have titles that differ only in the listing name. Make the part after it unique. |
| Collection doesn't appear on the home page | It's on the **Ryan Meetup Store Headless** channel and has at least one product. |
| Wrong item printed or shipped | The product's Printful sync. Listings only change how products are displayed; they never change what Printful prints. |
