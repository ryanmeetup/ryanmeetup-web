# Review purchase verification

Reviewed November 20, 2026 against `lib/customer-account`,
`custom-review-access.ts`, `custom-review-submission.ts` and suggestions.
This guide defines **verification**, not a buyers-only submission policy:
a signed-in person with no eligible matching line may submit an unverified
product review after a successful lookup. Provider/session failures never grant
that fallback. Judge.me and provider selection are no longer involved.

## Transport and ownership

`customer-account/api.ts` discovers `/.well-known/customer-account-api` from the
canonical shop, validates its shared Shopify host/numeric shop route and pins
queries to **2026-10**. A newer discovery version cannot change the schema.
Custom customer-account domains are not currently supported.

Queries send the buyer access token directly in Authorization, without a
Bearer prefix; no Admin token, client secret or browser cookie is sent. HTTPS,
redirect rejection, timeouts, response-size limits, no caching and echoed API
version checks apply. HTTP/GraphQL failures, partial errors and malformed data
remain unavailable rather than becoming an empty purchase history.

`purchase-reader.ts` compares the order's customer with the customer returned
under that same access token; an OpenID subject is not assumed to be a Customer
API ID. Foreign/missing/failed reads stay distinct. Only needed IDs, labels,
quantities/payment/fulfillment facts are projected, without addresses, email,
payment details or raw provider errors.

`review-lookups.ts` rereads/decrypts the scoped server session, ignores the
caller's old token and rechecks immutable identity/lifetime and current expiry
before and after lookups. Revocation, account changes or storage failure cannot
return eligible lines. Shopify GID resource kinds are checked, then numeric
identifiers remain strings, including 64-bit IDs.

## Exact-line verified-purchase rules

`evaluateReviewPurchase` requires an owned matching product/line with:

- an uncancelled, unedited order;
- a physical, nongift-card line with positive quantity;
- a paid order, or a partially refunded order where this line has no refunded units;
- successful fulfillment of **all units on this exact line**, not another line.

Multiple units produce one eligible review line. Nullable variants stay tied
to the verified product. Missing products and browser hints cannot fabricate
attribution. `SUCCESS` means fulfilled, not proven delivered. The query cannot
date refunds against receipt.

| Internal reason | Verification outcome |
| --- | --- |
| `unpaid`, `unfulfilled` | Not eligible yet; those facts may change. |
| `cancelled`, `not_physical`, `not_found`, `wrong_product` | No eligible matching line. |
| `refunded`, `edited`, `unverifiable` | No verified badge; a lasting reason is logged for investigation without buyer/order/product IDs. |
| Provider/storage failure, changed order/ownership, inconsistent session | Unavailable; do not open an unverified review as a substitute. |

The product lookup aggregates skipped lines into `none/not_shipped`,
`none/needs_help` or `none/not_purchased`. These are internal reason codes,
**not the current product composer's old blocking messages**. With a healthy
`none` result, the composer checks the unverified buyer/product uniqueness and
loads the buyer's name; if those succeed it offers unverified feedback.

## Bounded discovery and pagination

- Order discovery reads ten orders per page, newest ID first, up to ten pages.
  It reads up to fifty line references per order. Incomplete discovery returns
  unavailable, never a partial/empty success. No invented product filter is used.
- Candidate orders with matching/unknown product attribution or incomplete line
  references receive complete owned-order verification.
- Owned-order reads paginate lines (50) and fulfillments (10) independently,
  bounded to ten requests. Snapshot/customer identity, cursors, duplicates and
  quantities must stay consistent. Each fulfillment reads at most fifty child
  lines; another child page fails closed. Child pagination is not implemented.
- The whole lookup has a thirty-query budget. If later candidate verification
  exhausts it, already fully verified recent lines can survive with
  `history_limit`; with none, it returns `none/needs_help`. This differs from
  incomplete order discovery, which remains unavailable.

## Composer, writes and suggestions

The product composer excludes already reviewed eligible lines. If all eligible
lines were reviewed, it links to management rather than offering an unverified
bypass. Verified reviews are unique per shop/order/line; unverified reviews are
separately unique per shop/buyer/product. Withdrawn records can be resubmitted.

`POST /api/reviews` repeats session, product/purchase and selected-line checks.
If eligible purchases exist, one must be selected; a missing line is a conflict,
not unverified feedback. If none exists after a healthy lookup, the current
catalog supplies the unverified product snapshot. Public names come from the
Shopify profile and shared name-style rules. Every new revision awaits staff
approval, regardless of verification.

My reviews shows **Ready to review** suggestions from recent eligible purchases,
with order/variant/quantity/fulfillment context and links when available. It
omits reviewed lines and products no longer on the storefront. Failed suggestion
reads omit suggestions; they do not remove the independent My reviews list or
authorize a write. Each submitted suggestion is checked again.

Each purchase reminder offers **Dismiss**. The preference is saved per shop,
authenticated buyer and order line, so it survives sign-ins and devices. A
dismissed line stays out of the ready count until restored from the collapsed
**Dismissed** list; new purchases, including another purchase of the same
product, still appear. The buyer can still review a dismissed purchase from
its product page. Reviewed lines remain excluded from both reminder lists.
This is not a global review opt-out or an email unsubscribe; this flow sends
no review-request emails. A future request sender must honor these purchase
dismissals separately from any account-wide email preference.

`POST /api/reviews/suggestions` accepts only a line ID and `dismiss`/`restore`.
It checks origin, the current session and its viewer marker, verifies ownership
through recent eligible purchases before dismissal, and rechecks the session
before writing. Preference failures leave reminders unchanged with a retryable
error; failed preference reads omit suggestions rather than reshowing dismissals.

## Verification

Use the [operations rehearsal](../how-to/review-operations.md#live-lifecycle-rehearsal)
for real customer permissions and order-edge-case checks. Pagination extensions,
verification overrides and request-email planning are tracked in the
[roadmap](../planning/roadmap.md#14-store-reviews).

From `apps/store`, synthetic checks can run without a browser server:

```sh
STORE_BASE_URL=http://127.0.0.1:39999 npx playwright test tests/customer-account-api.spec.ts tests/customer-purchase-reader.spec.ts tests/customer-purchase-eligibility.spec.ts tests/customer-buyer-reader.spec.ts tests/review-purchase-lookups.spec.ts tests/custom-review-submission.spec.ts tests/review-suggestions.spec.ts --workers=1
```

See [authentication](review-authentication.md) for client/session setup and
[operations](../how-to/review-operations.md) for the live rehearsal. Shopify references:
[Customer Account API](https://shopify.dev/docs/api/customer/2026-10),
[Order](https://shopify.dev/docs/api/customer/2026-10/objects/Order),
[LineItem](https://shopify.dev/docs/api/customer/2026-10/objects/LineItem) and
[FulfillmentLineItem](https://shopify.dev/docs/api/customer/2026-10/objects/FulfillmentLineItem).
