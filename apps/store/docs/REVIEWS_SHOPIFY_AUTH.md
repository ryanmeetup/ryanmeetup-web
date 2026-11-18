# Shopify buyer sign-in implementation

The custom review sign-in routes are implemented behind an explicit opt-in.
They are disabled until the client, backend, keyring, and flag are configured.
Judge.me remains the default, and custom submissions remain closed. Local
checks are not proof of a working buyer login on the intended installation.

## Client setup

Create a **confidential Customer Account API client** for this storefront in
Shopify Admin → Headless → the storefront → Customer Account API settings.
Use Shopify's [setup guide](https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/getting-started).
Keep the client ID and secret in the store's server environment. Existing
Admin and Judge.me credentials cannot substitute for this client.

The expected callback path is `/api/reviews/auth/callback`. Register its exact
HTTPS URL for the environment being tested. For production that would be
`https://store.ryanmeetup.com/api/reviews/auth/callback`; Preview needs its own
registered HTTPS URL, and local OAuth needs an HTTPS tunnel. The callback
route exists but remains gated. Registering the URL alone does not enable login
or review collection. Register the storefront's HTTPS origin in the client's
allowed JavaScript origins as well; the token exchange supplies that origin.

| Server setting | Value |
| --- | --- |
| `SHOPIFY_STORE_DOMAIN` | Existing working canonical Shopify domain; discovery uses this, independently of Judge.me's domain. |
| `SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID` | The numeric Shopify shop ID. Public discovery on this store returned `71870054511` on November 17, 2026. |
| `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` | The Headless confidential client ID. |
| `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET` | That client's secret; keep server-only. |
| `SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI` | The exact registered HTTPS callback URL. |
| `STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED` | Explicit `true` opt-in; start/callback also require custom mode for that browser. |
| `STORE_REVIEWS_BACKEND_URL` | HTTPS origin of the intended private auth backend, with no path/query. |
| `STORE_REVIEWS_BACKEND_TOKEN` | The separate service token whose SHA-256 digest is configured on that backend. |

Use separate client configuration for isolated test environments as needed.
Verify the client's buyer/order permissions on the intended installation.
No application credentials, signup settings, or callback registrations have
been changed by this implementation.

## Verified token exchange

`lib/customer-account/tokens.ts` exchanges codes through the discovered HTTPS
token endpoint with confidential-client Basic authentication and the original
PKCE verifier. `jose` verifies RS256 signatures against the discovered public
JWKS, the shop issuer, client audience, expiry/issued time, authorized party,
and the original nonce. If an access-token hash is supplied it must match.
Unsigned, tampered, wrong-scope, or malformed tokens cannot establish identity.
The intended confidential Headless client must return a refresh token; an app
client without one remains unavailable. Token/JWKS requests reject redirects,
have timeouts, and never log upstream response bodies or claims.

The shop's public discovery advertised RS256 on November 17, 2026. The local
checks sign synthetic tokens with an actual RSA key and verify both valid and
invalid claims. No live buyer token or real client secret has been used.

## Refresh-token exchange

