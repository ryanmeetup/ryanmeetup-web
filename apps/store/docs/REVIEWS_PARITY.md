# Review-system parity and next steps

Updated 2026-11-06. Ryan explicitly chose to **keep Judge.me**, using whole-star
individual reviews and fractional averages. No replacement review database is
being introduced.

## Current local implementation

- With Shopify configured, **Write a review** links to Shopify customer
  accounts for Judge.me's purchased-item review form and media hosting. The
  saved account navigation includes **My Reviews**. This local handoff is not
  deployed and has not been tested with a fulfilled order.
- Product-context modal, controlled draft, required rating/body/identity fields,
  accessible pending/error/success states, and fixed mobile footer actions.
- Whole-star selection with pointer previews and native keyboard controls.
  Keyboard focus outlines the whole star; pointer selection adds no focus box.
  Fractional averages retain partial fills.
- Up to five photo selections: JPG, PNG, or WebP, 10 MB per source. The browser
  decodes, resizes to at most 1600px on the longest edge, and re-encodes JPEGs
  under 700 KiB each. This removes source EXIF metadata and bounds the combined
  photo payload below 3.5 MB. Server-side validation is still required.
- Preview/remove/reselect photos, preserve them on modal close/reopen, discard
  them on product change or successful submission, and release preview URLs.
- The demo composer retains prepared photo transport, but its chooser is hidden.
  The separate API forwards unverified JSON web reviews; multipart requests
  return 415 until custom photo hosting exists. No custom upload is persisted.
- Provider reads expose only published reviews and explicitly visible photos
  from the allowed Judge.me hosts. Cards offer thumbnails and an accessible
  enlarged-photo dialog. Existing credentials now authenticate successfully with
  the correct `JUDGEME_SHOP_DOMAIN=9mf9bm-3f.myshopify.com`; catalog settings remain
  independent. Live account/product/review/settings reads return 200.

## Supported Judge.me direction

Judge.me's create API only accepts whole ratings 1–5. It takes hosted photo
URLs rather than file bytes and cannot assign verified status or edit review
content. These are integration limits, not features solved by a custom modal.
[API reference](https://judge.me/api/docs),
[API media/verification constraints](https://judge.me/help/en/articles/8409180-using-judge-me-api).

The preferred first integration to validate is Judge.me's Shopify
customer-account popup: it reviews fulfilled purchased items, accepts media,
and provides a review-management page. Judge.me handles photo hosting through
its own form. This does not by itself establish provider-wide buyer-only access;
other web-review paths/settings must also be audited.
[Customer-account widgets](https://judge.me/help/en/articles/10174105-customer-accounts-widgets).

If collection must remain in our custom product-page composer, an authenticated
hosting/collection bridge is still needed. Authorize the purchased product
before accepting uploads; validate actual file contents, decoded dimensions,
counts, and sizes on the server; isolate pending media; clean up abandoned or
rejected uploads; and publish only approved media. Do not expose service tokens
or bypass purchase checks. This needs photo storage, not necessarily a second
review database. No storage provider has been selected.

## Remaining product work

| Priority | Capability | What remains |
| --- | --- | --- |
| Launch | Purchase-linked collection | Restore provider access; validate a real signed-in purchase through Judge.me's supported flow. Resolve grouped product/variant attribution and duplicate submissions. Autofill identity from the authenticated customer. |
| Launch | Persistent photos | Connect supported hosting/collection and test publish/hide/delete behavior. Current chooser and multipart transport are local only. |
| Launch | Accurate summary | Replace the current first-20-review count/mean with complete provider totals. Keep visible counts, aggregates, and JSON-LD consistent. |
| Launch | Moderation and recovery | Confirm publication settings, media visibility, retries, duplicate handling, and customer-visible submission status. |
| Next | My reviews and edits | Connect Judge.me's customer management flow rather than attempting unsupported API content edits. |
| Next | Review discovery | Rating distribution, sorting, pagination, photos-only filtering, and useful loading/empty states. |
| Next | Seller responses and reports | Render public responses through a supported provider surface and provide a reporting/moderation path. |
| Next | Post-purchase requests | Configure delivery-aware review reminders and links that resume the correct item. Avoid duplicate or mistimed requests. |
| Later | Video and subratings | Evaluate Judge.me's own media form for video. Decide whether quality, shipping, service, or fit ratings help this store. |

Etsy's documented flow ties reviews to account purchases, allows photo/video
attachments and category ratings, and permits edits during a delivery-based
100-day window until a seller responds. Those window/locking rules are product
choices here, not requirements to copy automatically.
[Etsy buyer flow](https://help.etsy.com/hc/en-us/articles/115013197687-How-to-Leave-a-Review-on-Etsy).
Public responses and confidential reporting also need a supported path.
[Etsy seller responses](https://help.etsy.com/hc/en-us/articles/115015808588-What-to-Do-if-You-Receive-a-Negative-Review),
[Etsy reporting](https://help.etsy.com/hc/en-us/articles/360000442208-How-to-Report-a-Review).

## Remaining integration checks

- The domain mismatch is resolved locally, and `JUDGEME_SHOP_DOMAIN` is saved
  and verified in Vercel Production/Preview. A deployment containing this source
  change is still needed. Both verified tokens are now synced to Production and
  Preview as sensitive values. See
  [the resolution record](JUDGEME_AUTH_DIAGNOSTIC.md).
- `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` is absent locally. This is required only
  for a custom storefront authentication flow; Shopify-hosted customer-account
  widgets use their own supported setup. Inspect the existing account widgets
  before introducing a custom authentication bridge.
- Validate the actual headless integration and account plan. The external
  storefront widget path is documented for the Awesome plan; no upgrade has
  been authorized or made.
  [Headless widget support](https://judge.me/help/en/articles/8394958-platform-independent-widgets).

See [REVIEWS_SETUP.md](REVIEWS_SETUP.md) for exact admin navigation. A real
signed-in purchase and photo submission are required before claiming this is
production ready.
