# Judge.me removal checklist

Production switched to custom reviews on November 20, 2026, by setting
`REVIEWS_PROVIDER=custom` on the store's Vercel Production environment and
redeploying. Judge.me code and credentials were deliberately left in place so
the switch can be undone by setting `REVIEWS_PROVIDER=judgeme` (or removing it)
and redeploying. Rolling back hides any custom reviews collected since the
switch (they stay in RMT) and brings back Judge.me's.

Use this list for the final cut-over, once custom reviews have run in
production long enough that rolling back is no longer wanted. Remove items in
the order below so each commit still builds and passes its tests.

## Before deleting anything

- [ ] **Decide what happens to existing Judge.me reviews.** Since the switch,
      product pages show only custom reviews from RMT, so published Judge.me
      reviews and their rating totals no longer appear (including in product
      JSON-LD). Either import them into `store_reviews` (no import exists yet:
      they have no verified order line, so they would arrive as reviews
      without a matching order) or accept losing them, and export a copy from
      Judge.me first either way.
- [ ] Confirm nobody still relies on the localhost **Review mode** switch to
      compare Judge.me and custom side by side.

## Code that only exists for Judge.me

Delete outright:

- `lib/judgeme.ts`: Judge.me shop-domain helper.
- `lib/judgeme-reviews.ts`: Judge.me review reads.
- `tests/judgeme-domain.spec.ts`, and the Judge.me cases in
  `tests/reviews-data.spec.ts`, `tests/reviews-api.spec.ts`,
  `tests/review-collection.spec.ts` and `tests/review-provider.spec.ts`.

Simplify:

- `lib/reviews.ts`: drop the Judge.me branch; always read custom reviews.
- `app/api/reviews/route.ts`: drop the Judge.me submission branch, which
  forwards an anonymous name/email review to Judge.me, or returns 410 in a
  pending uncommitted change. Keep only the custom submission path.
- `components/reviews.tsx`: remove the legacy anonymous review form (the
  `emptyDraft`/`submitReview` modal with name and email fields) and the
  `reviewAccount` branches that link to the Shopify account for Judge.me.
  `customAccess` then becomes required.
- `lib/review-collection.ts` (`getReviewAccount`) and the `reviewAccount` prop
  threaded through `app/products/[handle]/page.tsx` and
  `components/product-group-detail.tsx`: only Judge.me mode uses them.
- `lib/review-provider.ts`: remove the `judgeme` provider and its default.
  Once only one provider is left, `REVIEWS_PROVIDER`, `getReviewProvider`,
  `resolveReviewProvider`, `getActiveReviewProvider` (`lib/review-preview.ts`)
  and their callers can go, including the provider checks in
  `app/api/account/route.ts`, `app/api/reviews/mine/route.ts`,
  `app/reviews/mine/page.tsx` and `app/products/[handle]/page.tsx`.
- `components/review-mode-switch.tsx`, `lib/review-preview.ts`, the
  `/api/reviews/preview` route, `REVIEWS_PREVIEW_ENABLED`, and their tests
  (`tests/review-mode-switch.spec.ts`, `tests/review-preview-api.spec.ts`):
  the localhost switch exists only to flip between the two providers.
- `lib/review-photo-hosts.ts` and its use in `next.config.ts` image hosts and
  `lib/custom-reviews.ts`: the allowed hosts are Judge.me's image CDNs. Keep the
  mechanism only if custom review photos will use their own host, then replace
  the list.

Tests and configs that pin Judge.me for isolation: remove the `JUDGEME_*`
blanks and the `REVIEWS_PROVIDER` pin from `playwright.config.ts`,
`playwright.my-reviews.config.ts` and `playwright.product-reviews.config.ts`
once the provider setting is gone.

## Settings and services

- [ ] Vercel (`teamryan/store`, every environment): delete `JUDGEME_SHOP_DOMAIN`,
      `JUDGEME_PUBLIC_TOKEN`, `JUDGEME_PRIVATE_API_TOKEN`, then
      `REVIEWS_PROVIDER` and `REVIEWS_PREVIEW_ENABLED` once the code no longer
      reads them.
- [ ] `apps/store/.env.example` and local `.env.local` files: remove the same keys.
- [ ] Shopify Admin: uninstall the Judge.me app after exporting its reviews.
- [ ] Revoke the Judge.me private API token in Judge.me.

## Docs to update at the same time

`README.md` (reviews section), `docs/LAUNCH_ROADMAP.md`,
`docs/REVIEWS_REBUILD.md`, `docs/REVIEWS_RELEASE.md`,
`docs/REVIEWS_OPERATIONS.md` and `docs/SHOPIFY_HOSTED_PAGES.md` all describe
Judge.me as a live or fallback provider. The older handoff docs
(`REVIEWS_HANDOFF.md` and friends) are history; leave them.
