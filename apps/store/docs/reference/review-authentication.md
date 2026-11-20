# Shopify buyer sign-in and sessions

Reviewed November 20, 2026 against `lib/customer-account` and the auth routes.
Login, encrypted persistence, renewal, ordinary logout and account switching
are implemented. Runtime availability depends on this environment's settings;
this audit did not change them or perform a real buyer login.

## Client and environment setup

Use a **confidential Customer Account API client** for the intended Headless
storefront. Admin/Storefront API credentials are not buyer credentials. Follow
[Shopify's setup guide](https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/getting-started)
and verify the intended client's permissions, including order/customer data.

Register the exact HTTPS callback for each environment:
`/api/reviews/auth/callback`. Production's callback is
`https://store.ryanmeetup.com/api/reviews/auth/callback`. Local OAuth needs an
HTTPS tunnel; a plain localhost callback is rejected. Register the storefront
origin for token requests and its root (`https://<origin>/`) as the post-logout
redirect used by account switching.

| Server setting | Purpose |
| --- | --- |
| `SHOPIFY_STORE_DOMAIN` | Canonical `.myshopify.com` domain for public discovery. |
| `SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID` | Numeric shop ID; this store's recorded ID is `71870054511`. |
| `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` / `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET` | Confidential Customer Account client; secret remains server-only. |
| `SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI` | Exact registered public HTTPS callback; no query/fragment. |
| `STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED` | Exactly `true` enables configured start/callback and ordinary session loading. There is no provider-selection gate. |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | RMT persistence; see the database guide for the nonproduction loopback allowance. |
| `STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEY_ID` | Active key ID. |
| `STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEYS` | JSON map from key ID to a 32-byte unpadded base64url key. |

`config.ts` reports missing/invalid **names**, never secret values. There is no
default encryption key or borrowed Tasks/Shopify secret. Use distinct isolated
and production keyrings; retain old IDs while their records must be readable.
Removing a key makes its existing envelopes unreadable.

The default sign-in flag in `.env.example` is false; that is not evidence of
the deployed flag. An arbitrary hosted Preview Supabase project is refused by
the current Store URL guard. Configure a supported isolated target before a
live rehearsal; do not substitute production RMT or PRD data.

## Authentication and encrypted storage

Public OpenID discovery pins the issuer to the configured shop and requires
HTTPS endpoints, S256 and confidential-client authentication. Authorization
uses state, nonce, PKCE and an opaque secure browser binding, with a ten-minute
attempt. Return paths stay on the Store; product design/color/anchors survive.

The encrypted attempt is persisted before a redirect/cookie. Callback validation
binds browser, shop, client, callback and expiry; atomic consumption happens
before code exchange. Denied attempts are consumed too. Only one active
flow-binding cookie is supported per browser.

`tokens.ts` exchanges codes with Basic client authentication and the original
PKCE verifier. `jose` verifies RS256 signatures/JWKS, issuer, audience, nonce,
expiry/issue time, authorized party and any access-token hash. A refresh token
is required for the original login. Redirects, timeout failures and malformed
responses are refused without logging response bodies or claims.

`secrets.ts` uses AES-256-GCM with independent IVs and record/scope/version/
expiry-bound authenticated context. `storage.ts` reconstructs that context and
uses the service-only invoker RPCs in RMT. Tokens/verifiers are encrypted before
persistence; the session cookie contains a random opaque identifier and only
its hash is stored. Buyer auth creates no Supabase user or Tasks membership.

## Routes and account behavior

| Route | Behavior |
| --- | --- |
| `GET /api/reviews/auth/start?returnTo=...` | Saves the attempt, sets browser binding and redirects to Shopify. Navigate normally with prefetch disabled. |
| `GET /api/reviews/auth/callback` | Validates/consumes once, verifies exchanged identity, persists the session, then sets its cookie and returns to the saved path. |
| `POST /api/reviews/auth/logout` | Exact-origin session revocation and cookie clearing. Works during a sign-in pause if client/keyring/database configuration remains available. |
| `POST /api/reviews/auth/switch` | Loads and revokes the Store session, clears cookies and returns Shopify's logout URL for the browser. It uses `id_token_hint` and the registered root post-logout URI so Shopify can forget the previous account. Requires enabled sign-in. |
| `GET /api/account` | Private same-origin status for the current browser; may include the authenticated buyer's email. It does not expose a session or token-read API. |

Ordinary logout ends only the Store review session; it leaves Shopify's own
checkout/account session intact. **Use a different account** intentionally
also navigates through Shopify logout. Do not log or share that returned URL:
it includes an identity-token hint. Live redirect/account behavior still needs
rehearsal with the intended client.

The `__Host-store-customer-session` cookie is Secure, HttpOnly, SameSite=Lax
and Path=/, with a seven-day absolute lifetime. Access-token expiry is separate.
A short-lived `store-signed-in-notice=1` cookie has no identity; the private
account read supplies the signed-in notice's email.

Browser navigation failures go to `/reviews/sign-in?problem=expired|blocked|unavailable`;
programmatic callers keep safe JSON/status errors. The callback clears its flow
cookie on every outcome. In `next dev`, a localhost sign-in start can hop to
the configured HTTPS tunnel; the session lives on that HTTPS origin. Public
host/proxy origin checks still apply.

## Renewal and concurrent requests

`runtime.ts::getCustomerAccountSession` returns `authenticated`,
`sign_in_required` or `unavailable` for server use. Each load reads encrypted
storage; healthy tokens need no provider discovery. Within thirty seconds of
expiry, it rechecks the revision, renews, compare-and-swaps the next encrypted
revision and rereads committed storage. Identity and absolute expiry stay fixed.

Refresh may omit a new ID/refresh token. Any new ID token must match the
original verified identity, and nonce/authentication time when supplied. The
original encrypted ID token anchors that comparison even after its expiry.
Only HTTP 400 `invalid_grant` becomes a definitive refresh rejection; outages,
client errors and invalid responses remain unavailable.

Concurrent callers coalesce **pending work in one process**, scoped to backend
and session. Every waiter rereads authoritative storage. Separate workers can
still exchange concurrently; database CAS prevents overwrite/revival but does
not serialize provider refreshes. Never return uncommitted tokens or blindly
revoke a possible concurrent winner.

Purchase/name continuations load by the private hash only after the caller
established buyer authority. They compare immutable scope/lifetime and use the
current stored token, then recheck the session. Browser callers cannot use a
hash as a sign-in credential.

## Verification

The revoke-all-buyer-sessions RPC exists in RMT; no support UI or public route
exposes it. Expiry cleanup and distributed refresh claims are not implemented.
The [roadmap](../planning/roadmap.md#14-store-reviews) owns those feature decisions
and live-evidence gaps. Follow the [operations rehearsal](../how-to/review-operations.md#live-lifecycle-rehearsal)
when verifying a configured client.

From `apps/store`, this server-free set uses synthetic provider/storage data:

```sh
STORE_BASE_URL=http://127.0.0.1:39999 npx playwright test tests/customer-account-config.spec.ts tests/customer-account-authorization.spec.ts tests/customer-account-secrets.spec.ts tests/customer-account-backend.spec.ts tests/customer-account-tokens.spec.ts tests/customer-account-refresh.spec.ts tests/customer-account-session.spec.ts tests/customer-account-session-runtime.spec.ts tests/customer-account-http.spec.ts tests/account-status.spec.ts --workers=1
```

Real encrypted persistence/concurrency checks run inside the isolated database
runner in [the database guide](review-database.md). Exact-line reads and their
remaining live cases are in [purchase eligibility](review-purchase-verification.md).
