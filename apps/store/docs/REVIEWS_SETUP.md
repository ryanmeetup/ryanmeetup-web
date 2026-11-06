# Purchase-linked reviews setup

## Current readiness check — 2026-11-06

This status supersedes earlier implementation/security snapshots below:

- Shopify catalog access works, and the saved customer-account menu contains
  **My Reviews**. Ryan reports completing the Judge.me account-extension setup.
- Configured product pages now link **Write a review** to Shopify customer
  accounts locally. Judge.me collects media and manages reviews there. Demo
  mode retains the custom composer; the separate JSON API route still forwards
  unverified web reviews and rejects multipart photos with 415.
- **Authentication is resolved.** Judge.me's modal lists
  `9mf9bm-3f.myshopify.com`; Shopify catalog access uses
  `ryan-meetup-store.myshopify.com`. Local `JUDGEME_SHOP_DOMAIN` now configures
  Judge.me independently for reads and web-review submissions. Existing tokens
  return 200 for private reads and the public widget; no tokens were replaced.
  See the [resolution record](JUDGEME_AUTH_DIAGNOSTIC.md).
- Live reads confirm zero reviews, automatic publication, pictures/videos
  enabled, and the Basic/free plan. A real Shopify catalog product matches its
  Judge.me product. A test submission has not been made.
- The domain override has been saved and verified in Vercel's `store` project
  for Production and Preview. Both verified Judge.me tokens are now synced to
  those environments as sensitive values; Shopify credentials were not changed.
  These local source changes
  still need deployment. The last verified production commit was
  `f0430b104eff978b52491adee8282a5d5313919d` on November 5.
- No fulfilled order exists yet, so sign-in → review/photo submission →
  publication → storefront display → editing has not been tested end to end.
  A custom Customer Account API client is not required for Shopify-hosted
  account extensions. No new database or photo-storage service is needed for
  that supported collection path.

Validation for this readiness check: 17 targeted helper/API/data tests pass,
including separate-domain reads/submission and legacy fallback coverage;
changed-file ESLint, TypeScript, and `git diff --check` pass. A clean isolated
store production build passes in demo mode (no credentials copied into the
build workspace). The review browser suite verifies 18 active scenarios; six
custom-upload scenarios remain skipped because that chooser is disabled.
One stale selected-rating text assertion was corrected and its check rerun
successfully. Ryan Meetup and RyanCon type checks pass with the shared controls.
Nine temporary Playwright checks verify the compiled account
handoff in light/dark themes at 390, 1024, 1280, and 1536px, successful navigation
to an intercepted account fixture, no horizontal overflow, and an explained
disabled action when the account URL is unavailable. Screenshots were inspected
at mobile and desktop widths. These are local UI checks, not a signed-in
Shopify/Judge.me test. The fixture exists only in the temporary preview workspace.

The remaining sections retain historical research and proposed alternatives.
They do not establish the current source's submission behavior.

Audited on 2026-11-05. Target: Shopify sign-in and purchase history, with an
Etsy-style review modal. The modal and submission reliability work is now
implemented locally. Photo selection/preparation/previews and published-photo
display are implemented locally; live media persistence, customer authentication,
purchase eligibility, and review management remain unfinished.

**Current explicit decision:** keep Judge.me as the review provider. The
composer uses whole stars (1–5), as required by its create-review API;
fractional aggregate ratings remain supported. The earlier private-review-
database recommendation is superseded. No new database or storage
service has been provisioned. See [REVIEWS_PARITY.md](REVIEWS_PARITY.md).

**Latest decision (supersedes the buyer-only closure):** Ryan chose to accept
unverified web reviews from the product-page modal now. `POST /api/reviews`
validates the review and forwards it to Judge.me's create endpoint, which needs
only the shop domain, not an API token. Reviews are not marked verified, and
publication follows Judge.me's moderation settings. Photos stay hidden behind
`reviewPhotosEnabled` in `components/reviews.tsx`, and the route returns 415 for
multipart requests until the photos have a host Judge.me can read from. The
purchase-linked sections below describe a possible later path, not current
behavior.

The product-page modal is retained. For a supported purchase-linked collection
path, inspect Judge.me's Shopify customer-account review popup before adding a
custom submission bridge. Its own form hosts photos; a custom composer needs
authenticated photo hosting before supplying `picture_urls` to Judge.me.

For another agent taking over, start with [REVIEWS_HANDOFF.md](REVIEWS_HANDOFF.md).
It includes the source map, accepted decisions versus proposals, exact sanitized
API outcomes, environment inventory, a safe retry command, validation status,
and a pasteable continuation request.

## Verified account state