`tokens.ts::refresh` uses the confidential client's discovered token endpoint.
A refresh response can omit its ID token or a replacement refresh token.
When an ID token is present, its signature, issuer, audience, subject, issue
time, expiry, authorized party, and optional access-token hash are verified.
Its nonce and original authentication time, when present, must match the
original identity. These rules follow the
[OpenID Connect refresh response specification](https://openid.net/specs/openid-connect-core-1_0.html#RefreshTokenResponse).

The encrypted session keeps the original verified ID token as an identity
anchor across renewals, including after that token's expiry. This lets later
responses be compared even when intervening ID tokens omit nonce/authentication
time. Only a record loaded from authenticated encrypted server storage may
be passed to this operation. Decoding that original anchor does not accept a
new identity or a browser-supplied token.

Only an HTTP 400 `invalid_grant` produces `CustomerAccountRefreshRejected`.
Client-configuration failures, outages, malformed responses, and verification
errors remain unavailable. Diagnostics never include provider response bodies
or token material. Actual refresh/rotation behavior still needs a live client
check; all token tests use synthetic responses and real test signatures.

## Implemented boundary

- `lib/customer-account/config.ts` validates explicit configuration and reports
  missing/invalid setting names without including their values in diagnostics.
  It does not borrow credentials from another integration.
- `lib/customer-account/discovery.ts` reads public OpenID metadata from the
  configured Shopify domain. It pins the issuer to the expected shop, requires
  HTTPS endpoints, S256 support, and confidential client authentication, and
  returns typed failures. It sends no client secret or buyer credentials.
- `lib/customer-account/authorization.ts` prepares a ten-minute authorization
  attempt with independent cryptographic state, nonce, S256 verifier, and
  browser binding. The browser cookie contains only a random opaque value.
  Product design/color/anchor return links are retained; external and API
  return paths are rejected. Callback checks bind the code to the browser,
  shop, client, redirect URI, and unexpired attempt. A `code_received` result
  is not an authenticated buyer.

Persist the private attempt **before** setting its cookie or redirecting. The
storage adapter must load attempts by state hash and atomically consume a
validated attempt once before code exchange; it must retire denied attempts
too. Callback checks alone cannot prevent reuse without that atomic storage
operation. Keep the verifier and nonce record private. An HTTP callback must
not accept this record from the browser. Only one active authorization cookie
is supported per browser; starting another sign-in replaces that binding.

## Encryption before persistence

`lib/customer-account/secrets.ts` seals private flow data and buyer tokens with
AES-256-GCM and a fresh IV. Authenticated context binds the ciphertext to its
record, shop, client, issuer, expiry, and browser/callback or buyer/revision.
Moving ciphertext between records or changing that context fails decryption.
The database stores only opaque envelopes, never plaintext verifiers or tokens.

Configure `STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEY_ID` and
`STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEYS` server-side. The latter is a JSON
object mapping IDs to **32-byte unpadded base64url** keys; the active ID must
exist in that object. For example, use an ID such as `2026-11` and generate
each key with `randomBytes(32).toString("base64url")` in Node. There is no
development key or fallback to a Supabase/Shopify secret. Keep test and
production keyrings separate and out of source control.

On rotation, set a new active ID and retain previous IDs while their records
are still needed. Removing an old key makes its envelopes unreadable. Session
refresh seals against the **next** revision and new access-token expiry, then
uses a database compare-and-swap; the absolute session expiry stays unchanged.
Persist timestamp values at JavaScript millisecond precision so context
reconstructed from database rows matches the original authenticated data.

The live public metadata returned HTTP 200 from
`ryan-meetup-store.myshopify.com` with issuer
`https://shopify.com/authentication/71870054511`, S256, and
`client_secret_basic` support. This proves discovery only. See the
[Customer Account authentication reference](https://shopify.dev/docs/api/customer/2026-10#discovery-endpoints).

## Persistent storage

Canonical migration `20261120130000_store_customer_auth_storage.sql` adds
`store_customer_authorizations`, `store_customer_sessions`, and five private
read/consume/rotate/revoke RPCs. RLS and explicit grants keep them inaccessible
to anonymous visitors and Tasks members. The operations run as the invoker,
with service-role access only. Authorization consumption retains a tombstone
and erases its ciphertext; session revocation erases tokens and blocks stale
refreshes through revision checks.

To end every session one buyer holds (a compromised account or a support
request), `20261120190000_store_customer_session_revoke_buyer.sql` adds
`store_revoke_customer_buyer_sessions(shop_id, client_id, issuer, subject)`.
Run it from the RMT SQL Editor; it returns how many sessions it ended and
clears each one the same way a single sign-out does. It is RMT-only and is
not yet reachable from any route.

The migration is applied and verified on **RMT**. Both tables were empty after
verification. This migration is **RMT-only**; PRD does not need it. The
[previous PRD SQL handoff is superseded](../../tasks/docs/PRD_STORE_CUSTOMER_AUTH_SQL.md).
No database secret was added to the storefront. The private
`POST /api/store/customer-auth` backend now authenticates the calling service,
pins its shop/client/callback scope, and exposes only the seven auth-storage
operations. See [backend configuration](../../tasks/docs/STORE_CUSTOMER_AUTH.md).

`lib/customer-account/backend.ts` calls that endpoint over HTTPS with a
separate service token, no redirects, no caching, and a five-second timeout.
`lib/customer-account/storage.ts` seals flows/tokens before transmitting them,
reconstructs authenticated encryption context when loading, and preserves
one-time consumption and revision-based refresh. Invalid proofs never trigger
storage requests. Storage failures remain distinct from a missing session;
upstream bodies and secrets never appear in thrown diagnostics.

`lib/customer-account/runtime.ts` reads the backend settings alongside the
existing Shopify config and encryption keyring, independently of Judge.me's
credentials. Use an isolated backend and token for Preview. No runtime
credentials or enable flags have been configured by this implementation.

## HTTP sign-in and review-session sign-out

| Route | Behavior |
| --- | --- |
| `GET /api/reviews/auth/start?returnTo=...` | Persist an encrypted ten-minute attempt, set the opaque browser binding, then redirect to Shopify. Use normal navigation with prefetch disabled. |
| `GET /api/reviews/auth/callback` | Validate state/browser/configuration, consume once, exchange and verify tokens, persist an encrypted session, then return to the original product link. A denial retires the attempt without creating a session. |
| `POST /api/reviews/auth/logout` | Require the storefront's exact Origin, revoke the review session, then clear its cookie and the flow cookie. Remains usable after switching to Judge.me or disabling new sign-ins. |

The session cookie is `__Host-store-customer-session`, a random opaque value
with Secure, HttpOnly, SameSite=Lax, and Path=/ attributes. Only its hash is
stored. The session has a seven-day absolute lifetime; access-token expiry is
recorded separately and must be checked or refreshed before Shopify requests.
The callback clears the authorization cookie on every outcome and sets no
session cookie if verification or persistence fails. Responses are uncached
and suppress referrers. Public host/proxy headers must match the registered
HTTPS storefront; arbitrary return URLs cannot redirect away from it.

Sign-out revokes the custom review session. It does not end the separate
Shopify account session. It needs no discovery/token request and does not
report success if backend revocation fails. No public session/token-read API
or review-write access has been enabled.

## Server-side session loading

`runtime.ts::getCustomerAccountSession(request)` reads the opaque session
cookie and returns `authenticated`, `sign_in_required`, or `unavailable`.
The authenticated result contains private session/token data for server use;
never put it in browser props or JSON. No session-read HTTP endpoint is added.
The same custom-provider, explicit opt-in, and credential gates apply.

Each load reads encrypted storage. Healthy access tokens require no Shopify
discovery call. Within thirty seconds of access-token expiry, the loader
rechecks the stored revision, requests renewal, saves through compare-and-swap,
and rereads the committed encrypted result. It preserves buyer identity and
absolute expiry. An expired or revoked session cannot be restored by renewal.

Concurrent callers in one process share pending work for the same backend,
shop/client/callback, and session. Only pending work is retained; sessions
are never cached across requests. Every waiter rereads storage, including
after a provider failure or an uncertain database response. A competing
committed revision can win; uncommitted tokens are never returned. Missing
sessions or definitive refresh rejection need sign-in, while storage/provider
failures remain unavailable. No failure blindly revokes a concurrent winner.

Server continuations such as purchase/name lookups use
`storage.loadSessionByHash` to reread an already authenticated session under
the configured shop/client scope. It checks and decrypts the same record as
cookie-based loading. The hash is never accepted as a public sign-in credential;
browser routes still authenticate the opaque HttpOnly cookie. Continuations
compare immutable identity/lifetime and use the current stored token, then
recheck the session before returning results. The persistence factory alone
does not establish buyer authority.

Separate workers can still make concurrent provider exchanges; there is no
distributed refresh lock. Database CAS prevents overwrite/revival, but the
intended client's rotation/reuse behavior and uncertain-exchange recovery
still need live validation before enabling collection. Add a durable backend
refresh claim if that provider behavior requires serialization across workers.

## Remaining gate

The [exact-line purchase checker](REVIEWS_PURCHASE_ELIGIBILITY.md) now uses
this session loader and the pinned Customer API, with distinct eligible,
ineligible, sign-in-required, and unavailable results. It is a private keyed
checker plus product-level order discovery and buyer-name adapters used by the
composer/submission and My reviews hooks. Refund/edit chronology and live
permission evidence remain outstanding.

Implement expired-record cleanup. Prove a real buyer login, renewal, and
order-line access after the confidential client is configured. Browser cookies
must contain only opaque identifiers; verifiers and tokens remain server-side.
Do not enable sign-in or collection before these paths are ready.
