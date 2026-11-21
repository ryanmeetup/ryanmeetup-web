# Access control specification

This document defines the Tasks authorization model. Supabase row-level
security and the canonical database functions enforce these rules; UI filters
and access previews only explain or simulate them.

## Workspace authority

- App owners and organizational tiers with workspace-wide content access have
  manager access to every current and future project and category.
- Workspace-wide tiers remain available in every access-group picker. Their
  explicit grants are stored like any other group's. Page restrictions are an
  independent boundary: only app owners bypass them, so a workspace-wide tier
  must be selected explicitly to open a restricted page.
- Every onboarded member belongs to one organizational tier and may also belong
  to lateral teams.
- Exactly one tier is the new-member default. Owners can change that default;
  inviting a teammate assigns it automatically. A person's app role, required
  tier, and optional teams are replaced together in one transaction so a
  partially saved form cannot leave contradictory access behind.
- Higher organizational tiers inherit the selected-project and category grants
  of lower tiers. Teams do not inherit from other teams.
- A tier may be a **guest tier**, for people outside the organization such as
  a fulfillment partner. Its members reach only what is granted to that tier
  or to a team they belong to. Every rule that opens content to "every
  onboarded member" skips them: open projects, open categories, projectless
  tasks, open and unconfigured pages, and the member directory (a guest reads
  only their own profile). Tier inheritance does not cross the guest boundary
  in either direction. A guest tier cannot carry workspace-wide content access
  and cannot be the new-member default. `member_is_guest` (service role) and
  `is_guest` (the caller only) answer the question; `can_view_open_content`
  is the gate on every open-to-everyone rule. A guest with a current (not
  complete or dropped) project granted to their tier or a team works it like
  a member: the dashboard, the task
  board, the project list, the project page, and its task pages open, holding
  only the projects RLS returns them. Creating projects and tasks, activity,
  and categories stay closed. Outside those and its granted pages the app
  redirects a guest to the dashboard when a current project is shared, otherwise to
  the first granted page, or to a welcome on the dashboard route that names
  the app owners to ask when there is none, and hides navigation to work open
  to the workspace; that is presentation, and RLS remains the boundary.
- Group membership and category visibility are app-owner administrative data.
  Project visibility is available to app owners and that project's named
  owners. Every visibility change must be audited.
- Workspace-wide content managers may manage project content, but that broader
  role does not let them administer project visibility unless they are also a
  named owner of that project. The database predicate
  `can_administer_project_access` is the source of truth for this distinction,
  and `set_project_visibility` is the only supported update path for a
  project's access mode and complete group set.

## Projects

Each project has one visibility mode:

- `owners`: only named project owners and workspace-wide managers can access it;
- `open`: every onboarded workspace member can collaborate on it;
- `restricted`: members of one or more selected access groups can collaborate
  on it.

Named project owners receive manager access directly, independently of their
group membership. Collaborators can view the project and create or edit its
tasks and attachments. They cannot change project details, status, owners,
visibility, or deletion state. New projects default to `owners` and require
at least one named owner.

Project creation writes the project, its named owners, visibility mode, and any
selected groups in one transaction. Changing visibility replaces the complete
selected-group set atomically. A failed or incomplete write must never broaden
visibility.

There are no direct per-user project grants. A person reaches a project only as
an app owner or workspace-wide manager, as a named project owner, through the
project's visibility mode, or through an access-group grant (including tier
inheritance). `project_owners`, `projects.access_mode`, and
`project_group_grants` are the canonical project-access records.

## Categories

Categories are open by default. An open category is available to every member;
a restricted category is available only through its selected access groups and
workspace-wide management authority. A restricted category with no selected
groups is therefore workspace-manager-only.

Category ownership is descriptive metadata. Category creation, editing, and
visibility remain limited to members with workspace-wide content management.

## Pages

Notes, Contacts, the Calendar, and RY-D Verification can each be locked as a whole. The set of
lockable pages is owned by the application registry in
`lib/access/workspace-areas.ts`, not by the database; `workspace_area_access`
holds a row only for a page an app owner has configured.

- An unconfigured Notes, Contacts, or Calendar page is open to every onboarded
  member. RY-D requires an explicit access row: if it is missing, only
  onboarded app owners retain their override.
- A restricted page is available only through its selected access groups and
  app ownership. A restricted page with no selected groups is therefore
  app-owner-only.
- Setting a page's mode replaces its complete selected-group set atomically. A
  failed or incomplete write must never broaden access.
- Page access is checked before every other check on that page's content, and
  it gates the whole surface: the rows, the route, the sidebar entry, the API
  boundary, and the page's resource activity.
