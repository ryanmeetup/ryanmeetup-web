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
and review-content schema are still outstanding. Private customer auth storage
has been applied to RMT as migration `20261120130000`. It is now RMT-only;
PRD does not need its SQL or a skipped-version history marker. No deployment
credentials or billing settings changed.
Buyer sign-in now has a private backend, encrypted persistence, verified token
exchange, and gated HTTP start/callback/sign-out routes. Runtime credentials
and the explicit opt-in remain unconfigured, and no live buyer login has been
proved. Server-side session loading and renewal are now implemented; exact-line
purchase access and expired-record cleanup are next. See
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
| `37fa5c20` | Seal flow secrets and buyer tokens with AES-256-GCM, record-bound authenticated context, and explicit rotatable server keyrings. | 7 new encryption checks; combined 52 focused review/auth checks, changed-file ESLint, TypeScript, and store production build passed. |
| `6cde7715` | Add private authorization/session tables and five invoker RPCs in the canonical migration history, plus an isolated test stack and encrypted storage integration checks. | Full reset and replay, 72 database/access assertions, 2 encrypted-persistence tests, and 2 concurrent-writer checks passed. Linked diff affected only the new store objects. RMT push and remote migration/RLS/grant verification passed; both tables empty. PRD was initially included in the handoff; the migration is now explicitly RMT-only. |
| `4367cfd8` | Declare shared and RMT-only migration scopes without moving or changing applied SQL. | Scope validation rejects missing entries, duplicate versions, and invalid metadata. |
| `63e38492` | Default dashboard catch-up SQL to PRD's shared profile, preserving gaps and leaving existing extension objects/history untouched. | 16 combined scope/planner checks passed, including stale-output replacement and CLI defaults. |
| `e29cd515` | Validate each profile in its own disposable stack and run scope/planner checks in CI. | RMT: 72 SQL assertions, 2 encrypted-storage checks, and 2 concurrent-writer checks. PRD: 65 Tasks access assertions, no store objects, and exact shared history. Changed-script ESLint, diff check, and Tasks production build with live RMT contract preflight passed. |
| `156c6e83` | Share private auth command/result contracts through `@ryanmeetup/reviews`, with explicit dependency/transpilation integration. | Contract checks reject scope changes, extra privileges, plaintext, impossible timestamps, and malformed responses. |
| `bf571f9a` | Add a disabled-by-default, service-authenticated backend restricted to seven store auth operations. Pin its scope/project and always reject PRD. | Backend routes, contract, and common parser: 20 checks passed. Changed-file ESLint, TypeScript, and Tasks production build with RMT contract preflight passed. No schema or hosted state changed. |
| `c74426c4` | Connect encrypted flow/session persistence from the store using a separate scoped service credential. | 6 client/storage checks passed, including tampering, wrong keys/scope, invalid proofs, lost refresh races, and logout conflicts. No Supabase secret enters the storefront. |
| `7e5c9e33` | Exchange confidential-client codes and verify RS256 ID tokens with `jose`, including issuer, audience, nonce, expiry, authorized party, and optional access-token hash. | 6 crypto checks with actual RSA-signed synthetic tokens passed, including wrong signatures/claims and malformed subject types. Public discovery advertises RS256. No live buyer token used. |
| `9332175c` | Add opt-in sign-in start/callback and same-origin review-session sign-out; persist before redirects/session cookies and consume attempts before exchange. | 12 route/lifecycle checks passed, including concurrent callbacks, denial, backend failure, proxy host, and browser provider mode. Combined 74 focused storefront checks passed; final crypto/route rerun: 18 passed. Store production build, TypeScript, changed-file ESLint, and diff check passed. |
| `44a7602f` | Add confidential refresh-token exchange, optional refreshed-ID verification, stable original identity, and a distinct definitive refresh rejection. | 7 refresh checks passed with real RSA-signed synthetic tokens; existing exchange and sign-in checks still pass. No private source was submitted to an external validator. |
| `7f8bb197` | Load sessions with early renewal, pending-work coalescing, CAS persistence, and a fresh authoritative read after every renewal outcome. | 15 session checks cover concurrent callers, different scopes/backends, logout, cross-worker winners, uncertain write responses, immutable identity/lifetime, and expiry during exchange. |
| `2191f773` | Compose private cookie/session loading into the existing runtime, with discovery deferred until renewal is needed. | 5 runtime checks exercise actual encryption/transport parsing against synthetic storage/provider responses. Combined 45 focused auth/renewal checks, TypeScript, changed-file ESLint, diff check, and Store production build passed. No schema, hosted database, deployment, credential, or provider setting changed. |

