# Custom reviews implementation handoff

Updated November 17, 2026. Continue from this file and
[REVIEWS_REBUILD.md](REVIEWS_REBUILD.md). Implementation has started; the custom
review service is **not ready to collect reviews**. Judge.me remains the default.
Ryan requested a browser testing control. He then chose the existing **RMT**
Tasks Supabase project (`lvfaartgcpphuokoswcm`) as the shared backend for Ryan
Meetup properties, starting with new store-owned review tables and buckets.
The [database plan](REVIEWS_DATABASE.md) records that decision and supersedes
the earlier dedicated-project proposal. Keep local/Preview data isolated and
the personal PRD instance separate. The Shopify Customer Account API client
and custom review schema are still outstanding; no schema, credential, or
billing changes have been applied.
Buyer sign-in configuration, discovery, and authorization/callback validation
helpers now exist. They are not wired to an HTTP login flow. See
[the Shopify auth setup and boundary](REVIEWS_SHOPIFY_AUTH.md).

## Completed chunks

| Commit | Change | Verification |
| --- | --- | --- |
| `c2a620cd` | Extract existing Judge.me reads to `lib/judgeme-reviews.ts`; keep `lib/reviews.ts` as the storefront boundary. | Existing 14 data/route/collection checks and changed-file ESLint passed. |
| `3ca1910b` | Add `REVIEWS_PROVIDER=judgeme\|custom`, coordinated read/collection/write selection, unavailable UI, closed custom submissions, and browser coverage. | 19 focused data/route checks; 9 custom browser/API checks; 18 existing demo browser checks passed, with the same 6 photo tests skipped because hosting remains disabled. Store production build, TypeScript, changed-file ESLint, and diff check passed. |
| `aaa5b3a6` | Add an environment-gated, per-browser preview cookie and same-origin preference endpoint; use the preference for both public reads and submissions. | Focused route/data tests and production build passed. Browser host/proxy handling is covered by a subsequent fix. |
| `d6a36006` | Match preview request origins using the storefront Host and proxy protocol instead of Next's internal hostname. | 9 preference API checks, including local-host and HTTPS proxy regression cases; production build passed. |
| `52dfaf0a` | Add the shared-dropdown browser control above product reviews, persistence/reset, grouped-product integration, and setup instructions. | All 11 switch browser checks passed across the main run and the focused rerun after scoping the error locator; 18 legacy browser checks passed, with the existing 6 photo checks skipped. Changed-file ESLint and production build passed. Light/dark screenshots inspected. |
| `30bf8a50` | Add explicit confidential Customer Account client configuration, pinned-shop OpenID discovery, synthetic fixtures, and client setup instructions. | 7 configuration/discovery checks; TypeScript and changed-file ESLint passed. Live public discovery matched shop `71870054511`. No client secret or buyer token was used for discovery. |
| `0f321b07` | Prepare server-side authorization attempts, opaque secure browser binding, state/nonce/S256, safe product return paths, and callback validation. No HTTP login flow enabled. | 10 authorization checks, including an RFC 7636 vector; combined 45 focused review/auth checks, changed-file ESLint, TypeScript, production build, and diff check passed. |

The final type-only tightening of `ReviewsData` was checked with `tsc --noEmit`
after the successful production build. Both themes were browser-tested at 390,
1024, 1280, and 1536 pixels. Custom-mode mobile and desktop screenshots were
visually inspected. Browser/server processes required sandbox escalation;
the tests passed when run with those permissions.

No deployment, database, Shopify installation, email queue, or local credentials
were changed. Existing uncommitted changes to `docs/LAUNCH_ROADMAP.md` and the
untracked `docs/REVIEWS_REBUILD.md` predated these commits and remain unstaged.
Transfer those documents too if moving to a checkout that does not have them.

## Switch and current contracts

- `lib/review-provider.ts` reads **server-only** `REVIEWS_PROVIDER`. Unset or
  blank means `judgeme`. Unknown values close collection and return unavailable
  reviews; they never silently reopen the legacy submission route.
- `lib/reviews.ts::getReviews(productId)` is the public-read integration point.
  `ReviewsData` now discriminates `available` from `unavailable`. An unavailable
  result has zero summary placeholders and no review rows. UI must never label
  that result as an empty successful query. The product page therefore emits no
  `aggregateRating` in custom mode today.
- `lib/review-collection.ts::getReviewAccount()` retains the Judge.me account
  handoff. Custom mode returns `{ url: null }`, including without Shopify
  credentials, so the old demo composer cannot reopen.
- `app/api/reviews/route.ts::POST` checks the provider before parsing or calling
  Judge.me. Custom/invalid modes return HTTP 503 with `Cache-Control: no-store`.
  Query strings, body fields, and arbitrary headers cannot choose a provider.
  The dedicated preview cookie is accepted only when testing is enabled;
  Vercel Production always ignores it.
