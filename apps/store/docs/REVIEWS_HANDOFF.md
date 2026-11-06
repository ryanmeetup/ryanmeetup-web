# Review project handoff for Claude or another agent

**Current status, 2026-11-06:** read the current-readiness section at the top of
[REVIEWS_SETUP.md](REVIEWS_SETUP.md) before the historical snapshots below.
Configured product pages now hand collection to Shopify accounts locally;
the separate JSON route forwards unverified web reviews, while multipart photos
return 415. Earlier descriptions of a blanket 403 closure are superseded.
The 401 is resolved: the modal's shop domain is `9mf9bm-3f.myshopify.com`.
Local `JUDGEME_SHOP_DOMAIN` now selects that domain independently of the catalog's
`SHOPIFY_STORE_DOMAIN`. Existing private/public tokens authenticate with 200;
the account has zero reviews, automatic publication, pictures/videos enabled,
and the Basic/free plan. See [JUDGEME_AUTH_DIAGNOSTIC.md](JUDGEME_AUTH_DIAGNOSTIC.md).
The domain override and both verified tokens are saved in Vercel
Production/Preview; tokens are sensitive. New source still needs deployment.
The saved Shopify account menu includes **My Reviews**. Native collection needs
a fulfilled order for end-to-end testing; these local changes are not deployed.

Snapshot: **2026-11-05**, branch **`main`**, source HEAD
**`f664feb8de423f7598eb1ed934da6836c121af34`**. Refresh Git status before working;
the user may have made other changes after this snapshot.

Read the repository `AGENTS.md`, `apps/store/AGENTS.md`, and
[REVIEWS_SETUP.md](REVIEWS_SETUP.md) first. This handoff preserves investigation
context; current source and applicable repository instructions take precedence
if they have changed.

**Latest decision and follow-up:** Ryan explicitly chose to **keep Judge.me**,
with **whole-star individual reviews and fractional averages**, after confirming
its create API only accepts 1–5 whole stars. This supersedes the earlier private
review-database recommendation and the half-star submission UI described in
historical verification below. Star focus now outlines the whole star only for
keyboard input. Photo selection, JPEG preparation, previews/removal, draft
preservation, multipart transport, and published Judge.me photo display are
implemented locally. Real uploads remain unconnected: the legacy endpoint is
still closed. A fresh read-only check of `/shops/info` still returns **401**;
the Shopify customer-account client ID is still absent locally.
See [REVIEWS_PARITY.md](REVIEWS_PARITY.md) for the remaining provider-first work.

## Start here

**Latest security state:** the old `POST /api/reviews` endpoint is deliberately
closed. It returns HTTP 403 for all requests without reading buyer claims or
calling Judge.me. New route tests show 30 concurrent submissions and forged
authentication/purchase fields cannot bypass that closure. This blocks all
writes through the old route, including legitimate buyers; it is not a finished
buyer-authorized backend. It is local/uncommitted/undeployed.

