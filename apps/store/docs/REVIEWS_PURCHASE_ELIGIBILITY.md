# Exact-line review purchase checks

This implements the private Customer Account API boundary for checking a
selected order line. It does not open collection or prove the intended
installation's buyer/order permissions. Judge.me remains the default.

## Customer API transport

`lib/customer-account/api.ts` reads the canonical shop's public
`/.well-known/customer-account-api` endpoint without credentials. It validates
the returned shared Shopify host and numeric shop route before sending a
buyer token, and pins Customer Account queries to **2026-10**. A future latest
version in discovery does not silently change the query schema.

Public discovery for this shop on November 17, 2026 returned
`https://shopify.com/71870054511/account/customer/api/2026-10/graphql`.
Custom customer-account domains are not supported by this initial transport;
an unrecognized route stays unavailable. Do not broaden host acceptance without
proving the shop binding for the intended installation.

Queries send the buyer access token directly in the Authorization header,
without a Bearer prefix. They send no Admin credential, client secret, or
browser cookie. HTTPS, redirect rejection, timeouts, and uncached requests
apply. An echoed API version must match the pin when present. HTTP failures,
GraphQL errors (including partial data), malformed results, and oversized
responses remain unavailable and never become an empty purchase result.

`purchase-query.ts` owns the fixed `ReviewPurchase` operation. It was validated
against the skill's bundled **2026-10** Customer schema with
`OPT_OUT_INSTRUMENTATION=true` in the normal network-restricted sandbox.
This is offline validation: no private query or TypeScript source was uploaded.
It does not establish live permissions or order semantics.

References: [Customer API discovery and authentication](https://shopify.dev/docs/api/customer/2026-10),
[Order](https://shopify.dev/docs/api/customer/2026-10/objects/Order),
[LineItem](https://shopify.dev/docs/api/customer/2026-10/objects/LineItem),
[FulfillmentLineItem](https://shopify.dev/docs/api/customer/2026-10/objects/FulfillmentLineItem).
