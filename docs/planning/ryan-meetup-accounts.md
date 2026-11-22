# Ryan Meetup accounts

Planning draft, November 21, 2026. Nothing here is scheduled or implemented.
It scopes how the shared RMT backend could grow into one **Ryan Meetup
account** that works across RMT, ryanmeetup.com, RyanCon, the store, and future
apps. When a phase starts, its decisions move into the owning app's reference
docs and this file is updated or pruned.

## Goal

Anyone can create a Ryan Meetup account. A plain account lets them do the
public things each property offers, such as managing their store orders and
reviews or registering for RyanCon. An **elevated** account additionally grants
access to the RMT Tasks workspace, which is what happens when someone starts
working with us.

## Starting point

The shared backend already exists: RMT (`lvfaartgcpphuokoswcm`) holds Tasks and
the store's review tables, under one migration history in
`apps/tasks/supabase/migrations`, with store versions declared `rmtOnly` in
`migration-scopes.json`. See the
[store review database guide](../../apps/store/docs/reference/review-database.md).

What stands in the way of public accounts:

- **An RMT account is a Tasks membership.** `handle_new_user`
  ([baseline](../../apps/tasks/supabase/migrations/20260731000000_baseline_schema.sql))
  runs for every new Supabase Auth user, creates a `profiles` row and adds the
  user to the lowest tier. `is_team_member()` only checks for an onboarded
  profile. The only thing keeping the public out of RMT is that signup is
  invite-only (`inviteUserByEmail` in
  [`app/api/team/route.ts`](../../apps/tasks/app/api/team/route.ts)). Enabling
  Supabase signups today would put every new user in the workspace's lowest tier.
- **Store buyers are Shopify identities.** Reviews belong to the Shopify
  customer subject (`store_reviews.customer_subject`) from a server-managed
  Customer Account session. Buyer sign-in deliberately creates no Supabase
  Auth user, profile or membership.
- **The store holds the project-wide secret.** `SUPABASE_SECRET_KEY` bypasses
  RLS across RMT, including Tasks data. Fixed commands and pinned shop scope
  limit what the store does, not what the credential can do.
- **Staff roles piggyback on Tasks.** Review moderation is open to onboarded
  Tasks app owners.

## Model

```
Ryan Meetup account (Supabase Auth on RMT)
├── account profile: name, avatar, contact preferences   every account
├── linked identities: Shopify customer, Google, ...     optional
└── property access: explicit grants owned by each app
    ├── store:   own orders, own reviews                 self-serve once linked
    ├── tasks:   tier and teams                          elevation only
    ├── ryancon: registrations, tickets                  future
    └── <future app>
```

- **Plain account:** an identity and a profile. It grants nothing by itself;
  each property decides what a plain account can do there.
- **Elevated account:** an app owner grants the account a Tasks membership in
  a tier. This replaces today's invite. Guest tiers carry over unchanged: a
  fulfillment partner is an account elevated into a guest tier.
- **Property staff roles** (review moderator, RyanCon check-in) are separate
  grants owned by that property. A Tasks tier does not imply moderation, and a
  moderator role does not imply Tasks access. Today's "Tasks app owner may
  moderate" rule becomes an explicit store staff grant when this lands.

## Database changes

1. **Account profile.** An `rmt_accounts` table, or `profiles` reshaped into an
   account record, holding fields every property can read for the signed-in
   user.
2. **Explicit Tasks membership.** `handle_new_user` stops assigning a tier, and
   `is_team_member()` checks for a membership record rather than a profile.
   Backfill memberships for every onboarded profile so nobody loses access.
3. **Invite becomes grant.** The team invite creates the auth user when none
   exists and otherwise elevates the existing account. Removing a member
   revokes the membership and leaves the account intact.
4. **Property tables keyed to accounts.** Domain tables keep their prefixes
   (`store_*`, later `ryancon_*`) and reference the account ID. A linked
   identities table maps external subjects, such as a Shopify customer, to an
   account.