- Which groups reach a page is owner-only administrative data. Members never
  read `workspace_area_access` or `workspace_area_group_grants`; they ask
  `accessible_workspace_areas`, which answers about themselves only. Every
  change must be audited.
- `access_groups.calendar_access` remains a sub-permission of the Calendar
  page: it decides whether the synced Google feed renders for a member who can
  already open the page, never whether the page opens.
- Contact images live in a public storage bucket, so an existing image URL
  stays reachable regardless of page access; what page access decides for that
  bucket is who may add, replace, or remove an image.
- `member_can_view_workspace_area(member, area)` owns the page-access rule.
  `can_view_workspace_area` asks it about the signed-in member, while
  `workspace_area_members(area)` uses it for worker recipients and
  `ryd_require_operator` uses it before writes. The per-member predicate and
  recipient list are service-role-only; members cannot probe other identities.
- RY-D is available only when its instance feature is enabled. Its tables are
  service-role-only and its evidence proxy can access a connected Drive account,
  so both page loading and APIs must deny access when the page-access function
  is missing. The legacy pre-migration open fallback does not apply to RY-D.
- RY-D starts restricted to the lateral RY-D team and explicitly selected
  administrator tiers with workspace-wide content access. Higher tiers inherit
  those selected tier grants; app owners retain their override. Page access
  grants RY-D operation without granting workspace administration or access
  to other restricted pages.
- RY-D Settings (`ryd-settings`) gates the review form, fulfillment's
  address, the upload reminder, and the Google connection. It is a fixed rule,
  not a configurable page: it opens to app owners and members of a tier with
  workspace-wide content access, and to nobody else. It takes no
  `workspace_area_access` row or group grants, `set_workspace_area_access`
  refuses it, and the registry marks it `workspaceWideOnly`: Page access
  leaves it out, and group explanations and the preview state the same rule. The settings
  and Google routes require it in addition to RY-D, and the page hides its
  settings entry points without it.

## Store customer authentication storage

`store_customer_authorizations` and `store_customer_sessions` hold private
Shopify authorization/session records for the shared Ryan Meetup backend.
Both have RLS enabled, no anonymous/member grants or policies, and explicit
service-role grants. Their five `store_*customer_*` RPCs are service-role-only,
use an empty search path, and run as the invoker. They do not create Supabase
Auth users, Tasks profiles, or workspace memberships.

The storefront server uses RMT's Supabase secret key directly (decided
November 18, 2026, replacing the earlier `POST /api/store/customer-auth` and
`POST /api/store/reviews` relays). That key bypasses RLS project-wide, so it
lives only in the store's server environment. The store pins the configured
shop, client, issuer, and callback, runs only seven fixed auth operations and
the fixed review RPCs, selects explicit return columns, and refuses any
project but RMT, so PRD can't be configured. It has no direct SQL login.
Creating a new SQL role alone would inherit the project's PUBLIC privileges;
`NOINHERIT` does not remove them. Existing workspace grants remain unchanged.

Authorization secrets and buyer tokens are authenticated encrypted envelopes;
only random browser identifiers are hashed into lookup keys. Consuming a flow
checks browser, shop, client, issuer, callback, and expiry atomically, erases
its envelope, and keeps a tombstone against repeat creation until cleanup.
Session refresh compares its revision, preserves subject and absolute expiry,
and cannot revive revoked sessions. Revocation erases the token envelope and
advances the revision, so an in-flight stale refresh cannot overwrite logout.
The store's encryption context additionally binds record identity and expiry.

## Store review photo staging

RMT-only migration `20261120220000` adds `store_review_photo_drafts` and the
private `store-review-photos` bucket. Draft rows have RLS and explicit
service-role grants; anonymous users and Tasks members have no table/RPC
access. The invoker, empty-search-path photo RPCs scope reads and transitions
by shop, buyer subject and product. The Store must establish that subject and
product through the authenticated server flow before calling these private
primitives; the RPCs do not independently authenticate a Shopify buyer.

Allocation serializes each buyer/product quota with a transaction advisory
lock. At most five unexpired uploading/ready rows are active, with an initial
one-hour staging expiry. A scoped request key reuses the same content digest,
dimensions and size; changed content conflicts and discarded/expired keys do
not revive. Finalization requires the matching digest and current ownership/
expiry; discard is idempotent. No review is created or published by staging.

Storage paths are derived from the pinned shop and generated draft UUID, never
a caller path or buyer identity. Only processed WebP objects up to 4 MiB are
stored. A restrictive `storage.objects` policy excludes this bucket for
anonymous/authenticated roles even if a permissive policy exists elsewhere;
other buckets retain their current behavior. Service-role access remains
project-wide, so the key stays server-only. No signed browser capability or
public object URL is issued by the staging service.

