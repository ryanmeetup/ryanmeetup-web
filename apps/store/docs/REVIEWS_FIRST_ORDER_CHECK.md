# Reviews: first fulfilled-order check

A one-time checklist for when test order **#1002** (one Ryan Meetup Pin Set #2,
2.25″, placed November 14, 2026) is fulfilled and ships. It answers whether
Judge.me's free plan meets the review goal. Record the results in
[roadmap item 14](LAUNCH_ROADMAP.md#14-shop-wide-reviews-and-buyer-only-reviews),
then delete this file and log it there.

## The goal and the setup being tested

**Goal (Ryan).** Only buyers can review, and only products they bought. Nobody
else can get a review published.

**Setup.** We stay on Judge.me's free plan; the $15/month plan is ruled out.
Buyers review from their Shopify customer account, using Judge.me's **Write a
new review** button on each order. That button is installed and was greyed out
on #1002 while the order was only Confirmed. Judge.me's **View my reviews** tab
in the account menu shows "There's a problem loading this page", apparently
because it includes a store-wide review that needs the paid plan.

**How the storefront reads reviews.** `lib/reviews.ts` looks up the Judge.me
product by its Shopify product ID and reads up to 20 published reviews with the
private API, cached for five minutes. It shows only reviews where `hidden` is
false **and** `curated` is `ok`. A review that's still waiting for moderation
won't appear, even though Judge.me has it. The documented verified statuses
(`confirmed-buyer`, `buyer`, `verified-purchase`, `semi-verified-purchase`,
`customer-account`, and `admin`) show a "Verified review" badge. Account
authentication and manual verification do not necessarily prove a purchase,
so the badge does not claim that. The product page also adds
`aggregateRating` to its JSON-LD from those same reviews.

## Before starting

- [ ] Shopify shows #1002 as **Fulfilled**. Printful marks it when it ships.
- [ ] #1001 is cancelled and refunded, so it doesn't muddy the order list
      ([CANCELLING_ORDERS.md](CANCELLING_ORDERS.md)).

## 1. The order's review button

- [ ] On #1002 in the customer account, **Write a new review** is enabled.
- [ ] It offers Pin Set #2 and nothing else.
- [ ] The same button works from the orders list, not only the order page.
- [ ] Submit a real review: a star rating, text, and one photo. This is
      the only review to create. Don't post test reviews through Judge.me's API:
      API-created reviews can't be deleted.

If the button stays greyed out after fulfillment, check whether it waits for
delivery rather than fulfillment before concluding the free plan lacks it.

## 2. Judge.me admin

- [ ] The review is attributed to Pin Set #2 (the right Shopify product), not
      another product in its listing.
- [ ] It's marked **Verified buyer**.
- [ ] Note its publication status: published straight away, or waiting
      for approval. Waiting means it won't show on the storefront yet (see
      `curated` above).
- [ ] The photo is attached and visible.
- [ ] Note which moderation settings exist on the free plan. The goal needs
      reviews that aren't from verified buyers to stay unpublished, because
      Judge.me's own submission endpoint takes reviews from anyone.
      Write down the exact setting names and what they're set to.

## 3. The storefront

Allow five minutes after publication for the cache.

- [ ] The review appears on the Pin Set #2 product page, and on the listing
      page if the pin set is grouped with others.
- [ ] Rating, text, reviewer name, date, and the verified badge are correct.
- [ ] The photo shows as a thumbnail and opens enlarged.
- [ ] The summary shows one review at the right rating.
- [ ] The page's JSON-LD has `aggregateRating` with `reviewCount` 1.

## 4. Editing

- [ ] Find out whether a buyer can edit the review without the broken **View
      my reviews** page, for example by reopening the order's button.
- [ ] If an edit is possible, it reaches Judge.me and then the storefront.

## 5. Review request email

- [ ] Judge.me sends a review request after fulfillment or delivery. Note
      the delay and the setting that controls it (Judge.me → Settings → Review
      requests).
- [ ] Its link opens a review for Pin Set #2.
- [ ] Following it after already reviewing doesn't create a duplicate. Note
      what happens.

## 6. Decisions this should settle

- **Free plan or not.** If steps 1–3 pass, the free plan meets the goal; say so
  in item 14.
- **View my reviews.** Remove it from the customer account menu if it still
  errors, unless step 4 shows buyers need it to edit.
- **Product-page button.** It currently sends everyone to
  `/account/orders` with no explanation. Proposed: a note such as "Bought this?
  Once it arrives, we'll email you a review link, or you can review it from your
  order", linking to the orders page (`components/reviews.tsx`). Awaiting
  Ryan's approval.
- **`POST /api/reviews`.** It forwards anyone's review to Judge.me unverified,
  which contradicts the goal. Removing it also removes the demo-mode review
  form and its tests. Awaiting Ryan's approval.
- **Pending moderation.** If verified reviews wait for approval, decide whether
  to auto-publish verified buyers or keep approving by hand.