Further official-documentation research found Judge.me's create-review endpoint
requires no authorization at all. Its signed-in widget setting allows reviewing
unpurchased items, and public QR/review links remain public even when widget
buttons are hidden. Securing only our proxy cannot promise provider-wide
buyer-only collection. Sources and the implications are in
[REVIEWS_SETUP.md](REVIEWS_SETUP.md#integration-constraints).

The earlier recommendation of a private review database is superseded by Ryan's
explicit choice to keep Judge.me. The product modal remains, but the supported
purchase-linked collection/hosting bridge is unfinished. No database, migration,
provider subscription, or new customer-authentication dependency has been added.
Existing setup questions for Shopify Client ID/type still apply to that design.

The user dislikes the inline form that opens from **Write a review** on store
product pages. They explicitly chose a **modal**, asked to mirror Etsy's review
experience closely, and selected **Shopify sign-in and purchase history** as the
verification model. They asked the agent to investigate autonomously until
something actually requires their own access, then asked for a detailed record
so they can transfer the work to Claude.

The conversation began in planning. After the audit and handoff, Ryan said
**continue working**. Local implementation now includes the shared review modal
and submission reliability changes described below. **Customer authentication,
purchase eligibility, media uploads, and review editing are still pending.** No
deployment was made, and the external review integration is not validated.

### Continuation implementation status

- `Reviews` now opens `@ryanmeetup/ui`'s `Modal`, with a product image/name,
  a full-screen mobile panel, shared footer actions, and controlled draft state.
- Rating starts empty and must be deliberately selected. The shared
  `StarRating` uses `step={1}` in the store for Judge.me compatibility, with
  pointer, touch, and native radio keyboard input. Read-only ratings use shared
  `RatingStars` to preserve fractional aggregate fills.
- The review-title field was removed. Display name and email remain in the
  current public submission flow until authenticated identity is integrated.
- Closing/reopening preserves the draft on the same mounted product. Successful
  submission clears it; switching designs remounts the component and discards
  the previous product's draft. There is no cross-page or durable draft storage.
- Submission failures, including transport and invalid JSON responses, show an
  accessible error and allow retry. Pending submission disables fields/cancel
  and prevents Escape dismissal. Success is announced without claiming a
  particular moderation/publication policy.
- An earlier continuation added API validation/provider error handling. The
  buyer-only protection update superseded that forwarding code: the legacy POST
  route now rejects all requests before any provider call. Do not restore that
  earlier forwarding path while integrating authentication.
- The store declares and transpiles its new direct `@ryanmeetup/utils`
  dependency for the existing shared email validator; the lockfile is updated.
- The endpoint no longer accepts any review writes. **Authenticated buyers
  cannot submit yet, and no Judge.me verified status is established.** The
  backend/credential decisions below remain open.
- Four direct route tests pass. The store production build passes with network
  access. Browser checks and their final verification record are recorded in
  the validation section below.

A read-only Judge.me recheck during continuation again returned HTTP 401, and
the Customer Account API Client ID is still absent from local configuration.
New code was developed without waiting on those unchanged external inputs.

The two missing inputs already requested from Ryan are:

1. The Headless storefront's **Customer Account API Client ID and client type**.
   If confidential, its secret should be saved locally, outside chat, as
   `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET` in `apps/store/.env.local`.
2. The current **Judge.me Private API Token**, saved locally as
   `JUDGEME_PRIVATE_API_TOKEN` in that same file. The existing local credential
   fails authentication. The agent cannot recover the sensitive Production
   value through Vercel's supported read endpoints.

Full admin navigation, proposed callback URLs, and source references are in
[the setup document](REVIEWS_SETUP.md#first-admin-only-steps). The Client ID can
be shared in chat; secret tokens should stay in local/server environment
configuration. These inputs had **not arrived** when this handoff was written.

Resume from these specific gaps. Do not send the user back through a generic
Shopify installation checklist or ask them to repeat the audit authorization.
The existing Vercel access is sufficient for subsequent store configuration
work; the user was not asked to manage Vercel manually.

## Decisions versus proposals

| Status | Detail |
| --- | --- |
| Explicit user choice | Replace the inline composer with a modal. |
| Explicit user choice | Use Shopify sign-in and purchase history, the closest of the offered options to Etsy. |
| Explicit user preference | Investigate everything possible autonomously and keep a durable handoff. |
| Implemented locally | Product image/name context, rating first with no default selection, review body without a title field, mobile full-screen presentation, draft preservation on close/reopen, and accessible submission states. Purchased-variant context still needs the order integration. |
| Planned | Reviewer identity from the authenticated account, actual purchase checks, media, and customer review management. |
| Integration decision pending | Whether Judge.me's supported headless popup can satisfy the on-page experience and purchase verification, or whether a custom modal needs its own durable purchase-verification and duplicate-prevention records. |
| Policies not yet selected | Exact 100-day submission cutoff, treatment of missing delivery estimates or disputed orders, category subratings, and whether all of those belong in the first release. |
| Proposed provider-compatible behavior | Preserve Judge.me's customer editing behavior instead of Etsy's lock after a seller replies. This was recommended, not separately confirmed by the user. |
| Explicit user choice | Keep Judge.me; use clickable whole-star individual ratings and fractional averages. `AGENTS.md` records the shared `StarRating` exception; other single-choice controls still use `DropdownSelect`. |

The intended eligibility states are signed-out → sign in and return; eligible
purchased item → composer; already reviewed → edit; too early → availability
message; no matching purchase or expired window → explanatory state. Detailed
policy and provider capabilities must be resolved before those states are
presented as working behavior.

## Current source map and observed behavior

All paths below are relative to the repository root.

| File | Why it matters |
| --- | --- |
| `apps/store/components/reviews.tsx` | Shared modal composer, controlled draft/photos, product context, whole-star input, fractional review displays, and JSON/multipart POST handling. |
| `packages/ui/src/StarRating.tsx` | Shared native radio star input and fractional read-only rating display. |
| `apps/store/components/review-photos-field.tsx`, `lib/review-photos.ts` | Multiple photo selection, bounded JPEG preparation, previews/removal, duplicate checks, and in-memory draft ownership. |
| `apps/store/components/review-photo-gallery.tsx`, `lib/review-photo-hosts.ts` | Published provider photo thumbnails/viewer and allowed image hosts. |
| `apps/store/lib/reviews.ts` | Server-side Judge.me product lookup, published-review read, and mapping into app types. |
| `apps/store/app/api/reviews/route.ts` | Legacy anonymous submission path is closed: HTTP 403 and no provider calls. |
| `apps/store/lib/types.ts` | `Review` and `ReviewsData`; currently no media, reply, order, or edit-eligibility fields. |
| `apps/store/app/products/[handle]/page.tsx` | Loads reviews and emits product structured data with review aggregates. |
| `apps/store/components/product-group-detail.tsx` | Selects the real Shopify member product and remounts its `Reviews` component when the design changes. |
| `apps/store/lib/product-groups.ts` | Grouped listings and readable design links; inspect before assigning reviews to a displayed listing. |
| `apps/store/lib/shopify.ts` | Existing Storefront client, catalog, cart, policies, and hosted-account-link fallback. |
| `apps/store/lib/metadata.ts` | Canonical origin is fixed at `https://store.ryanmeetup.com`; this differs from the current attached deployment domain. |
| `apps/store/app/layout.tsx`, `components/header.tsx` | Existing hosted-account link and site shell. Inspect actual current paths before editing. |
| `packages/ui/src/Modal.tsx` | Shared Headless UI dialog shell, form support, scrollable body, header/footer slots, and dismissal behavior. |
| `packages/ui/src/ModalActions.tsx` | Shared submit/cancel footer, pending state, and form binding. |
| `apps/store/playwright.config.ts`, `tests/` | Existing Playwright patterns and base URL. |

Source findings and remaining integration gaps (test coverage is recorded below):

- `Reviews` now receives `data` and a product context (`id`, `title`,
  `featuredImage`). Authenticated identity, purchased-variant context, and
  eligibility are not yet supplied.
- The form's prior default-five-star behavior, UI-required review title, lost
  draft on close, and unresolved loading after fetch/JSON failures are addressed
  in the continuation. Display name, email, body, and rating remain required.
- Switching a grouped product still remounts the entire reviews component.
  A future authenticated draft strategy must also handle sign-in/sign-out
  transitions without exposing another buyer's draft.
- The legacy route rejects all writes. Its replacement still needs sign-in,
  order ownership, actual catalog membership, applicable delivery/window rules,
  durable duplicate enforcement, rate limiting, and edit ownership checks.
- `getReviews` requests only **20 reviews** and calculates both count and mean
  from that returned page. Updating the visible aggregate also requires
  reviewing the product JSON-LD, which combines those same values across member
  products.
- Missing configuration, failed HTTP responses, and missing product lookups
  all become empty review data. **An empty storefront review section is not
  evidence that the store has no reviews or that authentication works.**
- The current mapping marks only provider strings `buyer` and
  `verified-buyer` as verified. Revisit the official status semantics; identity
  confirmation or a prior purchase elsewhere in the shop does not prove
  purchase of this particular item.
- Review content is currently rendered through React text nodes. If changing
  to provider widget HTML/JSON, respect the provider's storefront-safe data
  contract and reviewer display-name privacy; do not expose raw private review
  objects or hidden media.
- `getCustomerAccountUrl` reads `shop.customerAccountUrl`; the live field is
  null, so it falls back to `https://shopify.com/71870054511/account`. That
  hosted-account link does not establish a session in this Next.js storefront.
- The Storefront API version in source is `2026-04`. The discovered Customer
  Account API version is a separate endpoint; do not assume they are the same.
- Shared `Modal` already traps focus through Headless UI, supports a form via
  `formId`/`onSubmit`, and accepts `actions`. Outside-click dismissal defaults
  off; Escape/close still work when `closable` is true. Size `full` means a
  viewport-width panel with margins, not an existing mobile full-screen mode.
- `tests/reviews-api.spec.ts` and `tests/reviews.spec.ts` now cover the modal
  and submission route. No account route family or durable review-linkage/session
  storage exists in this review flow. Any new storage requirement is real scope,
  not an already-provisioned service.

Keep app-specific commerce and authentication logic in `apps/store`. Shared
presentation improvements belong in `@ryanmeetup/ui` only when appropriate.
Do not use either Tasks Supabase instance for store review or session data.

## Live evidence and account identifiers

These are non-secret identifiers and sanitized outcomes. Findings describe the
audit date and may need a targeted refresh after credentials/settings change.

### Shopify

- Shop domain: `ryan-meetup-store.myshopify.com`.
- Shop ID: `gid://shopify/Shop/71870054511`.
- Storefront query `shop { id name customerAccountUrl }` and a one-product
  catalog read succeeded with HTTP 200. Shop name: `Ryan Meetup Store`;
  `customerAccountUrl`: null.
- A read of `/admin/oauth/access_scopes.json` with the local private token
  succeeded. It listed **Storefront `unauthenticated_*` scopes**, not Admin
  order/app-management access. An Admin GraphQL query of
  `currentAppInstallation` returned an `ACCESS_DENIED` GraphQL error despite
  HTTP 200. Inspect GraphQL errors, not HTTP status alone.
- OpenID discovery succeeded at:
  `https://ryan-meetup-store.myshopify.com/.well-known/openid-configuration`.
- Discovery reported issuer `https://shopify.com/authentication/71870054511`,
  authorization endpoint ending `/oauth/authorize`, token endpoint ending
  `/oauth/token`, and logout endpoint ending `/logout` under that issuer.
  `S256` PKCE is supported. Discover the actual endpoints in implementation
  rather than hard-code this snapshot.
- Customer Account API discovery succeeded at:
  `https://ryan-meetup-store.myshopify.com/.well-known/customer-account-api`.
  Its `graphql_api` value was
  `https://shopify.com/71870054511/account/customer/api/2026-10/graphql`.
- Discovery does **not** reveal this storefront's client ID, callback allowlist,
  client type, or granted permissions. No customer login or order-history query
  was possible without the client setup and a real buyer's sign-in.

### Vercel

| Item | Value |
| --- | --- |
| Team | `teamryan` |
| Team ID | `team_LvRp1aqMc9ZIn0Sh7hTZ9Lso` |
| Store project name | `store` |
| Store project ID | `prj_xwvzIw4ZaUfF9kyM0jLk4Dc1RDe4` |
| Root directory | `apps/store` |
| Framework / configured Node | Next.js / `24.x` |
| Snapshot production deployment | `dpl_GbQDkYRYoHU9iwyVY6G1KGYtQ2jx` |
| Snapshot deployment URL | `https://store-9wraq2vfa-teamryan.vercel.app` — HTTP 200 on a root-page read |
| Attached verified domains | `store-alpha.ryanmeetup.com`, `store-seven-gray.vercel.app` |

**The repository root's `.vercel/project.json` selects `ryanmeetup-v2`, not
`store`.** Its project ID is `prj_MIIbLOa1tnxbrh4Y9UaWd4wZhcmj`. Do not run
unqualified environment mutations/deployments from that linked root, overwrite
its association, or copy variables from another app into the store.

The existing Vercel CLI login initially had an expired access token. Running
`vercel whoami` with normal network/cache access refreshed the existing session
and returned account `ryansle`. A new interactive login was unnecessary. Local
CLI authentication is stored at
`~/Library/Application Support/com.vercel.cli/auth.json`; do not print or copy
its contents into a handoff.

Read-only Vercel endpoints used with the existing authorization, explicitly
scoped to the store project and team:

```text
GET /v9/projects?teamId=<team ID>&limit=100
GET /v9/projects/<store project ID>?teamId=<team ID>
GET /v10/projects/<store project ID>/env?teamId=<team ID>
GET /v1/projects/<store project ID>/env/<environment variable ID>?teamId=<team ID>
GET /v9/projects/<store project ID>/domains?teamId=<team ID>
```

Only the relevant store variables were inspected. Domain and Storefront token
were readable through the individual-value endpoint and matched local values.
Judge.me variables had `type: sensitive`, `decrypted: false`, and no readable
value. **That is expected secret protection, not an empty/unconfigured
variable.** The deprecated `decrypt=true` list parameter did not reveal them.
Production Judge.me token validity therefore remains unknown. Do not change
that conclusion to “production reviews are broken” based on the local 401.

### Environment inventory

| Name | Local | Vercel Production | Vercel Preview |
| --- | --- | --- | --- |
| `SHOPIFY_STORE_DOMAIN` | Present; works | Present; matches local | Present |
| `SHOPIFY_STOREFRONT_API_TOKEN` | Present; works | Present; matches local | Present |
| `SHOPIFY_PRIVATE_ACCESS_TOKEN` | Present; Storefront-only scopes | Absent from inventory | Absent from inventory |
| `JUDGEME_PRIVATE_API_TOKEN` | Present; rejected with 401 | Present; sensitive/unreadable | Absent |
| `JUDGEME_PUBLIC_TOKEN` | Present; rejected by widget settings with 401 | Present; sensitive/unreadable | Absent |
| Customer-account client credentials | Absent | Absent | Absent |

The example env file names `SHOPIFY_ADMIN_API_TOKEN` and
`JUDGEME_PUBLIC_API_TOKEN`; those were not configured in the inspected local
environment. Current review runtime code uses only `JUDGEME_PRIVATE_API_TOKEN`
and `SHOPIFY_STORE_DOMAIN`. Neither public Judge.me token variable name is
currently consumed. Proposed `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` and
`SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET` names are not read by existing code
yet.

### Judge.me

- Private-key checks of `GET /api/v1/shops/info`, `GET /api/v1/settings`, and
  `GET /api/v1/reviews?published=true&per_page=1` returned HTTP 401.
- Error message: `Failed to authenticate. Shop domain or Api Token is wrong`.
- Documented `X-Api-Token` header authentication also returned 401; this was
  not resolved by changing query-string authentication to a header.
- The local public token received the same response for widget settings.
- Token values were checked in memory for obvious placeholders and surrounding
  whitespace; neither explained the failure. It remains a rejected token/domain
  combination, not a proven diagnosis of which value is wrong or why.
- The account's actual plan, product sync, publication settings, identity
  confirmation settings, customer-account extensions, and headless widget
  availability remain **uninspected**.
- No test review, review request email, or account/configuration write was made.

The provider API limits and official references are recorded in
[Integration constraints](REVIEWS_SETUP.md#integration-constraints). Most
importantly, customer sign-in plus a call to the public create-review API does
not yield an automatically verified Judge.me purchase. The initial integration
test must establish the supported order-linked collection path before promising
video, verification, and buyer editing inside a custom composer.

### Tool and network limits encountered

- Initial shell network calls failed with `ENOTFOUND` inside the execution
  sandbox. The same narrowly scoped read-only API calls succeeded with network
  escalation. Do not treat the first DNS errors as account or provider failures.
- Vercel CLI also needed permission to use its ordinary cache directory outside
  the workspace. The network/cache escalation was allowed; there was no
  automatic approval rejection left unresolved.
- Make `environment_get` failed twice with an internal error. No Make scenario
  or connection was created or changed.
- Plugin discovery found Shopify available but not installed/connected. It had
  already been suggested to the user the preceding day, so no repeat suggestion
  was issued. A Shopify plugin connection may help future admin work, but its
  ability to manage Headless OAuth settings or retrieve Judge.me credentials
  has not been demonstrated.
- Browser skill guidance was inspected; no Node REPL browser execution tool
  was exposed in this session. No authenticated admin-browser interaction was
  performed. A future agent with suitable browser tooling may have more access.
- A direct request to the future `store.ryanmeetup.com` domain failed with a
  connection reset. The Vercel domain inventory, not that transport failure,
  established which domains are attached to this project.

## Safe Judge.me recheck after Ryan updates the local token

From the repository root, with Node 22+ and authorized outbound network access:

```sh
node --input-type=module <<'NODE'
process.loadEnvFile('apps/store/.env.local');
const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.JUDGEME_PRIVATE_API_TOKEN;
if (!domain || !token) throw new Error('Missing store domain or Judge.me token');

for (const endpoint of ['shops/info', 'settings']) {
  const url = new URL(`https://api.judge.me/api/v1/${endpoint}`);
  url.searchParams.set('shop_domain', domain);
  if (endpoint === 'settings') {
    url.searchParams.append('setting_keys[]', 'autopublish');
    url.searchParams.append('setting_keys[]', 'enable_review_pictures');
  }
  try {
    const response = await fetch(url, {
      headers: { 'X-Api-Token': token },
      signal: AbortSignal.timeout(20000),
    });
    const payload = await response.json();
    const shop = payload.shop;
    console.log(JSON.stringify({
      endpoint,
      status: response.status,
      authenticated: response.ok && !payload.error && !payload.errors,
      error: payload.error,
      shop: shop ? {
        id: shop.id, domain: shop.domain, plan: shop.plan,
        awesome: shop.awesome, widgetVersion: shop.widget_version,
      } : undefined,
      settings: endpoint === 'settings' ? {
        autopublish: payload.settings?.autopublish,
        enableReviewPictures: payload.settings?.enable_review_pictures,
      } : undefined,
    }));
    if (!response.ok || payload.error || payload.errors) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ endpoint, error: error.message }));
    process.exitCode = 1;
  }
}
NODE
```

This reads only documented settings and emits selected non-secret fields. Do
not log full shop/review payloads: they can include owner/customer contact
details. The temporary helper used during the original audit was
`/private/tmp/store-review-audit.mjs`; it is not a durable repository dependency
and may be gone in a transferred session. Use this runbook or recreate a bounded
read-only check instead of relying on that file.

## Remaining engineering and verification

Use [Implementation sequence](REVIEWS_SETUP.md#implementation-sequence-after-access-is-restored)
for the full order of work. Resolve the provider path first, then authentication,
purchase eligibility, composer, media/editing, review display, and collection
settings. No billing change, provider migration, real charge, or domain cutover
was approved as part of the audit.

Important validation requirements:

- Read the installed Next.js docs required by `apps/store/AGENTS.md` before
  writing Next.js code. Package source declares Next `^16.2.12` and React
  `^19.2.8`; use the actual installed APIs.
- Use the workspace commands: `npm run dev:store`, `npm run build:store`,
  `npm run lint --workspace=@ryanmeetup/store`, and
  `npm run test:e2e --workspace=@ryanmeetup/store -- <relevant test files>`.
  ESLint can target just the changed files from the affected workspace.
- Store dev/Playwright default port is **3002**. The Playwright config has no
  `webServer` launcher: start the intended app separately or supply
  `STORE_BASE_URL` for a running test target.
- Actual Customer Account API login requires an allowed **HTTPS** callback;
  localhost-only mocks do not validate Shopify authentication.
- Test login return paths and session lifecycle; anonymous/direct API calls;
  item ownership and paginated order history; duplicate and concurrent
  submissions; applicable delivery/time boundaries; media errors; product
  switches; retries; and reviewer privacy. Avoid changing test expectations to
  accommodate a provider error.
- Verify modal keyboard/focus behavior, close/reopen drafts, pending/error
  states, mobile keyboard usability, light/dark themes, and relevant 1024/1280/
  1536px boundaries. Mocked browser tests do not establish that the real
  provider accepts or verifies a review.
- During the initial audit, only documentation checks and the live read-only
  requests above ran. During continuation, changed-file ESLint, four direct
  review-route tests, and the store production build passed. Browser verification
  status is updated below; it uses mocked review submissions, not real provider
  writes. The build read the live configured Shopify catalog.

### Continuation verification record

- Changed-file ESLint: passed; the final browser-test edits are included in the
  final verification pass.
- `npx tsc --noEmit --incremental false`: passed on the final code/test set.
- `git diff --check`, documentation whitespace/link/anchor checks, credential
  exclusion, and store manifest/lockfile consistency checks: passed.
- `npx playwright test tests/reviews-api.spec.ts`: **4 security tests passed**
  after closing the legacy route. They cover anonymous submission, 30 concurrent
  attempts, forged buyer claims/headers/cookies, and malformed input/missing
  provider credentials; zero provider calls are made in every case.
- `npm run build:store`: **passed**, Next.js **16.3.4**, including TypeScript and
  prerendering. The first sandboxed build compiled/typechecked, then failed on
  Shopify DNS access; the same build succeeded with authorized network access.
- `STORE_BASE_URL=http://127.0.0.1:3202 npx playwright test tests/reviews.spec.ts`:
  **15 passed**. Covers product context, close/reopen drafts and focus,
  deliberate rating selection, pending submission, success/reset, network and
  JSON/provider errors with retry, grouped-product draft isolation, and panel/
  footer bounds at 390, 1024, 1280, and 1536px in both themes. Review submissions
  were intercepted locally; there were no real Judge.me writes. These remain
  presentation tests, not evidence that the now-closed API accepts submissions.