- `lib/review-preview.ts` resolves the current browser's read mode from Next's
  request cookies. `app/api/reviews/preview/route.ts` sets or clears the
  one-day HttpOnly preference after checking environment, origin, and choice.
  Origin checks use Host/proxy protocol because Next can put an internal host
  in `request.url`. The submission route reads cookie headers without consuming
  the request body.
- `lib/judgeme-reviews.ts` preserves existing Judge.me behavior, including its
  20-review summary limitation and empty-on-provider-error behavior. Fix those
  independently if desired; custom full-scope totals must not copy that design.

The **Review mode** dropdown above product reviews appears automatically in
`next dev`. Enable it in Vercel Preview with `REVIEWS_PREVIEW_ENABLED=true`
and a fresh deployment. Choose Judge.me, Custom reviews, or Environment
default; selection refreshes the page's server data and persists across reloads
and product navigation without changing other browsers. Environment default
removes the preference. Vercel Production disables the UI and endpoint even if
the preview flag is set. `REVIEWS_PROVIDER` remains the environment default.
Keep Production on `judgeme`. This switch does not turn off Judge.me's hosted
extensions or emails. It is not yet a rollback strategy once custom reviews
are being collected. The rebuild plan owns that cutover procedure.

## Next gate: persist sessions and prove Shopify purchase access

The repository now validates explicit Customer Account client configuration,
discovers authentication endpoints, and prepares/validates authorization
attempts. The hosted Judge.me account handoff remains the enabled buyer path.
There is no HTTP start/callback endpoint, persistent attempt/session store,
token exchange or signature verification, renewal, or logout yet.

Public discovery was read successfully from
`ryan-meetup-store.myshopify.com` on November 17, 2026. Its issuer matched
`https://shopify.com/authentication/71870054511`, with S256 and
`client_secret_basic` support. Only public metadata was read; no secrets were
printed and no buyer login was attempted. The discovery response is not proof
of installed client permissions or access to orders.

Ryan confirmed the Shopify client has not been provisioned and chose to reuse
the existing RMT database. The store's scoped database connection and review
schema are not implemented yet. The required client environment variables and
planned HTTPS callback path are in [the auth setup](REVIEWS_SHOPIFY_AUTH.md).

The authorization helper returns a private record to persist before redirecting
and an opaque browser cookie. Callback checks yield only an authorization code,
not a logged-in buyer. The database adapter must atomically consume attempts
once, and the callback must verify the signed ID token and nonce before saving
a server-side session. Do not expose private attempt records or add a temporary
in-memory production session store.

Before connecting custom writes:

1. Confirm the intended Headless storefront's Customer Account API client,
   client type, callback URL, and permissions. The proposed service uses a
   confidential client and server-managed session. An Admin client ID/secret
   is not evidence of a customer-authenticated session. Shopify's
   [setup guide](https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/getting-started)
   specifies an HTTPS callback, including for development through a tunnel.
