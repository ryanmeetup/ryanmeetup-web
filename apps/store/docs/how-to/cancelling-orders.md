# Cancelling and refunding orders

Reviewed November 20, 2026 against the recorded store experience and current
Shopify/Printful help. The November 15 record says Ryan cancelled/refunded test
order #1001. Its detailed fulfillment-hold release and accounting sequence was
not recorded, so the verification items below remain open.

## Two separate payments

| Payment | Where to resolve it |
| --- | --- |
| Shopper → store | Shopify order cancellation/refund to the shopper. |
| Store → Printful | Printful cancellation and its separate fulfillment charge/refund. |

Cancelling in Printful does not cancel/refund the connected Shopify order.
A Shopify refund alone does not prove fulfillment stopped. Verify both systems
before reporting a successful cancellation.

## Procedure

1. Open both order records and check current fulfillment/payment status. Stop
   production first where possible. For an accepted Printful order, cancel in
   Printful while it is still waiting for fulfillment. Printful's current guide
   sends this refund to the Printful Wallet for account holders.
2. In Shopify, use cancellation with the intended refund/notification choices
   when available. If third-party fulfillment blocks cancellation, check the
   fulfillment/cancellation-request status rather than assuming it propagated.
   A separate Shopify refund may be needed to return the shopper's payment.
3. Confirm the item/shipping refund amounts, Shopify transaction/timeline and
   Printful order/payment history. Avoid a second refund if one already exists.
4. Notify the shopper with the verified outcome. If production already started,
   do not promise a Printful refund or say a Shopify refund stopped shipment.

Shopify-origin cancellations can reach Printful **before** fulfillment starts;
a cancellation request may be rejected after it starts. This is not a guarantee
that cancelling from either screen alone finishes both halves. Consult the
current provider status and policy for the order.

## Cost and fulfillment limits

Printful's current cancellation window ends when fulfillment starts; later
support assistance does not guarantee a fulfillment refund. Shopify Payments
retains the original card-processing fee when an order is refunded. Check the
actual balances rather than assuming the two systems' refunds match.

The Store's published refund policy remains the source for buyer-facing terms.
This is an operating procedure, not a new cancellation/returns promise.

## Record the outcome

- After cancellation, record whether Printful releases this integration's Shopify
  fulfillment hold or whether a separate cancellation/refund step is needed.
- Reconcile the Printful Wallet credit and any withdrawal separately from the
  Shopify shopper refund on a real completed case.
- Decide whether manual approval is wanted. Printful supports manual confirmation
  of imported orders, but every held order then needs approval before production.
  This audit did not change that setting or establish a current approval delay.

## Sources

- [Printful: change/cancel submitted orders](https://help.printful.com/hc/en-us/articles/50260948753297-Can-I-change-or-cancel-my-order-after-submitting-it)
- [Printful: Shopify order processing](https://help.printful.com/hc/en-us/articles/50262336933137-How-do-I-manage-order-processing-and-fulfillment-in-Shopify)
- [Printful: manual approval](https://help.printful.com/hc/en-us/articles/50262235051153-Can-I-review-my-automatically-synced-orders-in-Printful-before-they-are-confirmed)
- [Shopify: cancelling orders](https://help.shopify.com/en/manual/fulfillment/managing-orders/canceling-orders)
- [Shopify Payments: refunds and fees](https://help.shopify.com/en/manual/payments/shopify-payments/payouts/refunds)