Lost upload responses are recovered only after comparing the stored bytes
with the exact expected digest. Uncertain database finalization never deletes
an object. Discard must be confirmed in the owner scope before object removal;
failed removal leaves a private discarded record for explicit retry/cleanup.
RMT-only migration `20261120230000` adds private upload budgets and ordered
revision-photo links, both with RLS and explicit service-only grants. The
shared shop/buyer budget serializes thirty attempts per ten minutes. Store's
same-origin raw-image route authenticates and rechecks Shopify sessions, limits
actual streamed bytes to 4 MiB and bounds per-process pipelines to two. Its
explicit feature flag defaults off.

Atomic submit/edit wrappers preserve canonical review ownership/version rules.
They lock the review, buyer/product scope and sorted photo rows, validate every
ready/unexpired private object, and claim each photo for one review. A bad
selection rolls back text, versions, audit and media together. Attached photos
cannot be returned/revived/discarded by draft RPCs and can only be retained by
the same review. Text-only edits retain the selection; explicit arrays replace
or remove it on the new pending revision. Approved selections remain intact.
Every new media decision starts pending; approving the revision approves its
still-pending images, and rejected images stay rejected. Public SQL still emits
no custom photos.

RMT-only migration `20261121000000` adds service-only invoker reads for the
buyer's current ordered photo references and server-only preview context.
Current follows buyer text: pending, approved, then latest buyer event attempt.
Ready drafts require current ownership/expiry; attached previews require
membership in that owned review's current selection. Removed/historical
selections cannot preview. A buyer may inspect their own hidden/withdrawn
current selection, without granting public access. There are no new grants to
anonymous users or Tasks members and no new table or publication path.

Store GET routes require the off-by-default photo flag and an
active Shopify session. Same-origin reads exclude cross-site and sibling-site
browser requests. Before returning bytes, the server bounds the private stream,
checks its expected size/digest, repeats photo authorization and rechecks session
identity. Four preview pipelines per process and ten-second download/body bounds
limit work. Responses are uncached WebP with same-origin resource policy, cookie
variance and nosniff; no signed URL or object path reaches a browser. UI wiring,
staff media decisions/publication and lifecycle cleanup remain unimplemented.

## Store buyer review management

The storefront's `/reviews/mine` and `GET/POST /api/reviews/mine` use its encrypted
Shopify customer session, never Tasks membership. Custom mode and configured
sign-in are required. Browser mutations require the storefront origin and a
bounded JSON body. Reads also refuse cross-site/same-site browser requests.
The server rechecks the same immutable session after reads and immediately
before dispatching a write; subject, shop, and public name are never accepted
from the browser. Browser results omit session material, customer subjects,
order IDs, staff actors, and private moderation notes. A one-way session equality
marker prevents merging lists when sign-in changes between pages.

The service-only, invoker, empty-search-path `store_buyer_reviews` projection
filters by configured shop and verified subject, with bounded creation-time
keyset pagination or an exact review ID. `store_buyer_reviewed_lines` filters
only requested purchased lines in that same scope. The private service route
permits only explicit commands and validates exact return projections. It always
refuses PRD and grants no Tasks membership or direct table privileges.

`store_edit_buyer_review` and `store_withdraw_buyer_review` recheck shop/subject
and the exact expected timestamp under the review row lock, then delegate to
the canonical atomic revision/audit transactions. Edits preserve approved public
content; hidden reviews cannot be edited. Withdrawal removes public content and
rating totals, and repeating an already completed withdrawal creates no new
write/event. Uncertain outcomes clear stale controls and never retry a mutation
automatically. These functions are in RMT-only migration `20261120180000`.

## Store review moderation

`GET/POST/PATCH /api/admin/reviews` is a Tasks app-owner boundary, separate from the
storefront's database access and Shopify buyer identity. Reads and writes
require `privilegedContext({ owner: true })`; the enabled backend configuration
pins the shop and Supabase project and always refuses PRD. Request bodies cannot
choose an actor or shop. Browser writes use the normal same-origin, bounded JSON
schema boundary. Every response is private and uncached; database failures expose
only safe messages and correlation IDs.

