# Store documentation

Choose a guide by the job you are doing. Procedures live in `how-to/`, current
implementation and contracts in `reference/`, and proposed/unfinished work in
`planning/`. The [app README](../README.md) covers local development and the
storefront's general code structure.

## How-to guides

| Guide | Use it to |
| --- | --- |
| [Add products](how-to/adding-products.md) | Publish products, assign collections/categories, group listings and credit designers. |
| [Cancel and refund orders](how-to/cancelling-orders.md) | Stop Printful fulfillment and reconcile the separate Shopify/Printful payments. |
| [Configure shipping](how-to/shipping-setup.md) | Calculate conservative weight tiers and verify destination/profile quotes. |
| [Maintain Shopify-hosted pages](how-to/shopify-hosted-pages.md) | Maintain theme redirects, notification links and checkout/account branding. |
| [Operate and verify reviews](how-to/review-operations.md) | Diagnose failures, pause/resume collection, rehearse the lifecycle and recover data. |

The [buyer authentication configuration](reference/review-authentication.md#client-and-environment-setup)
lists exact settings for Shopify sign-in; the
[moderation reference](reference/review-moderation.md#staff-access-and-screen)
describes the current owner screen and decisions.

## Technical references

| Reference | Describes |
| --- | --- |
| [Reviews overview](reference/reviews.md) | Current architecture, capabilities and buyer/publication rules. |
| [Review database](reference/review-database.md) | RMT ownership, migration inventory, permissions and rollout constraints. |
| [Buyer authentication](reference/review-authentication.md) | Client/environment settings, encrypted sessions, renewal, logout and switching. |
| [Purchase verification](reference/review-purchase-verification.md) | Exact-line eligibility, bounded lookups, unverified feedback and suggestions. |
| [Review media](reference/review-media.md) | Processing, staging, buyer controls, staff decisions, public delivery and current limits. |
| [Review moderation](reference/review-moderation.md) | Owner authorization, queue/API contracts, decisions, replies and policy deletion. |

## Roadmap and feature planning

The [roadmap](planning/roadmap.md) is the working list for operating setup,
unbuilt features, live-evidence gaps and optional ideas. Its
[review backlog](planning/roadmap.md#14-store-reviews) owns lifecycle cleanup,
monitoring, live rehearsal and conditional review features.
Current implementation details stay in the references; repeatable steps stay
in the how-to guides. An incomplete feature is not a supported operating procedure.

## Assets and maintenance

Shopify upload assets live in `assets/shopify/`; their use is documented in the
[hosted pages guide](how-to/shopify-hosted-pages.md). Keep filenames descriptive
and links relative. Update this index and incoming links when moving a guide.
Keep dated verification evidence distinct from current implementation, and
retain implementation history in Git rather than creating new handoff files.
