# Judge.me authentication diagnostic

## Resolved — 2026-11-06

The tokens were valid. The owner supplied the exact domain from Judge.me's
token modal: **`9mf9bm-3f.myshopify.com`**. The app had instead sent
`ryan-meetup-store.myshopify.com`, which works for Shopify's catalog API but
does not authenticate with these Judge.me tokens. An earlier alternate-domain
probe used `9mf9bm-m3f.myshopify.com`, which is a different hostname.

The same private token now returns **200** for `/shops/info`, `/reviews/count`,
`/settings`, product lookup, and published review reads. The public widget API
also returns **200** with the existing public token. The successful shop-info
request ID is `a93dd34a-fafa-41c5-88ff-68c873459640`.

Verified account state: Judge.me shop ID `3678462`, Shopify platform, Basic/free
plan (`awesome=false`), zero reviews, automatic publication enabled, review
pictures enabled, and review videos enabled. Shopify product `15599257190511`
successfully resolves to Judge.me product `2326714750`.

The source now uses `JUDGEME_SHOP_DOMAIN` for both review reads and the separate
web-review submission route, falling back to `SHOPIFY_STORE_DOMAIN` only when
the override is absent. Local `.env.local` contains the correct override.
Shopify's working domain and all token values are unchanged. The same domain
override has been saved and read back successfully in the Vercel `store`
project's Production and Preview settings. A fresh deployment containing the
source change is still required. During the commit/push preparation, both
verified tokens were also synced to Production and Preview as sensitive values.

No support escalation or token replacement is needed for the resolved 401.
No review or order was created. A fulfilled-order review/photo test remains.

## Historical failed requests

The support draft below is retained as history; do not send it as an unresolved
authentication issue.

Read-only checks on **2026-11-05**. No token values are included. No support
message, review, or order has been submitted by this diagnostic.

## Message to paste into Judge.me support

Our Shopify store is `ryan-meetup-store.myshopify.com` (Shopify shop ID
`71870054511`). Judge.me is installed. The store owner confirms that the public
and private API tokens in our local configuration match **Settings →
Integrations → View API tokens** for this store.

Both tokens are rejected. We reproduced the private-token failure outside our
Next.js app, including with curl. The environment file parses successfully;
there are no duplicate definitions, surrounding whitespace, or masked values.

The following request uses the private-token header and shop-domain query
parameter documented in your current OpenAPI specification:

```http
GET https://judge.me/api/v1/shops/info?shop_domain=ryan-meetup-store.myshopify.com
X-Api-Token: [REDACTED PRIVATE TOKEN]
```

At **2026-11-05 20:56:46 UTC**, the response was:

```text
HTTP 401
Failed to authenticate. Shop domain or Api Token is wrong
x-request-id: ea17f7a5-e179-4365-86d3-a2d2279c361d
```

Private requests to both `judge.me` and `api.judge.me`, using the documented
header and the previously documented `api_token` query format, return 401.
Product lookup, review reads, and settings reads also fail authentication.

The public token also returns 401 from the documented CDN widget endpoint:

```text
GET https://cdn.judge.me/api/v1/widgets/product_review
shop_domain=ryan-meetup-store.myshopify.com
external_id=15599257190511
api_token=[REDACTED PUBLIC TOKEN]
x-request-id: 06db7f73-0504-4847-9163-5b72951b1d94
```

Please check the backend association between this shop/domain and its displayed
API tokens, whether API access is active or restricted for this shop, and the
authentication format your service expects. If the domain shown above differs
from the domain registered with your API, please identify the correct one.
We have not established that this is a subscription-plan issue.

## What this establishes

- Judge.me rejects the configured shop/token pair independently of our form,
  Next.js runtime, and environment loader. Its generic 401 does not identify
  which account-side condition causes the rejection.
- Shopify's Storefront API successfully reads the shop and catalog. Its saved
  customer-account menu includes **My Reviews**.
- This API failure does not prove the installed Shopify account extension is
  unable to collect reviews. We have no fulfilled order to test that flow yet.
- Storefront review reads currently fall back to an empty section on provider
  failure. An empty section is therefore not proof that there are zero reviews.

## After support resolves access

Retry a private read before changing production credentials. If support issues
replacement tokens, update the local file and the store project's appropriate
Vercel environments, then build a fresh deployment. Do not use the repository
root's default Vercel project, which belongs to the main Ryan Meetup site.

Validate one controlled purchase-linked review, including photo upload,
publication, storefront display, and editing through **My Reviews**. Judge.me's
public create API is unsuitable for disposable test reviews: its documentation
says API-created reviews cannot be deleted.

References: [OpenAPI specification](https://judge.me/api/docs.yaml),
[API help](https://judge.me/help/en/articles/8409180-using-judge-me-api),
[customer-account widgets](https://judge.me/help/en/articles/10174105-customer-accounts-widgets).