- After closing the public endpoint, changed-file ESLint, TypeScript, the four
  security-route tests, the network-enabled production build, and documentation
  checks passed again. The 15 mocked presentation tests predate endpoint closure
  and were not rerun because the modal's presentation code did not change.
- The first sandboxed Chromium launch failed due to macOS permission limits;
  reruns with browser permissions execute correctly. Early test-only selector
  fixes account for the shared fields' required asterisks and the boxless
  Headless UI dialog root; these were not application failures.
- Isolated demo server: `/private/tmp/ryan-store-review-preview/apps/store`,
  `http://127.0.0.1:3202`, started with `next dev --webpack --hostname 127.0.0.1
  --port 3202`. It was staged without `.env.local`; dependencies and shared
  packages link to the real checkout. The user's existing port 3002 server was
  left running. The isolated port 3202 server was stopped after verification.
  Temporary staging must be resynced if source changes.
- Responsive screenshots are generated at
  `/private/tmp/store-review-<light|dark>-<390|1024|1280|1536>.png`. They are
  temporary artifacts, not committed assets or proof of external API success.
  Mobile light/dark plus desktop 1024/light, 1280/dark, and 1536/light screenshots
  were visually inspected. Actual mobile virtual-keyboard behavior was not
  tested on a physical device.

### Clickable-star follow-up verification