The final type-only tightening of `ReviewsData` was checked with `tsc --noEmit`
after the successful production build. Both themes were browser-tested at 390,
1024, 1280, and 1536 pixels. Custom-mode mobile and desktop screenshots were
visually inspected. Browser/server processes required sandbox escalation;
the tests passed when run with those permissions.

No application deployment, Shopify installation, email queue, or deployment
credentials were changed. RMT received the committed auth-storage migration.
`docs/REVIEWS_REBUILD.md` and its roadmap link are now committed.
Other agents also have concurrent catalog, error-page, review-content, and
composer changes in the worktree. They were not included in these auth commits;
coordinate before editing their files or committing broader directory scopes.

Automatic approval review rejected the external Shopify validator because it
would upload private OAuth TypeScript source without authorization. No source
was sent and no external validation is claimed. Local signed-token, route,
type, lint, and production-build checks are the applicable evidence here.

## Storage rollout and local test incident

RMT (`lvfaartgcpphuokoswcm`) has migration `20261120130000` recorded, two
RLS-enabled tables, five service-role-only functions, no anonymous/member table
reads, and zero stored auth/session rows as verified on November 17, 2026.
PRD (`vjsnobmfsfrsnwukfaoq`) does **not** need this RMT-only migration.
The earlier [PRD SQL handoff](../../tasks/docs/PRD_STORE_CUSTOMER_AUTH_SQL.md)
is superseded. Leave any already-applied PRD extension objects/history alone;
no hosted rollback, deletion, or history repair is part of the scope split.
PRD remains inaccessible from this machine; its shared Tasks changes still get
complete dashboard SQL from the scoped catch-up planner.

The first validation prototype passed a second database name on a loopback
`--db-url` to `supabase db reset`. CLI v2.115.0 treated it as the default local
stack reset instead and reset the local Tasks database. No prior data backup
was taken, so prior local test data may have been cleared. The run was stopped
and the issue disclosed to Ryan. Hosted RMT/PRD were not affected by that reset;
RMT subsequently received only the reviewed migration through `db push`.

The committed test runner fixes this by copying canonical migrations into a
temporary Supabase workspace with a unique `store-auth-test-*` project ID and
separate 55420–55422 ports, testing there, and stopping/removing **only** its own
stack. It never uses a second database name as isolation for the reset command.

The migration-scope split changed no hosted database and left every canonical
SQL file unchanged. Shared Tasks schema still reaches both instances. Only
the declared RMT extensions are excluded from PRD's dashboard plan. Both clean
profiles were tested locally; this does not claim access to the hosted PRD
database. The old PRD store-auth SQL document now contains a superseded notice.

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

## Next gate: prove Shopify purchase access

The repository now validates explicit Customer Account client configuration,
discovers authentication endpoints, and prepares/validates authorization
attempts. The hosted Judge.me account handoff remains the enabled buyer path.
Private encrypted storage is connected through a narrowly authenticated
backend HTTP interface. Buyer start/callback now consume attempts once,
exchange codes, verify signed identity/nonce, and persist an encrypted session.
Review-session sign-out revokes that session independently of Shopify logout.
These routes require custom mode plus `STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED=true`
and complete server configuration. They do not enable review submissions.
`getCustomerAccountSession(request)` now returns a private server result:
`authenticated`, `sign_in_required`, or `unavailable`. It reads encrypted storage,
renews near-expiry access through CAS, and never returns uncommitted renewal
tokens. Healthy sessions need no Shopify discovery call. Do not serialize the
authenticated session or tokens into browser props/JSON. Expired-record cleanup
remains outstanding.

