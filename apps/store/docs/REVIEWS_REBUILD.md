# Ryan Meetup Reviews rebuild

This is the implementation plan for replacing Judge.me on `store.ryanmeetup.com`.
The store will own review collection, publication, photos, replies, and emails.
Shopify remains the source for buyer identity, orders, products, and fulfillment.
The existing Judge.me integration serves production until the replacement passes
the cutover checks below. Implementation and launch are separate milestones.

**Scope update, November 18, 2026:** Ryan deferred importing content from
Judge.me. Import-related tasks below are inactive unless he requests them again.
Buyer review management is implemented; see [the checkpoint](REVIEWS_BUYER_MANAGEMENT.md).
Next: configure and verify the real customer sign-in/purchase flow in an isolated
preview, then validate the complete review lifecycle. Judge.me remains the default
during this work.

**Status, November 17, 2026:** Judge.me still serves production. Finished work
is removed from this plan; [the handoff](REVIEWS_HANDOFF.md) records each landed
commit and the next small chunks. Already in place: the server-side
`REVIEWS_PROVIDER` switch, a browser review mode for dev and Preview, isolated
Judge.me reads, an `unavailable` read result and UI, closed custom submissions,
the RMT database decision, Customer Account configuration and discovery,
authorization and callback validation helpers, sealed tokens, and private
auth/session storage (migration `20261120130000`, applied to RMT and explicitly
excluded from PRD's shared profile). Nothing below is wired to a live buyer sign-in yet.

## Scope and sequence

| Milestone | Deliverable | Estimate |
| --- | --- | --- |
| 0. Shopify feasibility | Provision the confidential Customer Account API client, then prove a real buyer sign-in, exact order-line ownership, fulfillment and variant data, and protected-data access on the intended installation. Check which Printful delivery events reach Shopify. Public discovery has passed; nothing else has. | 1–2 engineering days |
| 1. Storefront replacement | Buyer submission and editing, photos, staff moderation and replies, product review cards and complete totals, migration and cutover. | 2–3 engineering weeks after the spike |
| 2. Etsy-style discovery and collection | Shop-wide review history, product attribution, sort and filters, rating distribution, timed email requests, and optional apparel fit feedback. | 1–2 additional engineering weeks |

Budget **4–6 engineering weeks total** for one engineer, including rollout and
validation. Shopify access and any migration exceptions can extend elapsed time.
Phase 1 must stand on its own. The native Shopify order-page shortcut is a Phase 2
enhancement after the storefront flow works. Video, incentives, public reviewer
profiles, and Shop app syndication are outside this scope. Check existing Shop
app sync before cutover because uninstalling Judge.me may affect it.

## Buyer and staff experience

- **Write a review** on a product page signs the buyer in with Shopify, returns
  them to the original product, and lets them pick an eligible purchase for
  that product. Show clear states for sign-in, no eligible purchase, already
  reviewed, and Shopify temporarily unavailable. Keep the existing **Your
  orders** navigation to Shopify.
- Accept whole stars from 1–5, review text, an optional title, and up to five
  optional photos. Let buyers preview attachments and choose how their name
  appears, including anonymous. Make the preview use the exact public name.
- **My reviews** shows pending, published, and hidden reviews belonging to the
  signed-in buyer. They can edit or remove their own review. An edit creates a
  pending revision while the last approved version stays public. Removing the
  review withdraws it from the storefront and its totals immediately.
- A staff page provides a moderation queue, publish/hide actions, an audit
  history, and one editable official reply per review. Apply the same rules to
  all ratings. Staff may remove inappropriate content or private information
  from public view. Buyers control the wording and score of their own review.
- Keep the current compact cards, image gallery, calendar and reviewer icons,
  green verification badge, and labeled average. In Phase 2, link the shop-wide
  average to a review page that shows the original product on each card. Label
  that average as based on product reviews across the store. An independent
  review of the shopping experience is a different feature.

## Purchase and publication rules

1. Use the Shopify Customer Account API with an authenticated, server-managed
   session. Verify order ownership server-side and read the exact line's
   Shopify product, variant, and current eligibility on submission. Product
   IDs in the browser can guide navigation. The verified line determines what
   the review is attached to.
2. Start with paid, fulfilled physical lines. The feasibility spike must
   confirm how the app identifies canceled lines, split fulfillment, and lines
   fully refunded before fulfillment. A refund after a buyer receives the item
   does not by itself invalidate their feedback. Use the spike's findings to
   define eligibility tests before implementing the policy.
3. Use a database uniqueness constraint on shop + order + line to enforce one
   review per purchased line. Multiple units on one line share one review.
   Retries should return the existing review or its status. A withdrawn
   review can be resubmitted through the same record while eligible.
4. Keep review attribution tied to the purchased Shopify product even if its
   handle changes. Store a safe display snapshot of the purchased item and
   variant when available. Use a single explicit review scope for each public
   listing. Default to the exact selected product. Only combine equivalent
   products under a deliberate catalog mapping, and attribute each review to
   its original product. Visible totals and JSON-LD must use the same scope.
5. Compute average and count from all published rows in that scope. Paginate
   the visible list independently. Use the same inclusion rules for counts,
   distribution, and structured data. Return the existing `unavailable` result
   if the review store cannot be reached. Invalidate affected product and shop-wide
   cache entries on publication, withdrawal, and reply changes.

## Proposed service boundaries

| Boundary | Contract agents should agree before implementation |
| --- | --- |
| Shopify access | Build on `lib/customer-account/` and the private auth storage: a scoped backend interface, sign-in start/callback with token exchange and signed ID-token/nonce verification, renewal, and logout. Then a server-only eligibility lookup keyed by order and line, with a typed result for eligible purchase, ineligible purchase, missing session, and provider failure. Fail closed on writes if ownership or eligibility cannot be checked. |
| Review storage | Store-owned tables and buckets in the existing RMT Supabase project (`lvfaartgcpphuokoswcm`), the selected shared backend for Ryan Meetup properties. Keep immutable SQL in `apps/tasks/supabase/migrations`, declare store versions RMT-only in `supabase/migration-scopes.json`, and scope runtime access to the store's data. PRD stays a separate personal instance. Store review status, buyer ownership and purchase references, display snapshots, revisions, media references, official replies, and moderation history. Enforce unique purchase lines and migration source keys. Customer auth and review-content tables are applied; media buckets remain planned. See [the database decision](REVIEWS_DATABASE.md). |
| Public reads | A server-only loader returns the scope, complete summary, page of public reviews, and paging cursor. Public data includes the selected display name, attribution, verification, approved media, and public reply. Order/customer identifiers, session data, staff notes, and draft content stay server-side. |
| Media | Issue expiring upload permissions only after buyer eligibility is verified. Validate type, size, and dimensions on the server, re-encode images without metadata, and publish only approved derivatives. Tie uploads to the buyer and review. Prune abandoned uploads and revoke access to removed media. Keep object backups separate from database backups. |
| Staff access | Use a separate staff identity and role, enforced on the server for every moderation or reply action. Record who acted and when. Keep production and preview credentials, data, and media isolated. |
| Request emails | Phase 2 uses a durable queue seeded from verified Shopify fulfillment events. Deduplicate by order/line, reconcile missed and out-of-order events, and recheck eligibility before sending. Skip already-reviewed purchases and honor opt-outs. Links take buyers to Shopify sign-in and the eligible item. If confirmed delivery is unreliable, use the documented fulfillment-delay fallback. |

Buyer and admin operations should use separate authorization boundaries. Rate
limit writes and upload attempts. Support a customer data export and removal
workflow that covers reviews, media, and purchase references. Minimize retained
order data. Use a server-side mail provider for review requests.

## Agent workstreams and handoffs

Choose one integration owner to maintain the shared contracts and merge order.
Run the feasibility spike first. Once its results and the contract names/types
are recorded, agents can work from shared fixtures while the backend lands.
The integration owner resolves file overlap before assignments start.

| Workstream | Owns | Depends on and hands off |
| --- | --- | --- |
| **A. Shopify identity and eligibility** | The remaining sign-in path (backend interface, start/callback, token exchange, renewal, logout), order-line matching, eligibility, and Phase 2 order events. | First out. Hand off verified fields and scopes, Printful delivery findings, and fixtures for eligible, wrong-account, canceled/refunded, and split orders. |
| **B. Review data and media** | Store-owned schema and migrations, writes/revisions, media lifecycle, public query/summary, and shared types. | Agree contracts with A and the UI agents. Hand off migrations, server interfaces, fixture data, and tests for uniqueness and public/private separation. |
| **C. Buyer and storefront UI** | Product-page handoff and shared UI reuse, review form, **My reviews**, cards, product-page scope, and shop-wide discovery in Phase 2. Own product-page integration and review JSON-LD. | Build against A/B fixtures. Hand off browser coverage for submit, edit, remove, photos, empty/error states, and grouped-product switching. |
| **D. Staff, migration, and release** | Staff authentication and moderation, seller replies, Judge.me import tooling, staging comparison, cutover and rollback runbook. | Use B's schema and migration keys. Hand off a dry-run report with counts, skipped test rows, unmapped products, and media/reply discrepancies. |
| **E. Review requests** | Phase 2 email worker, templates, suppression and opt-out handling, event reconciliation, and delivery/fulfillment fallback. | Use A's verified event contract and B's review lookup. Hand off tests for duplicate events, missed events, an already-reviewed item, and safe retry. |

Start with these existing integration points:

- **A** owns the replacement for [`lib/review-collection.ts`](../lib/review-collection.ts),
  which returns no account link in custom mode today, builds on
  [`lib/customer-account/`](../lib/customer-account), and isolates order events
  from the current [catalog webhook](../lib/shopify-webhook.ts).
- **B** owns the custom branch behind [`lib/reviews.ts`](../lib/reviews.ts). The
  [provider switch](../lib/review-provider.ts) already routes custom reads there,
  where they return `unavailable` until the database loader exists. B also owns
  the review types in [`lib/types.ts`](../lib/types.ts). Coordinate the
  submission contract with C. D owns retiring the legacy forwarding route.
- **C** owns [`components/reviews.tsx`](../components/reviews.tsx),
  [the photo UI](../components/review-photo-gallery.tsx), and
  [the product page](../app/products/%5Bhandle%5D/page.tsx). Reuse existing components
  where they fit. Add app-owned routes for **My reviews** and the Phase 2
  shop-wide view alongside the existing storefront routes.
- **D** owns the staff UI, import tooling, and the cutover changes to
  [`app/api/reviews/route.ts`](../app/api/reviews/route.ts) in coordination with B.
  That route already refuses custom-mode submissions with HTTP 503; Judge.me
  forwarding stays live in Judge.me mode until cutover.
- **E** owns a separate worker and queue for review emails. Reuse Shopify event
  verification from A and eligibility/status contracts from A and B.

A and B land the Shopify and persistence contracts before C/D wire production
integrations. Run the migration dry run and browser checks in staging before
changing the live submission path. Each handoff should state its commit or PR,
interfaces and fixtures added, verification run, and open decisions. Keep work
in small, coherent Conventional Commits. Pause implementation that depends on a
failed spike gate, and record the exact missing Shopify permission or field in
this document before refining scope.

## Migration and cutover

1. Export Judge.me reviews and available API metadata. Build a repeatable dry
   run that maps Shopify product IDs, identifies duplicate or unmapped reviews,
   excludes the known test review, and preserves original dates and publication
   states. Keep hidden and pending material private. Copy approved photos to
   our storage, and import public replies when they can be reliably matched.
2. Judge.me's CSV does not include order IDs or verification status. Its API
   exposes a verified status, but that can mean account or manual verification
   rather than a purchase, which is why the storefront labels it **Verified
   review**. Record imported provenance. Show **Verified purchase** on a legacy review only
   when the exact purchase can be independently established. Keep import
   artifacts containing private data out of Git.
3. Compare staging totals, product assignments, photos, and replies with the
   approved import. In the cutover window, stop Judge.me collection and queued
   requests, capture and import the final changes, then set Production's
   `REVIEWS_PROVIDER` to `custom` and enable any ready email jobs. Disable the old anonymous
   `POST /api/reviews` forwarding behavior and remove Judge.me entry points.
4. Keep Judge.me installed during the rollback window. If a rollback is needed,
   disable the new submission and email paths before reopening the old ones.
   Preserve reviews collected after cutover, and reconcile them before reopening
   either path for affected buyers. Uninstall Judge.me and remove its secrets
   only after verification and rollback sign-off.

## Release checks

- A buyer can sign in, review the exact purchased item, attach a photo, edit it,
  and remove it. A second account cannot write or edit using the same order or
  line ID. Two simultaneous submissions create one record. Tests cover a split
  shipment and canceled and refunded eligibility edge cases.
- Pending text and photos stay private. Publishing low and high ratings follows
  the same rules. Approved reviews and seller replies appear on the intended
  product, and edits, hides, and withdrawals update the public view and totals.
- Complete counts and averages remain accurate with more than one page of
  reviews. Grouped listings and JSON-LD agree. Read failures display an
  unavailable state while product browsing and checkout still work.
- Staging verifies an import replay, one end-to-end buyer and staff flow, and
  rollback with reviews written after cutover. For Phase 2, verify that retried
  or unordered order events cannot cause duplicate request emails.
- Run lint, `git diff --check`, focused route/data tests, the store build, and
  browser checks in light and dark mode at mobile and desktop widths. Confirm
  the Shopify flow on a dev or test store with real Shopify authentication.

## Cost and references

The estimate assumes the existing Next.js/Vercel storefront, store-owned tables
and object storage in the existing RMT Supabase shared backend, and scheduled
email processing in Phase 2. Ryan chose to reuse that project on November 17,
2026; no additional production database project is planned. Review usage shares
the backend's capacity and allowances. Confirm capacity, media backups, Preview
isolation, and email allowances before cutover. See [the database plan](REVIEWS_DATABASE.md).

- [Shopify Customer Account API](https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api), [order lookup](https://shopify.dev/docs/api/customer/latest/queries/order), [fulfillment](https://shopify.dev/docs/api/customer/latest/objects/fulfillment), and [protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data)
- [Shopify order actions](https://shopify.dev/docs/api/customer-account-ui-extensions/latest/targets/order-actions) and [webhook delivery and reconciliation](https://shopify.dev/docs/apps/build/webhooks)
- [Judge.me export fields](https://judge.me/help/en/articles/8236266-exporting-reviews) and [Shop review sync partners](https://help.shopify.com/en/manual/online-sales-channels/shop/product-reviews/sync-partner-apps)
- [Supabase pricing](https://supabase.com/pricing), [storage backup limits](https://supabase.com/docs/guides/platform/backups), and [Judge.me pricing](https://judge.me/pricing)