- The review modal now uses shared `StarRating` instead of a dropdown, with
  explicit 0.5-star increments and no initial selection. Shared `RatingStars`
  also preserves fractional fills on review cards and averages.
- **22 tests passed**: 18 browser checks (including pointer previews, touch,
  native keyboard selection, required validation, draft preservation, numeric
  4.5 submission, pending/reset/error states, and responsive layouts) plus the
  four existing closed-endpoint tests. Submission success is mocked; the legacy
  API still returns 403 and no provider write was attempted.
- Changed-file ESLint, TypeScript, and `git diff --check` pass. ESLint invoked
  from the monorepo root reports the existing missing-pages-directory notice.
  The production store build passes in the isolated preview copy without
  `.env.local`, using demo catalog data.
- Updated screenshots at the existing paths above show a selected 4.5 rating.
  Mobile light/dark and desktop 1024/light, 1280/dark, and 1536/light were
  visually inspected. Physical-device virtual-keyboard behavior remains untested.

## Worktree and continuity

### Photo/focus follow-up verification

- Current decision: keep Judge.me; whole-star input, fractional averages. The
  compact photo field and 80px previews are inside a wider desktop modal;
  mobile remains full screen with fixed footer actions.
- The 31 targeted review checks pass after rerunning one modal-open check that
  lost its dialog during preview recompilation (30 passed in the full run,
  then the isolated modal/draft/focus check passed). Coverage includes photo
  preparation, add/remove/reselect/deduplication, multipart bytes, rejected
  uploads, draft persistence, required/pending/error states, published/hidden
  provider media, whole-star input/fractional averages, and closed JSON/multipart
  endpoints. Browser submission success remains mocked.