| Area | Observed result |
| --- | --- |
| Shopify store | `ryan-meetup-store.myshopify.com`, shop ID `71870054511`. The configured Storefront API token successfully reads the live shop and catalog. |
| Local private Shopify token | `SHOPIFY_PRIVATE_ACCESS_TOKEN` has Storefront scopes only. It is not an Admin API credential and cannot inspect the Headless channel's configuration or read admin order data. |
| Customer authentication | The shop's OpenID discovery endpoint and Customer Account API discovery endpoint return successfully. This establishes available endpoints, not a configured storefront client or its permissions. |
| Customer Account API client | No customer-account client ID or secret is configured locally or in the Vercel `store` project's environment inventory. Whether a client already exists in Shopify Admin remains unverified. |
| Vercel | Existing CLI authentication was refreshed successfully. The correct project is `store`, rooted at `apps/store`, in `teamryan`. |
| Current deployment domains | Vercel lists verified `store-alpha.ryanmeetup.com` and `store-seven-gray.vercel.app`. `store.ryanmeetup.com` is the intended canonical domain in source, and is not currently attached to this project. |
| Local Judge.me access | The configured private token/domain combination returns HTTP 401 for shop info, settings, and review reads. The configured public token also returns HTTP 401 for widget settings. Both query and documented header authentication were checked. |
| Production Judge.me variables | `JUDGEME_PRIVATE_API_TOKEN` and `JUDGEME_PUBLIC_TOKEN` exist as sensitive Production variables. Vercel's supported read endpoints do not return their values. Their validity could not be established. |
| Preview Judge.me variables | Neither Judge.me variable is assigned to Preview. Shopify domain and Storefront token are assigned to both Production and Preview, and match local configuration. |
| Other access paths | The Shopify plugin is available but unconnected. Make account discovery failed twice with an internal error. No browser execution tool is available in this session for authenticated admin UI work. |

The repository root's `.vercel/project.json` links to the primary Ryan Meetup
site, not the store. Store configuration work must explicitly select the store
project; do not use the root's default project association.

No review was submitted, no email was sent, and no store settings, billing,
environment variables, domains, or deployments were changed during this audit.
Credential values were neither printed nor added to this document.

## Implementation progress

- Completed locally: shared modal with product context and mobile full-screen
  layout; deliberate rating selection; no review-title field; close/reopen draft
  preservation; pending/error/retry/success states; API input validation and
  provider failure handling. Display name/email are still entered by the shopper
  until authentication is integrated.
