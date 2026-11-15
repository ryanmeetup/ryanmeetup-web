# Cancelling and refunding orders

How to cancel a store order and give the money back. Every product is
print-on-demand through Printful, so a cancellation touches two systems that
don't share a payment.

## Two separate payments

| Payment | Where it lives | How it comes back |
| --- | --- | --- |
| Shopper → store | Shopify Payments, at checkout | A refund in Shopify Admin. Nothing else returns it. |
| Store → Printful | Printful charges the store's card or Printful balance to make and ship the order | Cancelling the order in Printful before production starts |

Cancelling only in Printful leaves the shopper charged. Refunding only in
Shopify leaves Printful making and shipping the item, and still charging for
it.

## Why Shopify blocks the cancel

As soon as Printful accepts an order, Shopify shows its fulfillment as **In
progress** and **Cancel order** fails with "Unable to cancel order". The reason
is the "being fulfilled by a third-party service" line in that dialog. Start in
Printful instead.

## Steps

1. **Printful → Orders → open the order → Cancel.** This works only before the
   order enters production. If Cancel is unavailable, it's already being made:
   contact Printful support right away, and expect to pay for it anyway.
2. **Shopify Admin → Orders → open the order.**
   - If **More actions → Cancel order** now works, cancel with a refund and
     restock, and notify the shopper.
   - If it's still blocked, use **Refund** and refund the items and shipping.
     Refund works even when Cancel doesn't.
3. **Check Printful's charge came back** to the card or Printful balance.
4. **Tell the shopper**, if Shopify's notification didn't. All sales are final
   (see the refund policy), so a cancellation is an exception made by hand. Use
   the contact form's order link or reply to their order email.

## Costs

- Shopify Payments generally keeps its processing fee on a refund, so a
  cancelled order costs that fee.
- An order that already entered production also costs the Printful charge.

## Not yet confirmed

Check these the first time an order goes through this process, then update
this page:

- Whether cancelling in Printful releases Shopify's fulfillment hold, so that
  **Cancel order** works in step 2, or whether **Refund** is always needed.
- Whether Printful refunds to the card or to the Printful balance.
- Whether a cancellation that starts in Shopify reaches Printful at all. Printful
  says it does before fulfillment starts, but Shopify blocks the cancel once
  Printful has accepted the order, so that may only apply to orders on hold.

## Leaving time to cancel

By default Printful sends orders to production quickly. To get a window for
cancelling, turn on manual order approval or an approval delay in Printful's
store settings. The cost: every order waits until you approve it, or until the
delay runs out.

## Sources

- [Printful: managing orders from Shopify](https://help.printful.com/hc/en-us/articles/6148086204316-How-do-I-manage-order-processing-and-fulfillment-in-Shopify)
- [Printful: Can I edit or cancel orders](https://help.printful.com/hc/en-us/articles/15045269017500-Can-I-edit-or-cancel-orders)
