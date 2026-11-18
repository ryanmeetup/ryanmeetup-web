# Store customer authentication service

`POST /api/store/customer-auth` is the private storage boundary for custom
review sign-in. It is disabled unless explicitly configured. It creates no
Tasks users or memberships and grants no workspace access to Shopify buyers.
The backend owns the Supabase secret; the store receives a separate credential
restricted to this route's seven operations.

## Backend configuration

Configure these only on the intended backend deployment:

| Server setting | Meaning |
| --- | --- |
| `STORE_REVIEWS_CUSTOMER_AUTH_ENABLED` | `true` enables the route after all other checks pass. |
| `STORE_REVIEWS_SERVICE_TOKEN_SHA256` | Lowercase SHA-256 hex digest of a separately generated 32-byte unpadded base64url service token. Store only its digest here. |
| `STORE_REVIEWS_CUSTOMER_AUTH_SCOPE` | JSON with exactly `shopId`, `clientId`, `issuer`, and `redirectUri`. Pin the confidential Shopify client and its registered callback. |
| `STORE_REVIEWS_SUPABASE_PROJECT_REF` | Defaults to RMT, `lvfaartgcpphuokoswcm`. An isolated test backend can explicitly pin its own project. The compiled Supabase URL must match. PRD is always refused. |

The existing backend Supabase URL and secret remain server-owned. Never copy
them to the storefront. Each isolated backend needs the committed auth-storage
migration, its own credential, and its own Shopify scope. Preview must not
borrow the production database or service token. PRD needs no configuration.

Example scope shape, using synthetic values:

```json
{
  "shopId": "123456",
  "clientId": "confidential-client-id",
  "issuer": "https://shopify.com/authentication/123456",
  "redirectUri": "https://store.test/api/reviews/auth/callback"
}
```

Generate a service token with `randomBytes(32).toString("base64url")` in Node;
hash that exact string with SHA-256. This is separate from Shopify secrets,
encryption keys, cron tokens, and Supabase keys. No credential or deployment
setting was created by this implementation.

## Contract and enforcement

The shared `@ryanmeetup/reviews` package owns the command/result schemas. Every
command includes the exact configured scope. Supported operations:

- `authorization.create`, `authorization.get`, `authorization.consume`;
- `session.create`, `session.get`, `session.rotate`, `session.revoke`.

Requests use JSON and `Authorization: Bearer <service token>`, with no browser
Origin or `Sec-Fetch-Site` headers. There is no cookie authentication or CORS
grant. All responses use `Cache-Control: no-store`. The common JSON parser
limits bodies to 96 KiB and rejects unknown keys. Database errors use structured
responses and correlation IDs; private database error details are not logged.

New records carry hashes, encrypted envelopes, and millisecond timestamps.
Flows last exactly ten minutes; sessions have a maximum absolute lifetime of
thirty days. A five-second creation clock tolerance accommodates separate
servers. Session creation always starts at revision zero. Inserts never upsert
or reopen consumed/revoked records. Consumption, refresh, and revocation use
the existing atomic database functions. The backend does not decrypt tokens.

This route is storage plumbing for the review sign-in flow. The storefront now
composes it into opt-in start/callback and sign-out routes and verifies Shopify
tokens there. This backend does not decrypt tokens or establish buyer identity.
The storefront now also loads and renews sessions through the revision-based
storage operation. Purchase eligibility, review writes, and live validation
remain outstanding; collection stays closed. See
[the storefront auth setup](../../store/docs/REVIEWS_SHOPIFY_AUTH.md).