**PRD constraint.** Steps 2 and 3 change Tasks' own schema, so they are shared
migrations that must also reach `projects.ryanle.dev`. They must leave PRD
behaving exactly as today: invite-only, with an invite creating both the
account and its membership. Steps 1 and 4 are RMT-only extensions with `rmt_`
or property prefixes and `rmtOnly` entries.

## Sign-in and sessions

- **Supabase Auth on RMT is the identity provider** for every Ryan Meetup
  property. Enabling signups is a project-wide setting, so it waits until
  explicit membership (step 2) has shipped.
- **A central accounts host**, for example `accounts.ryanmeetup.com`, owns
  signup, sign-in, password reset, profile and linked identities. Other apps
  redirect there.
- **Shared sessions on `*.ryanmeetup.com`** can come from scoping the auth
  cookie to `.ryanmeetup.com`. A property on another registrable domain needs
  a redirect-based handoff instead. RyanCon's production domain is not
  recorded in the repo yet and decides which applies.
- **PRD is excluded.** It keeps its own auth and never trusts RMT sessions.
- **Public signup needs abuse controls from the start:** CAPTCHA, email
  verification, rate limits, custom SMTP and Ryan Meetup–branded auth emails.

## The store

**Link Shopify to the account; do not replace Shopify sign-in.**

- Shopify remains the authority for orders, and buying never requires a Ryan
  Meetup account. Guest checkout stays.
- A signed-in user links their Shopify customer once through the existing
  Customer Account OAuth flow. Their orders and reviews can then appear under
  their Ryan Meetup account.
- Reviews keep `customer_subject` as the owner. Ownership by account resolves
  through the linked identity, so the review schema needs at most an optional,
  nullable account reference rather than a rewrite.
- Using our own sign-in as Shopify's identity provider is, as far as we know,
  a Shopify Plus feature. Confirm before planning around it.

## Security boundaries

- **Narrow each app's access.** Before more apps join, replace the store's
  project-wide secret with a scoped server interface, so a compromised property
  server cannot read Tasks data. New properties start on that interface, not on
  a copy of the secret.
- **Audit grants before strangers can sign in.** The earlier local audit found
  32 public-schema functions executable through `PUBLIC`. Under invite-only
  signup every authenticated caller is trusted; under open signup every
  function `authenticated` can execute is reachable by anyone.
- **Test isolation both ways:** a plain account cannot read Tasks data, store
  drafts or another buyer's records, and a Tasks member gains no property staff
  role without an explicit grant.

## Phases

| Phase | Outcome | Depends on |
| --- | --- | --- |
| 1. Decouple membership | Explicit Tasks membership, backfill, invite-as-grant. No visible change on either instance. | Shared migration and a PRD SQL Editor handoff |
| 2. Harden for strangers | Function and grant audit, scoped app access replacing the store secret, RLS tests for a plain account, explicit store staff grants | Phase 1 |
| 3. Accounts host | Public signup, profile, Shopify linking, sessions across `*.ryanmeetup.com` | Phase 2 |
| 4. Properties adopt | Store account pages, RyanCon registration, owners elevating accounts from `/admin/access` | Phase 3 |

Phase 1 is worth doing early even while signup stays closed. It removes the
risk that flipping the Supabase signup setting silently admits the public to
RMT.

## Open decisions

1. **ryanmeetup.com features.** Do plain accounts get anything on the main
   site, such as RSVPs, chapter membership or newsletter preferences? This
   decides whether the main site needs auth in the first adopting phase.
2. **Elevation flow.** Do owners elevate accounts directly from
   `/admin/access`, or can people request access for approval?
3. **Sign-in methods.** Email and password, magic link, Google, or a mix. This
   shapes auth emails and abuse controls.
4. **One login for work and public use.** Does an RMT member use the same
   account to buy merch and review products, or keep a separate work identity?
5. **RyanCon's domain.** A `ryanmeetup.com` subdomain allows shared cookies;
   its own domain requires redirect-based sign-in.