2. Prove a real buyer login and an order read using the intended installation.
   Confirm `customer_read_orders` and protected customer data access. The
   [Order reference](https://shopify.dev/docs/api/customer/2026-07/objects/Order)
   documents those requirements. Do not infer that existing Storefront/Admin
   access supplies them.
3. Prove exact order-line/product/variant and fulfillment matching with real
   responses. The documented
   [LineItem](https://shopify.dev/docs/api/customer/2026-07/objects/LineItem)
   has nullable `productId` and `variantId`, and
   [FulfillmentLineItem](https://shopify.dev/docs/api/customer/2026-07/objects/FulfillmentLineItem)
   links fulfillment to the line. Those docs establish candidates, not that
   the intended installation can read them. Pin and validate the API version
   before implementing queries; the existing Storefront adapter uses 2026-04,
   and no Customer Account API version has been selected yet.
4. Record redacted fixtures for owned/other-account orders, split fulfillment,
   cancellation, refund before fulfillment, and refund after receipt. Confirm
   whether Printful delivery events reach Shopify. Then define eligibility
   rules and tests. A whole-order fulfillment status alone does not establish
   eligibility for an individual line.

**Gate status:** public discovery passed; buyer identity/order eligibility is
not passed. No live OAuth session or exact-line eligibility has been exercised.
Do not enable custom writes on the strength of local helper tests. No missing
Shopify field or permission has been established on the real installation yet;
client setup, persistent sessions, and a live feasibility check are next.

No GraphQL operation was introduced in these auth chunks. Shopify's GraphQL
validator was attempted on the OAuth TypeScript file and rejected its `import`
as GraphQL syntax; that checker does not validate this code. Validation here is
TypeScript, ESLint, the security-focused local tests, the store build, and the
public metadata check. Future GraphQL operations still need schema validation.

## Small next chunks

Keep each item an independently verified Conventional Commit. Start with the
Shopify gate above; record its result before implementation depends on it.

1. **Customer sign-in, remaining:** reuse the new config/discovery/authorization
   helpers. First add scoped server storage for authorization attempts and
   encrypted buyer tokens/sessions through the canonical database migration
   workflow. Then add the HTTP start/callback with atomic attempt consumption,
   token exchange, signed ID-token/nonce verification, expiry/renewal, and
   logout. Record provider-mode gating and add route tests. Real login still
   needs the confidential client from the setup document.
2. **Exact-line eligibility:** normalize proven Shopify fields and handle the
   edge cases above; recheck ownership and eligibility on every write. Hand
   off typed eligible/ineligible/sign-in-required/unavailable results.
3. **Review storage baseline:** add store-owned tables/buckets to the existing
   **RMT** shared backend with a restricted store runtime role, isolated
   Preview data, shop/order/line uniqueness, approved/pending revisions, and
   moderation audit. Keep migrations in `apps/tasks/supabase/migrations` and
   follow the existing two-instance schema delivery policy. Store credentials
   and customer data target RMT only; PRD remains personal. See
   [the database plan](REVIEWS_DATABASE.md). Shopify buyers must not enter the
   Tasks Supabase signup/provisioning flow.
4. **Text-only vertical slice:** authenticated buyer submission with required
   whole-star rating/body, chosen public display name, idempotency, and pending
   status. Keep unmoderated content private. Ship staff authorization and
   publish/hide actions in the next small commit.
5. **Public reads:** database-backed product scope, complete published totals
   independent of pagination, public field projection, and cache invalidation.
   Wire `getReviews` and matching JSON-LD without falling back to Judge.me.
6. **Buyer management:** My reviews, pending edits that preserve the last
   approved version, immediate withdrawal, and resubmission on the same line.
7. **Media and replies:** separate commits for verified upload authorization,
   server validation/re-encoding and cleanup, approved images, and audited
   official replies. The existing browser photo preparation is not server
   validation or storage.
8. **Import and cutover rehearsal:** repeatable Judge.me dry run, product mapping,
   counts/photos/replies comparison, provenance/verification handling, and
   rollback with post-cutover reviews. Email collection is Phase 2.

Do not install/uninstall Judge.me, repoint credentials, turn off its emails,
or change the production provider as part of one of the preparatory chunks.

## Repeat verification

Run from `apps/store` unless noted. Unit/data tests do not need a server:

```sh
npx playwright test tests/customer-account-config.spec.ts tests/customer-account-authorization.spec.ts tests/reviews-data.spec.ts tests/judgeme-domain.spec.ts tests/review-collection.spec.ts tests/reviews-api.spec.ts tests/review-provider.spec.ts tests/review-preview-api.spec.ts
npx tsc --noEmit
git diff --check
```

Run ESLint on changed TypeScript/TSX files. From the repository root, build a
custom-mode demo without using live Shopify or Judge.me credentials:

```sh
REVIEWS_PROVIDER=custom SHOPIFY_STORE_DOMAIN= SHOPIFY_STOREFRONT_API_TOKEN= JUDGEME_PRIVATE_API_TOKEN= JUDGEME_SHOP_DOMAIN= npm run build:store
```

Start the built demo from `apps/store` in a separate terminal, then run its
custom browser checks in another:

```sh
REVIEWS_PROVIDER=custom SHOPIFY_STORE_DOMAIN= SHOPIFY_STOREFRONT_API_TOKEN= JUDGEME_PRIVATE_API_TOKEN= JUDGEME_SHOP_DOMAIN= npx next start --hostname 127.0.0.1 --port 3202
```

```sh
REVIEWS_PROVIDER=custom STORE_BASE_URL=http://127.0.0.1:3202 npx playwright test tests/custom-reviews.spec.ts --workers=1
```

For existing demo behavior, run a server with the same blank credentials and
`REVIEWS_PROVIDER=judgeme` on a separate port (3203), then:

```sh
REVIEWS_PROVIDER=judgeme STORE_BASE_URL=http://127.0.0.1:3203 npx playwright test tests/reviews.spec.ts --workers=1
```

Custom browser tests deliberately skip unless their process has
`REVIEWS_PROVIDER=custom`. Never point tests that submit reviews at production.
Local test commands do not prove Shopify OAuth, purchase eligibility, database
constraints, moderation, or migration correctness.

For the browser selector, start the built demo with Judge.me as default and
`REVIEWS_PREVIEW_ENABLED=true` (same blank Shopify/Judge.me credentials as
above), then run against that server:

```sh
REVIEWS_PROVIDER=judgeme REVIEWS_PREVIEW_ENABLED=true STORE_BASE_URL=http://127.0.0.1:3202 npx playwright test tests/review-mode-switch.spec.ts --workers=1
```

The browser-selector suite requires the same flag in its test process. It
covers both themes and all four widths, switching/reset, persisted navigation,
browser isolation, request failures, and submission-mode consistency.
