# Shopify-hosted pages

The store is headless. Shoppers browse, search, review, and fill their cart on
`store.ryanmeetup.com`; Shopify only takes over for the parts that have to run on
Shopify:

| Lives on this app | Hosted by Shopify, styled in Admin | Never shown |
| --- | --- | --- |
| Catalog, product pages, search, sorting, sale prices | Checkout and payment | The Online Store theme at `ryan-meetup-store.myshopify.com` |
| Cart and cart drawer (Shopify's cart API) | Order confirmation and order status pages | |
| Reviews (Judge.me, server-side) | Customer accounts (`shopify.com/71870054511/account`) | |
| About, Contact, policy pages | Notification emails | |

Three things keep Shopify's plain theme out of sight: the theme redirect, the
email links, and the checkout branding below.

## 1. Redirect the theme to the store

Shopify links to its own theme in places we don't control, such as the checkout
logo, "Continue shopping" after an order, and the store link in emails. This
snippet sends every theme page to the matching page here. Product, collection,
policy, search, and cart paths line up one to one; Best Sellers and anything else go to the home
page.

In Shopify Admin → **Online Store → Themes → ⋯ → Edit code**, paste it as the
first thing inside `<head>` in **both** files:

- `layout/theme.liquid`, which renders every normal page;
- `layout/password.liquid`, which renders the password page. While the store
  password is on, every theme request lands here, so it can only send shoppers
  to the home page.

```liquid
{%- comment -%}
  Headless redirect: the storefront is store.ryanmeetup.com, so every theme page
  sends the shopper to the same page there. The theme editor is left alone so the
  theme can still be previewed. Source: apps/store/docs/SHOPIFY_HOSTED_PAGES.md.
{%- endcomment -%}
{%- unless request.design_mode -%}
  {%- assign headless_path = '/' -%}
  {%- case request.page_type -%}
    {%- when 'product' -%}
      {%- assign headless_handle = product.handle | url_encode -%}
      {%- assign headless_path = '/products/' | append: headless_handle -%}
    {%- when 'collection' -%}
      {%- comment -%} Best Sellers (frontpage) is the store's home page section, not its own page. {%- endcomment -%}
      {%- unless collection.handle == 'frontpage' -%}
        {%- assign headless_handle = collection.handle | url_encode -%}
        {%- assign headless_path = '/collections/' | append: headless_handle -%}
      {%- endunless -%}
    {%- when 'list-collections' -%}
      {%- assign headless_path = '/collections/all' -%}
    {%- when 'policy' -%}
      {%- assign headless_path = request.path -%}
    {%- when 'search' -%}
      {%- assign headless_path = '/search' -%}
      {%- if search.terms != blank -%}
        {%- assign headless_terms = search.terms | url_encode -%}
        {%- assign headless_path = '/search?q=' | append: headless_terms -%}
      {%- endif -%}
    {%- when 'cart' -%}
      {%- assign headless_path = '/cart' -%}
  {%- endcase -%}
  {%- assign headless_url = 'https://store.ryanmeetup.com' | append: headless_path -%}
  <meta name="robots" content="noindex">
  <link rel="canonical" href="{{ headless_url }}">
  <meta http-equiv="refresh" content="0; url={{ headless_url }}">
  <script>window.location.replace({{ headless_url | json }});</script>
{%- endunless -%}
```

Check it by opening `https://ryan-meetup-store.myshopify.com/` in a private
window: it should land on `https://store.ryanmeetup.com/`.

Once the snippet is in `layout/theme.liquid`, the store password can come off
without anyone seeing the theme, and deep links such as
`/products/ryan-name-tag-mug` then reach the same product here instead of the
home page. Turning the password off needs a paid Shopify plan. Checkout,
order status, and customer accounts don't use the theme, so the redirect doesn't
touch them.

## 2. Point the emails at the store

Shopify's notification emails link the store name and the **Visit our store**
button to `{{ shop.url }}`, the theme's domain. The redirect above catches those
clicks, but pointing them here directly skips the hop and works even while the
password page is up.

1. **Settings → Notifications → Customer notifications → Customize email
   templates**:
   - Logo: upload [`shopify-assets/wordmark-black.png`](shopify-assets/wordmark-black.png)
     (emails have a white background), width about 220px.
   - Accent color: `#000000`, matching the store's black buttons. The nametag
     red `#EE1A25` is too light for white button text.
2. Open each customer notification you use and choose **Edit code**. Search for
   `shop.url` and replace each `{{ shop.url }}` with
   `https://store.ryanmeetup.com`. The templates that normally have it:
   - Order confirmation, Order edited, Order invoice, Order canceled, Refund;
   - Shipping confirmation, Shipping update, Out for delivery, Delivered;
   - Abandoned checkout.
   Leave `{{ order_status_url }}` (the **View your order** button) and
   `{{ url }}` in Abandoned checkout alone: those open Shopify's order status
   page and the shopper's saved checkout, which is where they should go.
3. **Preview** and **Send test email** for Order confirmation and Shipping
   confirmation, then click every link in the test email.

## 3. Brand checkout and customer accounts

Checkout, the order status page, and customer accounts all take their look from
**Settings → Checkout → Customize** (the "Configurations → Customize" row under
Customer accounts opens the same editor). Shopify's assistant, Sidekick, can work
through it. Upload these to **Content → Files** first so it has them:

- [`shopify-assets/wordmark-black.png`](shopify-assets/wordmark-black.png) and
  [`shopify-assets/wordmark-white.png`](shopify-assets/wordmark-white.png);
- `packages/brand/COOPBL.woff`, the Cooper Black display face. Confirm the font
  license covers use on Shopify-hosted pages before uploading it; without it,
  use the closest Shopify font for headings.

Then give Sidekick this prompt:

> My store is headless. Customers shop at https://store.ryanmeetup.com and only
> see Shopify for checkout, the order status page, and customer accounts. Please
> make checkout and customer accounts match that site as closely as the checkout
> and accounts editor allows. List every change before publishing, and tell me
> which of these the editor can't do.
>
> - **Color scheme (dark, the site's default):** page background `#000000`;
>   order summary panel `#171717`; text `#FFFFFF`; secondary text `#B3B3B3`;
>   borders and dividers `#1A1A1A`; form fields `#111111` with `#333333`
>   borders.
> - **Primary buttons:** `#FFFFFF` background with `#000000` text; hover
>   `#E6E6E6`. Secondary buttons: transparent with a `#333333` border and white
>   text.
> - **Accents:** links and selected states `#FFFFFF`. Success and price green
>   `#17803D`. Errors `#EE1A25`.
> - **Corner radius:** 8px for buttons and fields; larger (16px) for cards and
>   the order summary if the editor allows.
> - **Typography:** headings in the uploaded Cooper Black file (`COOPBL.woff`);
>   body text in a plain sans-serif close to Helvetica or Arial. Keep headings
>   in title case; labels can stay as they are.
> - **Logo:** use the uploaded `wordmark-white.png` on dark sections (and
>   `wordmark-black.png` on any light one), left aligned, about 220px wide.
> - **Header and footer:** minimal. Show the logo in the header and the store
>   policies in the footer; no extra banners.
> - **Customer accounts:** apply the same colors, fonts, logo, and corner radius.

If dark checkout looks wrong next to the card fields, ask Sidekick for the light
version instead: background `#FFFFFF`, order summary `#F5F5F5`, text `#000000`,
secondary text `#4D4D4D`, borders `#E6E6E6`, primary buttons `#000000` with white
text, and `wordmark-black.png`.

Place a test order afterward and look at checkout, the confirmation page, the
order status page, and the account page on a phone and a laptop.
