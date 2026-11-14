# Catalog webhook

`POST /api/webhooks/shopify` expires the shared Shopify catalog cache after a
signed product, collection, inventory, or publication event. The next request
fetches fresh catalog data; the handler does not eagerly rebuild every page or
update an already-open browser tab. Five-minute revalidation remains a fallback.

## Configure Shopify and Vercel

1. In Shopify Admin, open **Settings → Notifications → Webhooks**. Copy the
   signing secret shown for those subscriptions into `SHOPIFY_WEBHOOK_SECRET`
   in the Vercel **store** project's Production environment. This is a
   server-only value, separate from Storefront, Admin, and Judge.me tokens.
   For subscriptions created by an app instead, use that app's client secret.
   Use the matching secret for every subscription sent to this endpoint.
2. Deploy the source and environment change. The repository root's Vercel
   association belongs to the main site; target the project rooted at
   `apps/store`.
3. Create JSON webhook subscriptions to
   `https://<active-store-domain>/api/webhooks/shopify`. Use the domain actually
   attached to the store deployment; move the subscription URLs when the final
   domain launches. Select a supported stable webhook API version.
4. Subscribe to the topics below. Admin labels can differ from the API topic
   names. If a topic is unavailable in Notifications, register it through your
   Shopify app with the relevant permissions and matching signing secret.

| Changes | Topics |
| --- | --- |
| Products, prices, variants, tags, descriptions and images | `products/create`, `products/update`, `products/delete` |
| Collections and membership | `collections/create`, `collections/update`, `collections/delete` |
| Inventory availability and location connections | `inventory_levels/connect`, `inventory_levels/update`, `inventory_levels/disconnect` |
| Sales-channel product publication, when using app-managed subscriptions | `product_listings/add`, `product_listings/update`, `product_listings/remove` |
| Sales-channel collection publication, when using app-managed subscriptions | `collection_listings/add`, `collection_listings/update`, `collection_listings/remove` |

Listing subscriptions belong to the subscribing sales channel, so use the
storefront's channel app for those topics. Keep the fallback refresh if the
channel does not expose app-managed subscriptions. Preview environments should
only receive subscriptions from a development store, with its own matching
secret. Local testing needs a publicly reachable HTTPS tunnel and the local
`SHOPIFY_WEBHOOK_SECRET`.

## Verify delivery

Send a test product-update webhook from Shopify. Expect HTTP 200 with
`{"revalidated":true}`. Then warm a real product page, change a small piece of
catalog data in Shopify, confirm delivery, and reload the affected product,
collection, and home pages. The first request after delivery fetches fresh data.
Restore the catalog edit afterward. A synthetic signed request verifies the
endpoint but does not establish that Shopify subscriptions are configured.

The handler checks the SHA-256 HMAC against the **raw request bytes**, using a
constant-time comparison, before considering the topic. Missing configuration
returns 503; invalid/missing signatures return 401; a missing topic returns 400.
Unrelated signed topics return 200 with `{"revalidated":false}`. Cache failures
propagate as 500 so Shopify can retry. Duplicate deliveries are safe because
each one expires the cache rather than applying an event payload to local data.
No access tokens, signing secrets, or event payloads are logged.

References: [Shopify signature verification](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries),
[Shopify webhook topics](https://shopify.dev/docs/api/webhooks/latest).