Pending refresh work is shared within one process, scoped to backend and
shop/client/callback/session. Separate workers can still exchange concurrently;
CAS protects the database, while the intended provider's rotation/reuse and
uncertain-exchange behavior still need live validation. Add a durable refresh
claim if that behavior requires serialization across workers. A failure never
blindly revokes a possible concurrent winner or retries a token exchange within
the same request; any returned identity comes from a fresh stored revision.

Public discovery was read successfully from
`ryan-meetup-store.myshopify.com` on November 17, 2026. Its issuer matched
`https://shopify.com/authentication/71870054511`, with S256 and
`client_secret_basic` and RS256 support. Only public metadata was read; no secrets were
printed and no buyer login was attempted. The discovery response is not proof
of installed client permissions or access to orders.

Ryan confirmed the Shopify client has not been provisioned and chose to reuse
the existing RMT database. The scoped backend interface is implemented;
review-content persistence and purchase eligibility remain outstanding.
The required environment variables, backend setup, and HTTPS callback path
are in [the auth setup](REVIEWS_SHOPIFY_AUTH.md).

The authorization helper returns a private record to persist before redirecting
and an opaque browser cookie. Callback checks yield only an authorization code,
not a logged-in buyer. The HTTP callback uses `store_consume_customer_authorization`
after validation, verifies the signed ID token and nonce, then saves an
encrypted session before setting its cookie. Preserve that order. Do not expose private attempt
records, copy Tasks' admin key into the storefront, or add a temporary in-memory
production session store. A direct SQL role would inherit the project's PUBLIC
privileges; keep using the scoped backend service interface instead.

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
client/backend configuration and a live feasibility check are next.

No GraphQL operation was introduced in these auth chunks. Shopify's validator
accepts GraphQL operations and does not validate OAuth TypeScript. The external
source upload was blocked as described above. Validation here is TypeScript,
ESLint, security-focused local tests, production builds, and public metadata
checks. Future GraphQL operations still need schema validation.

## Parallel work by Claude (uncommitted, November 17)

Built alongside the sign-in work; not yet committed. Build on these rather
than duplicating them, and coordinate before changing them.

- **Content contract:** `packages/reviews/src/content.ts`, exported from
  `@ryanmeetup/reviews`. Submission normalization (`reviewSubmissionSchema`),
  the exact public name (`reviewDisplayName`), complete totals
  (`summarizeReviewRatings`), and strict public payload checks
  (`publicReviewSchema`, `publicReviewPageSchema`). Tests:
  `apps/tasks/tests/unit/review-content-contract.test.ts`.
- **Composer:** `components/custom-review-composer.tsx` and
  `lib/custom-review-access.ts`. It renders unavailable, signed-out,
  no-purchase, reviewed, and ready states. `getCustomReviewAccess()` returns
  `unavailable` except for the preview-only **Custom reviews, sample buyer**
  mode, which checks a review against the contract and saves nothing.
  Exact-line eligibility should replace that function's body with the real
  session and purchase lookup. Real submissions currently POST to
  `/api/reviews`, which still returns 503 in custom mode. Browser tests:
  `tests/custom-review-composer.spec.ts`.
- **Review storage (chunk 3), local only:** migration
  `20261120140000_store_reviews.sql`, declared RMT-only. Reviews, revisions
  (one pending at a time; approved stays public during an edit), one reply,
  an audit log, and service-role functions for submit, edit, withdraw,
  approve/reject, hide/restore, reply, the public page, and totals. 71 pgTAP
  assertions in `tests/database/store-reviews.sql` run from
  `scripts/test-store-customer-auth.mjs`. Both RMT and PRD profiles pass. **Not
  pushed to RMT**. Photos and buckets are a later chunk.
- **Review backend interface:** `POST /api/store/reviews` in Tasks
  (`lib/server/store-reviews/storage.ts`), contract in
  `packages/reviews/src/review-backend.ts`. It reuses
  `authorizeStoreCustomerAuth` (same service token, pinned shop, PRD refused)
  and offers `review.submit`, `review.edit`, `review.withdraw`, and
  `reviews.page` with opaque cursors. The storefront passes the verified
  session subject and purchased line; the backend never takes a shop from the
  caller. Staff moderation is not exposed yet; it needs a separate staff
  identity. Tests: `apps/tasks/tests/routes/store-reviews.test.ts`.
