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
tasks and attachments. They cannot change project details, owners, visibility,
archive state, or deletion state. New projects default to `owners` and require
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

Notes, Contacts, and the Calendar can each be locked as a whole. The set of
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
- RY-D starts restricted to the lateral RY-D team and explicitly selected
  administrator tiers with workspace-wide content access. Higher tiers inherit
  those selected tier grants; app owners retain their override. Page access
  grants full RY-D operation, including settings and Google connection setup,
  without granting workspace administration or access to other restricted pages.

## RY-D Verification

RY-D review writes use service-role-only `ryd_change_submission`,
`ryd_review_order`, and `ryd_set_production`. They recheck the actor's page
authority, serialize competing response claims, and write audit events in the
same transaction. A response belongs to one order; production requires a
verified decision. Routes validate new response references against the configured
Google form, and the transaction refuses a changed form or stale order revision.

Fulfillment uses private, service-role-only snapshots. `ryd_prepare_fulfillment`
resumes the one prepared manifest or captures it under order locks.
`ryd_finish_fulfillment` confirms or cancels it with the same actor check.
Prepared ready orders cannot change decision, export data, or evidence until
finished. Confirmation atomically records the batch, clears its captured ready
IDs, and writes their history; retries add no writes. Snapshots retain their
fulfillment rows for batch history, including cancellations, under the same
private access boundary as orders. No Google answers or media are copied.


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