- Four existing shared file-acceptance unit tests pass. A temporary local gallery
  fixture verified the enlarged image actually loads, Escape closes it, and
  focus returns to its thumbnail. That fixture is not part of the app source.
- ESLint, TypeScript, and `git diff --check` pass. Root-invoked ESLint still
  emits the missing-pages-directory notice. The clean demo-data production
  build passes from `/private/tmp/ryan-store-review-build-4k0kf34o/apps/store`.
  A first build in the dev preview copy encountered stale generated types after
  removing a temporary gallery route; the clean isolated build resolves that.
- Final light/dark modal screenshots at 390, 1024, 1280, and 1536px use the
  existing `/private/tmp/store-review-<theme>-<width>.png` paths. Mobile both
  themes, 1024/light, 1280/dark, and 1536/light were visually inspected.
  Keyboard focus and the loaded gallery viewer are also captured at
  `/private/tmp/store-review-star-keyboard-focus.png` and
  `/private/tmp/store-review-published-photo-viewer.png`.
- Fresh provider check: configured local Judge.me credentials still return 401
  from `/shops/info`. No customer-account client ID is configured locally.
  No provider writes, storage provisioning, deployment, or admin changes were
  made. Real purchase-linked photo submission remains blocked on integration.

At the start of the audit, the worktree was clean. The review work adds or edits:

