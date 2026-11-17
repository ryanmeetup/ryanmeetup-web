# Shopify buyer sign-in implementation

The custom review sign-in foundation is under construction. No sign-in entry
point is enabled yet. Judge.me remains the default, and custom submissions
remain closed. Configuration checks are not proof of a working buyer login.

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
route itself is still outstanding, so registering the URL does not enable
login today.

| Server setting | Value |
| --- | --- |
| `SHOPIFY_STORE_DOMAIN` | Existing working canonical Shopify domain; discovery uses this, independently of Judge.me's domain. |
| `SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID` | The numeric Shopify shop ID. Public discovery on this store returned `71870054511` on November 17, 2026. |
| `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` | The Headless confidential client ID. |
| `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET` | That client's secret; keep server-only. |
| `SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI` | The exact registered HTTPS callback URL. |

Use separate client configuration for isolated test environments as needed.
Verify the client's buyer/order permissions on the intended installation.
No application credentials, signup settings, or callback registrations have
been changed by this implementation.

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

## Remaining gate

Persist authorization attempts and buyer sessions in the shared backend with
scoped store access; implement one-time callback consumption, token exchange,
signed ID-token verification, renewal, and logout. Then prove a real buyer
login and exact order-line access. Browser cookies must contain opaque
identifiers; pending verifiers and buyer tokens remain server-side. Do not
enable sign-in or collection before the storage and validation paths are ready.
