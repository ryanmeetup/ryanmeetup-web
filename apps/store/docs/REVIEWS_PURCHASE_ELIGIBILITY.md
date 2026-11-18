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

## Ownership, projection, and pagination

`purchase-reader.ts::readCustomerPurchase` compares `order.customer.id` to
`customer.id` returned under the same customer access token. It does not assume
that an OpenID subject equals a Customer API ID. Missing, unowned, and failed
lookups stay distinct. Order/customer data from an unowned order is not returned.
The reader projects only the IDs, item labels, and fulfillment/payment facts it
needs; it does not retain email, address, payment details, or raw error bodies.

Order lines and fulfillments paginate independently, at 50 lines and 10
fulfillments per request. Both the order snapshot and the current customer
must remain stable across pages. Duplicate IDs, stalled cursors, malformed
quantities, unknown fulfillment-line links, or a changed/disappeared order
stop the lookup. The reader makes at most ten requests.

Each fulfillment currently reads at most 50 child lines. If a child connection
has another page, or either outer connection exceeds the budget, the result is
unavailable. It never labels a truncated lookup as complete or reports that
the buyer bought nothing because a page was omitted. Extend child pagination
as a separate chunk if live orders require it.

References: [Customer API discovery and authentication](https://shopify.dev/docs/api/customer/2026-10),
[Order](https://shopify.dev/docs/api/customer/2026-10/objects/Order),
[LineItem](https://shopify.dev/docs/api/customer/2026-10/objects/LineItem),
[FulfillmentLineItem](https://shopify.dev/docs/api/customer/2026-10/objects/FulfillmentLineItem).
