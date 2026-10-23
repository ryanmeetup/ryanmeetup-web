# RY-D verification checks

The production preflight reads `instance_settings.ryd_enabled` in the configured
Supabase project. When enabled, it calls the service-only, read-only
`ryd_contract_health()` RPC. Missing tables/columns, unsafe grants or policies,
missing RPC signatures or unsafe search paths, changed primary/unique keys,
weakened production/snapshot constraints, disabled guards, or absent page
metadata fail the build with diagnostics. It never probes a mutation RPC or
reads customer rows or OAuth credentials. Missing feature columns leave RY-D
off, matching the app; other settings failures stop the build. Keep this
contract current in a new migration when changing its protected schema.

Run from the repository root:

```sh
npm run check:database-contract --workspace=@ryanmeetup/tasks
npm run test:database:ryd --workspace=@ryanmeetup/tasks
npm run test:database:ryd-contract --workspace=@ryanmeetup/tasks
npm run test:e2e:ryd --workspace=@ryanmeetup/tasks
```

The database command uses the local Supabase stack, wraps the real migration
and drift fixtures in one transaction, and rolls them all back. It checks
service/anonymous/member permissions and deliberately damages tables, columns,
grants, policies, RPCs, constraints, indexes, triggers, and access metadata.
It does not reset the local database. The other transaction and concurrency
checks remain under `test:database:ryd-transactions`.

The page-access command applies the real access migrations twice within its
rollback transaction, provisions synthetic owners, tiers, and team members,
and checks RY-D reads, navigation, writes, and worker recipients with restricted,
open, and missing metadata. It also checks onboarding, revoked membership,
owner overrides, and private-function permissions. Other unconfigured pages
retain their open default. The contract check includes the new private access
predicate and recipient resolver.

The RY-D browser suite builds and runs the real Next app on port 3110, with a
separate Supabase transport on 54339. Override those with
`PLAYWRIGHT_RYD_PORT` and `PLAYWRIGHT_RYD_SUPABASE_PORT`. It refuses to reuse a
running server. The suite pins synthetic Supabase/OAuth credentials, forwards
Google requests only to its local fixture, and enables no application bypass.
Its preflight is skipped because the transport has no Postgres catalogs;
production builds still run the real preflight. Both browser suites run in CI. RY-D runs in desktop dark mode and at 390px
in mobile light mode.

Coverage includes a signed-in member importing a CSV, linking a Google
response, saving a review, downloading an on-demand CSV, closing and generating
again without any saved draft, and manually moving an order through Sent to
fulfillment, In production, and Done. Generation leaves stages and Google
Sheets unchanged. Separate cases prove that older saved emails never prompt
for replacement, only selected ready orders appear in files, and Select all
covers every filtered page. Feature-off, anonymous, denied-member, and
operator/owner settings authority are also covered.
The identity-mapping case keeps duplicate name/email answers available while
excluding them from identity matching, shows the queue warning, distinguishes
the buyer redirect from the review editor, and verifies keyboard access to both
links. It checks guidance at 390, 1024, 1280, and 1536 pixels, updates the editor
link as the draft changes, and cancels without writes.
Bulk review confirms missing evidence before deciding two selected orders.
The upload-reminder case saves the schedule, checks its workspace-local banner,
and captures settings at the same mobile and desktop boundary widths.
The fixture records RPC and Sheets requests so assertions check the actual
server path rather than replacing `/api/ryd` in the browser.

These browser checks verify application integration, not Postgres enforcement
or real Google consent/media/Sheets behavior. The pgTAP and two-session races
cover database invariants separately. All browser data and email drafts are
synthetic; the suite never sends an email.

Schema-parity maintenance targets both instances. RMT uses the linked CLI;
PRD uses the [complete dashboard SQL and verification](PRD_RYD_CONTRACT_SQL.md).
Apply the later [RY-D read-access update](PRD_RYD_READ_ACCESS_SQL.md) as well;
it makes reads, writes, and recipient resolution share the fail-closed rule and
extends the contract to cover its private functions.
The [upload-reminder handoff](PRD_RYD_UPLOAD_REMINDER_SQL.md) adds its schedule
columns while preserving that shared recipient rule, including when the older
reminder migration is backfilled after the read-access update. The access SQL
suite exercises that order and replay inside its rollback transaction.
PRD keeps RY-D disabled: its normal preflight skips this contract while
`ryd_enabled` is false or null. An unhealthy manual RY-D diagnostic is not a
deployment blocker for PRD's enabled features. The SQL handoffs remain available
for scheduled schema maintenance; they do not enable the feature.
