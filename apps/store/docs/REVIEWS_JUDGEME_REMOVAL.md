# Judge.me removal record

Production switched to custom reviews on November 20, 2026. Later that day
Ryan decided to remove Judge.me outright rather than keep it as a rollback:
**its reviews were not exported or imported**, and there is no way back to
them once the app is uninstalled.

## Done in code (November 20, 2026)

- Deleted the Judge.me read path (`lib/judgeme.ts`, `lib/judgeme-reviews.ts`)
  and its tests.
- Removed the `REVIEWS_PROVIDER` setting and everything that existed to choose
  a provider: `lib/review-provider.ts`, `lib/review-preview.ts`,
  `lib/review-collection.ts`, the localhost **Review mode** control and its
  `/api/reviews/preview` route, and `REVIEWS_PREVIEW_ENABLED`. Custom reviews
  are the only reviews; nothing reads either variable any more.
- Removed the legacy anonymous review form (name and email fields) from the
  product page. Without buyer sign-in, **Write a review** is disabled with an
  explanation.
- `POST /api/reviews` now always takes the custom, signed-in submission path.
- The account status no longer reports whether custom reviews are active;
  **My reviews** shows for every signed-in buyer.
- Dropped the `JUDGEME_*` and `REVIEWS_PROVIDER` blanks from the Playwright
  configs and `.env.example`.

**Kept on purpose:** `lib/review-photo-hosts.ts` still lists Judge.me's image
CDNs and filters public review photo URLs. It belongs to the review photo
work: replace the list with the custom photo host when public photos ship.

## Settings and services (Ryan)

- [ ] Shopify Admin: uninstall the Judge.me app. This also removes its
      **Write a new review** button from customer-account order pages.
- [ ] Vercel (`teamryan/store`, every environment): delete
      `JUDGEME_SHOP_DOMAIN`, `JUDGEME_PUBLIC_TOKEN`,
      `JUDGEME_PRIVATE_API_TOKEN`, `REVIEWS_PROVIDER` and
      `REVIEWS_PREVIEW_ENABLED`. The code ignores them, so this is tidying, not
      a deploy blocker.
- [ ] Local `apps/store/.env.local`: remove the same keys.
- [ ] Shopify Admin → Sales channels → Shop: turn off Shop product reviews and
      the Shop feedback-request email, so the **Leave review with Shop** button
      stops competing with the store's reviews.

## History

The older handoff docs (`REVIEWS_HANDOFF.md` and friends) and the rollback
sections of `REVIEWS_RELEASE.md` and `REVIEWS_REBUILD.md` describe the
Judge.me era. Returning to Judge.me is no longer possible.