- **Custom reads (chunk 5):** `lib/review-backend.ts` (client, same
  `STORE_REVIEWS_BACKEND_URL`/`_TOKEN`) and `lib/custom-reviews.ts`.
  `getReviews` in custom mode now reads the published page and complete
  totals, so product JSON-LD follows them; any failure stays `unavailable`.
  No caching or invalidation yet. Tests: `tests/review-backend.spec.ts`.
- **Submission and buyer states, waiting on eligibility:** `lib/review-purchases.ts`
  defines `ReviewEligibility` and `findReviewablePurchases(session, productId)`,
  which returns `unavailable` until exact-line eligibility replaces its body.
  That is the only function the eligibility chunk needs to implement: return
  the buyer's name and their paid, fulfilled lines for the numeric product ID,
  each a `ReviewPurchase` plus a display label. Everything around it is built:
  `getCustomReviewAccess` turns the session and purchases into the composer
  state (signed-out links to `/api/reviews/auth/start?returnTo=…#reviews`),
  and custom-mode `POST /api/reviews` (`lib/custom-review-submission.ts`)
  checks origin and input, loads the session, rechecks the chosen line,
  builds the public name server-side, and calls `review.submit`. Tests:
  `tests/custom-review-submission.spec.ts`.

## Small next chunks

Keep each item an independently verified Conventional Commit. Start with the
Shopify gate above; record its result before implementation depends on it.

1. **Live customer/session gate:** provision the intended confidential client
   and isolated backend, configure the keyring and explicit opt-in, then prove
   buyer login, renewal, and provider rotation/reuse behavior. Do not substitute
   the synthetic tests for that evidence. Expired-record cleanup is a separate
   small backend chunk.
2. **Exact-line eligibility:** use `getCustomerAccountSession(request)` before
   Customer Account queries; preserve sign-in-required versus unavailable.
   Normalize proven Shopify fields and handle the edge cases above; recheck
   ownership and eligibility on every write. Hand off typed
   eligible/ineligible/sign-in-required/unavailable results. Do not modify the
   other agent's composer/sample-buyer work without coordinating.
3. **Review storage baseline:** add store-owned tables/buckets to the existing
   **RMT** shared backend through the scoped backend interface, with isolated
   Preview data, shop/order/line uniqueness, approved/pending revisions, and
   moderation audit. Keep immutable SQL in `apps/tasks/supabase/migrations`,
   declare store versions in `supabase/migration-scopes.json`, and apply them
   to RMT only. Shared Tasks migrations continue to reach both instances.
   Store credentials
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
npx playwright test tests/customer-account-config.spec.ts tests/customer-account-authorization.spec.ts tests/customer-account-secrets.spec.ts tests/customer-account-backend.spec.ts tests/customer-account-tokens.spec.ts tests/customer-account-refresh.spec.ts tests/customer-account-session.spec.ts tests/customer-account-session-runtime.spec.ts tests/customer-account-http.spec.ts tests/reviews-data.spec.ts tests/judgeme-domain.spec.ts tests/review-collection.spec.ts tests/reviews-api.spec.ts tests/review-provider.spec.ts tests/review-preview-api.spec.ts
npx tsc --noEmit
git diff --check
```

Private backend route/parser/contract checks from `apps/tasks`:

```sh
npx vitest run tests/routes/store-customer-auth.test.ts tests/unit/customer-auth-contract.test.ts tests/unit/request.test.ts
```

Database validation from `apps/tasks` (requires local Docker and Supabase CLI):

```sh
node scripts/test-store-customer-auth.mjs
node scripts/test-store-customer-auth.mjs --target prd
node --test scripts/migration-plan.test.mjs scripts/build-catchup-sql.test.mjs
```

The runner includes the storage integration tests, which intentionally skip in
normal storefront test runs unless given its isolated RMT test container. The
PRD profile proves Tasks works without store objects/history; the RMT profile
checks authorization consumption and logout/refresh races with real database
connections, not a browser API stub.

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
