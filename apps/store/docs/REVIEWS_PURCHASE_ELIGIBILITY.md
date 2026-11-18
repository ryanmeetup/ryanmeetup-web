# Exact-line review purchase checks

This implements the private Customer Account API boundary for checking a
selected order line. It does not open collection or prove the intended
installation's buyer/order permissions. Judge.me remains the default.

## Handoff

All buyer/provider data in these tests is synthetic, including the real-route
tests' remote storage responses. No migration, hosted
database, client credential, enable flag, or provider default was changed by
these purchase commits. Concurrent composer, submission, and buyer-management
files were left with their owner; the two existing lookup placeholders and
their related type aliases were completed here. The shared `REVIEWS_HANDOFF.md` has active
edits from that work; use this document for this checker's current handoff.

The product-level `findReviewablePurchases` and `findBuyerName` hooks are now
connected to this implementation, including typed platform-ID normalization
for the numeric backend contract. Next: complete the live Shopify gate and
extend refund/edit evidence and child pagination as required. Moderation,
media, and cutover remain separate workstreams in the main rebuild plan.

Repeat the focused checks from `apps/store`:

```sh
npx playwright test tests/customer-account-api.spec.ts tests/customer-purchase-reader.spec.ts tests/customer-purchase-eligibility.spec.ts --workers=1
npx playwright test tests/customer-buyer-reader.spec.ts tests/review-purchase-lookups.spec.ts tests/customer-account-backend.spec.ts --workers=1
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

## Eligibility rules

`purchase-eligibility.ts::evaluateReviewPurchase` judges one exact owned line.
Only an invalid shop configuration makes it `unavailable`. Every fact about the
order produces a verdict, so one unusual order cannot keep reviews "temporarily
closed" for a buyer indefinitely.

The implemented subset is an uncancelled, unedited **paid order** with a
physical non-gift-card line, no refunded units on that line, and successful
fulfillment of all its units. Fulfillment quantities must point to that exact
line; success elsewhere in the order cannot qualify it. Multiple units still
produce one eligible line. A nullable variant remains attached to its verified
product; a missing product is never replaced using a browser hint. A refund on
a *different* line (`PARTIALLY_REFUNDED` with this line fully refundable)
leaves this line eligible.

| Reason | Meaning | Buyer sees |
| --- | --- | --- |
| `unfulfilled`, `unpaid` | Can still change. `SUCCESS` means fulfilled, not proven delivered. | "No purchase to review yet" |
| `cancelled`, `not_physical`, `not_found`, `wrong_product` | Never reviewable. | "No purchase to review yet" |
| `refunded` | Any refunded unit on this line, or a fully refunded order. The query cannot date a refund against delivery, so a person decides. | "We need to check this order", with a contact link |
| `edited` | An order edit can move units between lines. | Same |
| `unverifiable` | A deleted product, an unknown financial or fulfillment status, a missing quantity, or an overcount. | Same |

The lookup collects these reasons across a product's lines and returns
`{ status: "none", reason }` with `not_shipped`, `needs_help`, or
`not_purchased`, preferring `not_shipped` because it resolves itself. It logs
lasting reason codes (`refunded`, `edited`, `unverifiable`, `history_limit`)
as `Review purchase lines need a person to check.` with no order, line,
product, or buyer identifier. `unavailable` is reserved for failures that can
succeed on retry: provider, storage, or session errors, and an order that
changes or switches owner mid-lookup.

## Integration and live gate

### Buyer and order discovery

`buyer-queries.ts` adds `ReviewBuyer` and `ReviewOrderCandidates`, both validated
offline against the pinned 2026-10 schema with telemetry disabled. Customer
names are protected customer data and still need the intended client's access.
The reader projects only the customer ID and nullable first/last names;
whitespace is normalized, and missing names are not fabricated.

The order query reads ten customer orders per page, sorted by descending ID,
with up to fifty line references each. The Customer API documents no product-ID
filter on `customer.orders`, so the code does not invent one. Order/name/customer
identity, duplicate IDs, and cursor progress are checked across the complete
bounded history. After ten pages it returns unavailable, never a partial or
empty success. Incomplete child line references are marked for complete
owned-order verification rather than silently skipped.

### Connected picker, submission, and buyer names

`review-purchases.ts` now delegates both existing hooks to
`customer-account/review-lookups.ts`, so the product composer, submission
route, and buyer-name changes in My reviews share the verified implementation.
The existing hook signatures and the rest of those features are preserved.

The adapter rereads the encrypted session by its private hash and compares
subject, creation time, absolute expiry, and revision before using the current
stored access token. Caller-supplied token fields are ignored. It checks the
session again after the lookup; revocation or a storage error cannot return
eligible purchases or names. Session loading/renewal remains the caller's
first step. The hash continuation is not a public authentication mechanism.

Candidate orders with a matching product, unknown attribution, or incomplete
line references are verified through the owned-order reader and the same
exact-line rules. The order's update timestamp and API customer must still
match discovery. The operation allows at most thirty Customer API requests. Orders are scanned
newest first, so when the budget runs out the lookup keeps the lines it has
already fully verified and records `history_limit`. With none found, that is
`none` with `needs_help`, because a long history is lasting rather than
transient. Ambiguous matching evidence still returns unavailable. A line whose
product was deleted no longer blocks the rest of its order.

Reference conversion accepts only the expected Shopify GID resource kind and
keeps numeric IDs as strings, including full 64-bit values. Labels are
normalized to the backend's length/whitespace contract; IDs and labels are
never invented from a product hint. Returned data contains verified purchase
snapshots and safe order/variant labels, without session tokens or customer
account IDs. The buyer-name hook returns the Customer API's nullable names,
and null on lookup/session failure. The shared display-name helper still owns
full-name, initial, and anonymous formatting.

End-to-end route tests exercise the real custom submission handler through
synthetic encrypted storage and Shopify responses. They verify a pending
`review.submit` command with the stored subject, owned purchase, and selected
public name, and no review command for an unowned line, provider failure, or
revocation. No production submission, credential, enable flag, or Judge.me
setting was changed.

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
