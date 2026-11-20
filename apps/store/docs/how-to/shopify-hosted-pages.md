# Shopify-hosted pages

Reviewed November 20, 2026. The November 15 record confirms light-scheme
wordmark branding and theme redirects. Current Admin settings and notification
templates were not inspected during this audit. The steps below maintain that
setup and identify the checks still needed.

The store is headless. Shoppers browse, review, and fill their cart on
`store.ryanmeetup.com`; Shopify only takes over for the parts that have to run on
Shopify:

| Lives on this app | Hosted by Shopify, styled in Admin | Never shown |
| --- | --- | --- |
| Catalog, product pages, sorting, sale prices | Checkout and payment | The Online Store theme at `checkout.ryanmeetup.com` (and `ryan-meetup-store.myshopify.com`) |
| Cart and cart drawer (Shopify's cart API) | Order confirmation and order status pages | |
| Reviews (stored in RMT) | Customer accounts (`shopify.com/71870054511/account`) | |
| About, Contact, policy pages | Notification emails | |

Three things keep Shopify's plain theme out of sight: the theme redirect, the
email links, and the checkout branding below.

## 1. Redirect the theme to the store

Shopify links to its own theme in places we don't control, such as the checkout
logo, "Continue shopping" after an order, and the store link in emails. This
snippet sends every theme page to the matching page here. Product, collection,
policy, and cart paths line up one to one; Shopify search goes to Shop All, while
Best Sellers and anything else go to the home page.

In Shopify Admin → **Online Store → Themes → ⋯ → Edit code**, paste it as the
first thing inside `<head>` in `layout/theme.liquid`, which renders theme
pages. With the recorded password-off setup, `layout/password.liquid` is not
shown; handle it separately if the password is turned back on.

```liquid
{%- comment -%}
  Headless redirect: the storefront is store.ryanmeetup.com, so every theme page
  sends the shopper to the same page there. The theme editor is left alone so the
  theme can still be previewed. Source: apps/store/docs/how-to/shopify-hosted-pages.md.
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
      {%- assign headless_path = '/collections/all' -%}
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

Check it by opening `https://checkout.ryanmeetup.com/collections/all` in a
private window: it should land on `https://store.ryanmeetup.com/collections/all`.

The last recorded setup had the password off and `checkout.ryanmeetup.com`
connected as Shopify's primary domain (`store.ryanmeetup.com` on Vercel), with
`ryan-meetup-store.myshopify.com` forwarding there. Recheck the redirect after
domain or theme changes, including deep links such as `/products/<handle>`.

Checkout, order status, and customer accounts don't use the theme, so the
redirect doesn't touch them.

## 2. Point the emails at the store

Shopify's notification emails link the store name and the **Visit our store**
button to `{{ shop.url }}`, the theme's domain. The redirect above catches those
clicks, but pointing them here directly skips the hop.

1. **Settings → Notifications → Customer notifications → Customize email
   templates**:
   - Logo: upload [the black wordmark](../assets/shopify/wordmark-black.png)
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

Use the checkout/accounts editor under **Settings → Checkout** (or the matching
configuration entry under Customer accounts). Shopify supports choosing a logo,
colors and fonts from the editor; advanced branding APIs require Plus. See
[Shopify's current style guide](https://help.shopify.com/en/manual/checkout-settings/customize-checkout-configurations/checkout-style).

The recorded November 15 result is the **light** scheme with the black wordmark
and Shopify's available heading font. Preserve that as the baseline rather
than treating the former aspirational dark/Cooper prompt as completed setup.
The Basic editor is not a workflow for uploading this repository's WOFF font.

- Use [wordmark-black.png](../assets/shopify/wordmark-black.png) on a light background
  (about 220px wide). Keep [wordmark-white.png](../assets/shopify/wordmark-white.png)
  for a deliberately chosen dark surface.
- Check contrast, form fields, buttons, logo links and policy links in the
  checkout, confirmation/order status and customer account pages.
- Preview changes before publishing and verify on a phone and desktop. Changing
  the Next.js theme does not change Shopify's hosted configuration.

## Verify the setup

- Verify today's theme redirects, including product/collection/policy/cart deep
  links and Continue shopping. Recheck after a theme replacement. The redirect
  snippet does not affect checkout or accounts, which do not use the theme.
- Verify every used notification template's logo and direct store links.
  Keep order-status and abandoned-checkout recovery destinations intact. Send
  clearly labelled test emails and inspect their links before claiming completion.
- Confirm the current hosted light-scheme branding and links on all three
  surfaces, rather than requesting unsupported custom font work.
- Complete the dated real order/notification check in the
  [roadmap](../planning/roadmap.md#4-shopify-and-printful-operating-setup). No new
  storefront implementation is needed for those Admin checks.

This guide's images are upload assets for Shopify; keep them with the procedure.