- `apps/store/components/reviews.tsx`, `components/product-group-detail.tsx`,
  and `app/products/[handle]/page.tsx` — modal and product context.
- `apps/store/app/api/reviews/route.ts` — submission validation and errors.
- `apps/store/tests/reviews-api.spec.ts`, `tests/reviews.spec.ts` — direct route
  and mocked browser coverage.
- `apps/store/package.json`, `next.config.ts`, and root `package-lock.json` —
  direct shared-utils dependency and transpilation.
- `apps/store/README.md` — implemented composer behavior and links to the
  unfinished integration setup.

- `apps/store/docs/REVIEWS_SETUP.md` — account state, manual setup steps,
  constraints, official references, and implementation sequence.
- `apps/store/docs/REVIEWS_HANDOFF.md` — this continuation record.
- `apps/store/docs/LAUNCH_ROADMAP.md` — item 14 now points to the audit and
  distinguishes purchase enforcement from a visible review-button setting.

These changes are **not committed or pushed** as of this snapshot. A local
Claude session in the same checkout can read them immediately; a session in a
different checkout needs the documents copied or their documentation commit
transferred. Preserve unrelated work and use Conventional Commits if committing,
for example `docs(store): record purchase-linked review audit`.

After each consequential finding or user setup change, update the account-state
table, unresolved inputs, implementation status, and verification record here
and in `REVIEWS_SETUP.md`. Keep a clear distinction between observed responses,
source-code findings, vendor-documented capabilities, and untested proposals.

## Pasteable continuation request

> Continue the Ryan Meetup Store review project in this checkout. Read the root
> AGENTS.md, apps/store/AGENTS.md, apps/store/docs/REVIEWS_HANDOFF.md, and
> apps/store/docs/REVIEWS_SETUP.md. The selected direction is a review modal
> with Shopify sign-in and actual purchase verification, close to Etsy. The
> audit is complete through the available access; the modal and submission
> reliability changes are implemented locally, while authenticated purchase
> reviews remain unfinished. Read the latest verification record and check
> whether the requested Customer Account API Client ID/
> client type and working local Judge.me private token are now available.
> Continue the authorized investigation without repeating completed setup or
> exposing credentials, resolve the supported Judge.me verification path, and
> keep these handoff documents current. Ask Ryan only for a specific action
> that genuinely requires his access. Do not use the root's Vercel association
> for the store; it points at the primary site. The current store domain is
> store-alpha.ryanmeetup.com.