`/store-reviews` checks the same owner authority through `loadWorkspacePage`
before loading its initial private queue on the server, then answers 404 on an
instance without the store backend; `/admin/reviews` permanently redirects
there. Demo preview redirects away. The sidebar lists the page only for an
onboarded owner on an instance with the backend, and never during an access
preview. Its badge reads `GET /api/admin/reviews/pending-count`, which uses the
same owner context and counts pending revisions on unwithdrawn reviews for the
pinned shop through the service role, matching the queue's `pending` filter. A
failed count shows no badge rather than a zero. Browser decisions wait for a confirmed transaction, then reload. Stale
or uncertain outcomes never automatically repeat a write, and an unavailable
refresh removes stale decision controls until a fresh read succeeds.

The RMT-only `store_review_moderation_page` and `store_moderate_review` functions
are invoker functions with empty search paths and service-role-only execute
grants. Both call `store_require_review_owner`, which rechecks and share-locks
the actor's onboarded owner profile for the transaction. No direct buyer/member
table grants, moderation RPC access, or additional workspace memberships result.

The queue includes all ratings, oldest first, with bounded keyset pagination.
Its explicit projection distinguishes waiting and approved revisions, omits
order IDs and customer subjects, and includes at most ten recent audit events.
Buyer event identities are omitted. Full revision/event history stays in the
private tables. Publishing, rejecting, hiding, and restoring use the canonical
review transactions and commit their audit events atomically. Hiding and
rejecting require a private reason. The app-authenticated actor, exact review
timestamp, and selected pending revision are checked under a review row lock.
Replaced edits, stale views, and withdrawn reviews cannot receive a decision.
Rejecting an edit preserves the approved version; approving a hidden edit never
restores it. Public reads and rating totals exclude hidden/withdrawn reviews and
never include staff identities or notes.

Official replies use `store_save_review_reply`, a service-only invoker function
that rechecks the owner, shop, approved review, nonwithdrawn state, and exact
review timestamp under the same review-first lock order. Set/update/remove and
their required audit event commit together, and every successful reply change
advances the review version. Hidden reviews remain hidden. Blank strings cannot
remove a reply: the HTTP boundary requires an explicit null and normalizes
nonempty public text through the shared reply contract. Staff identity is taken
from the authenticated Tasks actor, never a browser field.

The reply-aware staff projection is `store_review_moderation_page_v2`. It reads
reply and review version from one snapshot; v1 stays unchanged for older
deployments. No table or RPC privileges are widened, the public reply shape is
unchanged, and the moderation endpoints accept only a Tasks owner session.

Staff deletion uses service-role-only `store_delete_review`, which rechecks the
owner, shop, and exact review version, accepts only the policy reasons, and
writes an append-only `store_review_deletions` audit row in the same
transaction. The backend role may insert and select that table but never update
or delete it; anon and Tasks members cannot reach it.

## RY-D Verification

RY-D review writes use service-role-only `ryd_change_submission`,
`ryd_review_order`, and `ryd_set_production`. They recheck the actor's page
authority, serialize competing response claims, and write audit events in the
same transaction. A response belongs to one order; production requires a
verified decision. Routes validate new response references against the configured
Google form, and the transaction refuses a changed form or stale order revision.

Bulk decisions use service-role-only `ryd_review_orders`, with the instance and
page gate checked before parsing the request. The route validates the union of
new response references against one fresh form read. The transaction locks
settings, sorted response keys, and sorted orders, then delegates to
`ryd_review_order`. Authored per-order refusals roll back that order's card,
pairings, status, and audit events while allowing eligible orders to commit.
Unexpected database failures abort the whole group. Bulk review never changes
an order already sent to fulfillment or done, and responses omit raw CSV rows.

Fulfillment generation uses service-role-only `ryd_generate_fulfillment`.
It is read-only and rechecks the actor and every selected ID against one
consistent database snapshot. Missing or ineligible orders reject the whole
selection. It returns exactly the selected ready orders and configured
recipient; it never saves an email, CSV, reservation, receipt, or send event.
The browser holds the generated content only while the dialog is open.
Historical snapshot records stay private, but are no longer loaded into the
queue and cannot reserve decisions or evidence. Reservation triggers are
removed. Current routes expose no saved-batch mutations; the private legacy
RPCs remain available to older deployments during rollout.

Fulfillment stages are manual. `ryd_move_production` supports Ready to send,
Sent to fulfillment, and Done, checking each original stage under sorted row
locks, and reads the retired `not-started` and `in-production` values from
older clients as Ready to send and Sent to fulfillment. Marking sent stores
minimal handoff metadata, the send date in `production_sent_at`, and an audit
event, never an email body, CSV, or recipient. Returning an order to Ready to
send clears its handoff flag and send date without deleting historical
events.
Idempotent receipts keep retries from repeating stage changes. Generation,
opening mail, downloading, and closing the dialog never move orders or update
Google Sheets. Historical fulfillment manifests remain private database
records; the retired snapshot download route is no longer exposed.