- Verification: four route tests, 15 mocked browser checks, changed-file ESLint,
  and the network-enabled production build pass. Mobile and desktop screenshots
  were inspected in light/dark themes. See the
  [current handoff record](REVIEWS_HANDOFF.md#continuation-verification-record)
  for the exact coverage, artifacts, and external verification limits.
- Unchanged blockers: local Judge.me authentication still returns 401 and no
  customer-account client ID is configured. No deployment or admin settings
  changes have been made. Anonymous POST requests are now blocked; authenticated
  purchase-authorized submission is not implemented. Four new security-route
  tests pass, including 30 concurrent spam attempts and forged buyer claims.

## First admin-only steps

These steps require Shopify/Judge.me admin access that the available credentials
do not provide. Existing storefront tokens do not substitute for customer
authentication credentials.

### 1. Retrieve the storefront's Customer Account API client

1. Open [Shopify Admin](https://admin.shopify.com/store/ryan-meetup-store).
2. Go to **Sales channels → Headless**, choose the **Ryan Meetup Store Headless**
   storefront, and open **Customer Account API settings**.
3. Copy the existing **Client ID**. This public identifier can be shared in the
   conversation or saved as `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` in
   `apps/store/.env.local` for the forthcoming implementation. It is not a
   Storefront API token. Do not regenerate existing credentials just to retrieve
   this value.
4. Record the current client type and confirm the permissions allow the signed-in
   customer's profile and orders. If it is a confidential client, save its secret
   as `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET` in `apps/store/.env.local` for
   server-only configuration; keep that value out of chat.

The proposed implementation callback is `/account/authorize`. Once the client
type is confirmed, the initial production callback to allow is:

```text
https://store-alpha.ryanmeetup.com/account/authorize
```

For a public web client, use `https://store-alpha.ryanmeetup.com` as the JavaScript
origin and `https://store-alpha.ryanmeetup.com/` as the logout URL. Preserve
existing entries. Add the equivalent `store.ryanmeetup.com` URLs when that domain
is attached and used for this flow. The implementation must use its configured
authentication origin, rather than assume the metadata canonical domain is
already serving this deployment.

Shopify requires HTTPS callbacks and does not accept localhost callbacks. A
stable HTTPS development URL or tunnel is needed for the real sign-in test.
These route and environment names are planned contracts, not existing features.

Sources: [Shopify Customer Account API setup](https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/getting-started),
[headless channel credentials](https://shopify.dev/docs/storefronts/headless/overview),
[authentication reference](https://shopify.dev/docs/api/customer/latest).

### 2. Restore local Judge.me access

1. Open **Judge.me** inside this same Shopify store.
2. Go to **Settings → Integrations → View API tokens** and confirm the listed
   shop domain is the same Shopify store.
3. Copy the current **Private API Token** into `JUDGEME_PRIVATE_API_TOKEN` in
   `apps/store/.env.local`. Keep the token out of chat and source control.
4. After that, the agent can retry read-only shop-info/settings requests to
   identify the actual plan, review collection settings, and supported headless
   integration. Preview setup can then be handled through the existing Vercel
   access. Do not choose a subscription upgrade before checking the account.

Source: [Judge.me API access](https://judge.me/help/en/articles/8409180-using-judge-me-api).

## Integration constraints

Newly confirmed provider limits are decisive for buyer-only enforcement:

- Judge.me's create-web-review endpoint explicitly requires no authorization.
  Hiding or protecting this app's button/route does not close direct calls to
  that provider endpoint.
- The widget setting for signed-in customers still allows reviews of products
  they did not buy. Its No one setting affects widget visibility; QR codes and
  review links remain public by design.
- Customer-account order forms provide a purchase-linked user flow, but enabling
  them does not prove that every other public collection path is closed.

Sources: [Judge.me API create endpoint](https://judge.me/api/docs),
[web review access settings](https://judge.me/help/en/articles/11960176-collecting-web-reviews).

For a strict product-page flow, a custom submission bridge must authenticate
the buyer, derive their identity server-side, verify a purchased line item
through Shopify, and write a durable review record with a database uniqueness
constraint. Rate limits and in-flight duplicate handling must work across
server instances, not only in one process. Provider publication moderation or
an email-confirmation badge is not a substitute for this authorization.

- Shopify sign-in proves who the customer is. Eligibility must additionally
  check that customer's purchase of the actual selected product. Knowing an
  email address or having bought a different product is insufficient.
- Judge.me's public review-creation API cannot assign verified status or upload
  videos. Photos require hosted image URLs. A custom modal posting to the
  existing route does not, by itself, reproduce Judge.me's verified-purchase
  collection flow.
- Judge.me's customer-account extensions provide review popups for fulfilled
  orders and a review-management page, including customer edits and media.
  They are documented as available on the Free plan. Their configuration in
  this account has not been inspected.
- Judge.me's platform-independent widgets for externally hosted Shopify
  storefronts require the Awesome plan and support the legacy Review Widget.
  Do not assume the new widget or its entire customization surface works on
  this Next.js storefront.
- Etsy stops customer edits after a seller response. Judge.me supports ongoing
  customer edits. Keep provider-supported editing behavior unless a different
  backend is explicitly chosen.

Sources: [API capabilities](https://judge.me/help/en/articles/8409180-using-judge-me-api),
[customer-account extensions](https://judge.me/help/en/articles/10174105-customer-accounts-widgets),
[headless widget support](https://judge.me/help/en/articles/8394958-platform-independent-widgets),
[customer edits](https://judge.me/help/en/articles/8375131-replying-to-reviews).

## Implementation sequence after access is restored

1. Validate one complete supported path from Shopify sign-in to a purchased
   item and a correctly associated Judge.me review. Confirm whether the
   provider's on-page modal can meet the requested interaction, identity,
   verification, and media requirements on this headless storefront before
   committing to that integration. Use account extensions for order-based
   collection and management where appropriate. If a fully custom composer
   needs separate verification records, define their durable storage and
   duplicate-prevention contract explicitly; do not invent a verified flag.
2. Implement storefront authentication with PKCE/state/nonce validation as
   applicable, secure server-side session handling, token refresh, logout, and
   a validated local return path so sign-in resumes the selected product review.
3. Resolve review eligibility from the authenticated customer's paginated orders
   and purchased line items. Preserve the purchased product/variant across
   grouped listings. Enforce ownership, eligibility, and duplicate prevention
   for submissions and edits on the server, including direct API calls.
4. Implement the composer: product context, deliberately selected rating,
   review text without a required title, authenticated identity, accessible
   submission/error/success states, and a draft scoped to the customer/product.
   Use the shared `Modal` for a custom composer; use a provider-owned dialog
   only when its supported verification/media behavior justifies the exception.
   Ryan subsequently chose to keep Judge.me with whole-star individual reviews
   and fractional averages. Use shared `StarRating` with `step={1}`. The legacy
   route remains closed. The photo chooser prepares up to five JPG/PNG/WebP
   sources (10 MB each) as JPEGs no larger than 700 KiB each, bounded to a 1600px
   longest edge. Multipart transport is prepared, but no server photo hosting
   or provider submission is connected. Server validation is still required.
5. Add supported media and buyer editing, then improve storefront review reads:
   pagination, complete-dataset counts/ratings, reviewer display-name privacy,
   published-only media, replies, and product/shop attribution. The current
   `getReviews` computes its summary from at most 20 reviews and must not be
   treated as the product's complete aggregate.
6. Configure supported delivery-based review requests and publication settings.
   Match success copy to the actual publication/confirmation state rather than
   always promise moderation. Decide whether the 100-day Etsy submission window
   and category subratings belong in the first release after the provider path
   and available delivery data are confirmed.
7. Test authentication failures and return paths, purchase ownership, duplicate
   attempts, eligibility boundaries, failed uploads/submissions, grouped-product
   attribution, and keyboard behavior. Run changed-file ESLint, `git diff
   --check`, relevant tests, and the store production build. Inspect mobile and
   desktop layouts in both themes. A real signed-in test purchase is required
   before claiming the external integration works.

Etsy reference: [review flow and eligibility](https://help.etsy.com/hc/en-us/articles/115013197687-How-to-Leave-a-Review-on-Etsy).
