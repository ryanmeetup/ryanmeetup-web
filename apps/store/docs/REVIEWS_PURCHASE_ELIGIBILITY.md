# Exact-line review purchase checks

This implements the private Customer Account API boundary for checking a
selected order line. It does not open collection or prove the intended
installation's buyer/order permissions. Judge.me remains the default.

## Completed chunks and handoff

| Commit | Change | Verification |
| --- | --- | --- |
| `24cb311e` | Public shop API discovery, pinned/validated buyer-token transport, and the fixed purchase query. | 5 transport checks and offline Shopify Customer schema validation passed. |
| `c4dcaa0d` | Owned-order projection with independent bounded line/fulfillment pagination and exact fulfillment-line links. | 8 ownership/pagination checks passed. |
| `0d47d4eb` | Private exact-line eligibility plus session checks before and after an eligible lookup. | 7 rule checks and 6 runtime checks passed. Together with existing auth/renewal checks: 71 passed. Changed-file ESLint, TypeScript, diff check, and storefront production build passed. |

All buyer/provider data in these tests is synthetic. No migration, hosted
database, client credential, enable flag, or provider default was changed by
these purchase commits. Concurrent composer, submission, and buyer-management
files were left with their owner. The shared `REVIEWS_HANDOFF.md` has active
edits from that work; use this document for this checker's current handoff.

Next small chunks: a product-level order/line discovery adapter for
`findReviewablePurchases`, `findBuyerName`, and normalization into the numeric
shared backend contract. Then connect those hooks, complete the live Shopify
gate, and extend refund/edit evidence and child pagination as required.

Repeat the focused checks from `apps/store`:

```sh
npx playwright test tests/customer-account-api.spec.ts tests/customer-purchase-reader.spec.ts tests/customer-purchase-eligibility.spec.ts tests/customer-purchase-runtime.spec.ts --workers=1
npx tsc --noEmit
```

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

## Private eligibility entry point

`review-purchase.ts::getReviewPurchaseEligibility(request, { orderId, lineId,
productId })` loads/renews the opaque browser session, discovers the scoped
Customer API, reads the complete owned purchase, and evaluates the exact line.
Before returning an eligible attribution it rechecks the stored session, so a
sign-out during the lookup cannot return an eligible result. A future write
must call this server check again and enforce its own transactional session
authorization; a prior page result or browser-supplied purchase is not proof.

| Result | Meaning |
| --- | --- |
| `eligible` | Private attribution from Shopify for the selected owned line. No token, address, or email is returned. |
| `ineligible` | The requested order/line/product does not qualify, with a narrow reason. |
| `sign_in_required` | There is no active buyer session, including revocation during lookup. |
| `unavailable` | Provider/storage failure, incomplete facts, or an ambiguous eligibility case. |

The implemented initial subset is an uncancelled, unedited **paid order** with
a physical non-gift-card line, no refunded units on that line, and successful
fulfillment of all its units. Fulfillment quantities must point to that exact
line; success elsewhere in the order cannot qualify it. Multiple units still
produce one eligible line. A nullable variant remains attached to its verified
product; a missing product is never replaced using a browser hint.

`SUCCESS` means fulfilled, not proven delivered. Partial line fulfillment stays
ineligible until the remaining units qualify. Edited orders, refunded financial
statuses, refunded line quantities, unknown statuses/quantities, and inconsistent
overcounts stay unavailable. A refund after receipt is **not** permanently
disqualified: this query does not prove line-level refund/receipt chronology.
Resolve that evidence and policy through the live spike before opening writes.

## Integration and live gate

This is a keyed order/line checker, not the product-level list expected by
`review-purchases.ts::findReviewablePurchases`. That listing adapter and
`findBuyerName` are still pending. They must enumerate the buyer's orders,
reuse the owned exact-line checks, and normalize platform references into the
shared backend's numeric `ReviewPurchase` contract. Do not guess an order from
a product ID or fabricate buyer names. The concurrent composer/submission
work is preserved; this chunk does not replace those hooks or enable writes.

Before collection opens, configure the confidential client and isolated
backend, prove real buyer access with `customer_read_orders` and protected
customer data approval, and record redacted cases for other-account orders,
split fulfillment, edits/cancellations, and refunds before/after receipt.
Printful delivery-event behavior is still unproven. Local schema validation
and synthetic tests do not satisfy that installation-specific gate.

References: [Customer API discovery and authentication](https://shopify.dev/docs/api/customer/2026-10),
[Order](https://shopify.dev/docs/api/customer/2026-10/objects/Order),
[LineItem](https://shopify.dev/docs/api/customer/2026-10/objects/LineItem),
[FulfillmentLineItem](https://shopify.dev/docs/api/customer/2026-10/objects/FulfillmentLineItem).