Imports and reminder confirmations use service-role-only `ryd_import_orders`
and `ryd_record_reminders`. They recheck the actor and commit their effects,
audit records, and private retry receipts together. Each operation key is bound
to its actor, operation kind, and a hash of the input. Receipts contain hashes
and summary counts, never a copied CSV or recipient list. Import counts and
history come only from inserted orders; a retry does not create another import.
Reminder confirmations pin the draft's recipients, skip orders no longer
waiting, and reject a changed email. Draft opening never records a send.

Bounded production and unmatched-contact confirmations use service-role-only
`ryd_move_production` and `ryd_record_contacts`. Each group and its receipt
commit together, with keys bound to the actor, operation kind, and canonical
input hash. Replays still require current RY-D authority. Production locks the
whole sorted order set and refuses a changed original stage; mixed backward
moves cannot partially save or repeat on retry. Contact attempts and their
receipt save together. Receipts retain summary counts and timestamps; canonical
orders and contact totals are queried for the response rather than copied into
receipts. `ryd_link_submissions` locks every response key before linking the
bounded group, so conflicting claims or audit failures roll back all its links.

## Tasks and related content

- A project task is visible only when the member can access its project and
  every category assigned to the task.
- Editing a task requires collaborator access to its project and access to all
  assigned categories.
- Projectless tasks remain available to onboarded workspace members, subject to
  their category restrictions.
- Task comments, subtasks, labels, activity, attachments, calendar entries, and
  other related rows must use the same canonical task/project/category checks.
- Assignees must be eligible for the task's project. Named project owners,
  members of selected groups, members with workspace-wide access, and all
  onboarded members of an open project are eligible.
- Task-related tables ask their read question as `task_id in (select id from
  public.tasks)` rather than by calling `can_view_task` per row. That is the
  same rule — the `tasks` SELECT policy is `can_view_task` — resolved once per
  statement instead of once per row, and it keeps the canonical check in one
  place. `reachable_category_ids` and `tasks_with_unreachable_categories` are
  the set forms of `can_access_category` and `can_access_task_categories` and
  exist for the same reason; they are `security definer` because a category on
  a task you cannot see must still hide it from you.
- Only a table's SELECT policy governs reads. A `for all` policy also arms
  SELECT, so a write policy whose predicate is narrower than the table's read
  policy must be written as explicit `for insert` / `for update` / `for delete`
  policies. Widening a read by way of a write policy is a bug.

## Personal saved task views

Saved task views belong to one profile. Only that onboarded person may read,
create, update, or delete their views; app ownership does not override this
privacy boundary. RLS enforces ownership, and API writes also constrain the
profile to the authenticated caller. Views store filter references and layout
preferences, never task copies or access grants. Applying a view still uses
the normal task/project/category access checks. Access previews do not load
personal saved views. If a referenced resource becomes unavailable, applying
the view is refused rather than silently broadening its filters.

## External read authority

The optional MCP bearer token is a separate workspace-wide read authority. It
uses the server service role and deliberately does not impersonate a person or
inherit tier, team, resource, or page restrictions. Its enabled state and a
masked token-hash fingerprint must be visible to app owners on the Admin
overview. It must never be presented as another access group or project grant.

## Diagnostics and failure behavior

- Access preview is an owner-only diagnostic projection. It must include open
  projects, named project ownership, group inheritance, workspace-wide access,
  category restrictions, and page restrictions, but it never authorizes a
  request. Previewing a subject who cannot open a page answers the way that
  subject's own request would.
- A preview renders exactly what its subject sees: their role, guest status,
  category management, and project edit rights, never the owner's. A group
  preview is a member of that group. A combined preview
  (`viewAsGroup=Guest,RY-D`) is a member holding exactly those groups, so it
  takes at most one tier and resolves through the same membership rules as
  previewing a real person, minus named project ownership. Navigation stays live and keeps the
  preview; every other interaction is inert through one document-level guard
  (`useAccessPreviewGuard`), and action routes (`/new`, `/edit`, `/admin`,
  `/profile`) stay shut. Components do not hide controls because a preview is
  running.
- Required authorization lookups fail closed. Missing rows, failed functions,
  or unavailable access metadata deny the operation rather than falling back
  to wider access.
- Project, category, and page visibility mutations must preserve audit records
  and expose pending or error state in the UI.
- The one tolerated absence is a migration that has not been applied yet: with
  no `accessible_workspace_areas` function and no policy referencing it, no
  page is restricted, so treating every page as open reports the database's
  actual state rather than widening it. Any other failure of an area lookup
  denies.
