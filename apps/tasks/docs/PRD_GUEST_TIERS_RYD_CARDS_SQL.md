# PRD: guest tiers, RY-D Settings access, and RY-D cards

Run these in the **PRD** Supabase SQL Editor (`vjsnobmfsfrsnwukfaoq`), never
RMT. RMT is applied with `supabase db push` and verified separately.

**Block 1 is the one that matters on PRD.** It adds guest tiers and makes RY-D
Settings its own lockable page. Guest tiers change the core access functions
(projects, categories, projectless tasks, pages, the member directory), so PRD
should match RMT. Nobody becomes a guest until an owner marks a tier as one,
and RY-D stays off on PRD, so nothing anyone sees changes. The app already
tolerates this block being missing, so deploys don't wait on it.

**Block 2 is schema parity only.** It adds RY-D cards and card batches. RY-D
stays disabled on PRD and nothing reads these tables there. It needs PRD's
earlier RY-D tables (`ryd_orders`, `ryd_write_receipts`, and the rest from the
[contract repair](PRD_RYD_CONTRACT_SQL.md)); if any are missing the block
fails and rolls back without changing anything.

Both blocks are copied from the committed migrations, record their migration
history, and are safe to run again.

## Block 1: guest tiers and RY-D Settings access (run on PRD)

```sql
begin;

-- ===== 20261111000000_guest_access_tiers.sql =====
-- Guest tiers: an organizational tier for people outside the organization,
-- such as a fulfillment partner who works one page. A guest reaches only what
-- is granted to their own tier or to a team they belong to. Every rule that
-- opens content to "every onboarded member" skips them: open projects, open
-- categories, projectless tasks, unconfigured or open pages, and the member
-- directory. Tier inheritance does not cross the guest boundary in either
-- direction, so a guest never inherits a lower tier's grants and no other tier
-- inherits a guest tier's.

alter table public.access_groups
  add column if not exists guest boolean not null default false;

comment on column public.access_groups.guest is
  'Members of this tier reach only content granted to it or to their teams; open-to-everyone rules skip them.';

alter table public.access_groups
  drop constraint if exists access_groups_guest_shape;
alter table public.access_groups
  add constraint access_groups_guest_shape check (
    not guest or (kind = 'tier' and not grants_global_content and not is_default)
  );

-- About any member. Service-role only, so members cannot probe others.
create or replace function public.member_is_guest(requested_member uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.access_group_members membership
    join public.access_groups member_tier on member_tier.id = membership.group_id
    where membership.profile_id = requested_member
      and member_tier.kind = 'tier'
      and member_tier.guest
  );
$function$;

revoke all on function public.member_is_guest(uuid) from public, anon, authenticated;
grant execute on function public.member_is_guest(uuid) to service_role;

-- About the caller only; the app uses it to shape navigation.
create or replace function public.is_guest()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select auth.uid() is not null and public.member_is_guest(auth.uid());
$function$;

revoke all on function public.is_guest() from public, anon;
grant execute on function public.is_guest() to authenticated, service_role;

-- The gate on every "open to every onboarded member" rule.
create or replace function public.can_view_open_content()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select public.is_team_member() and not public.member_is_guest(auth.uid());
$function$;

revoke all on function public.can_view_open_content() from public, anon;
grant execute on function public.can_view_open_content() to authenticated, service_role;

create or replace function public.member_has_group_access(requested_profile_id uuid, requested_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.access_groups requested_group
    where requested_group.id = requested_group_id
      and (
        (requested_group.kind = 'team' and exists (
          select 1 from public.access_group_members membership
          where membership.profile_id = requested_profile_id
            and membership.group_id = requested_group.id
        ))
        or
        (requested_group.kind = 'tier' and exists (
          select 1
          from public.access_group_members membership
          join public.access_groups member_tier on member_tier.id = membership.group_id
          where membership.profile_id = requested_profile_id
            and member_tier.kind = 'tier'
            and (
              member_tier.id = requested_group.id
              or (
                not member_tier.guest
                and not requested_group.guest
                and member_tier.hierarchy_rank >= requested_group.hierarchy_rank
              )
            )
        ))
      )
  );
$function$;

create or replace function public.project_permission_for(requested_project_id uuid)
returns public.project_permission
language sql
stable
security definer
set search_path to ''
as $function$
  select case
    when not public.is_team_member() then null::public.project_permission
    when public.has_global_content_access(auth.uid()) then 'manager'::public.project_permission
    when exists (
      select 1 from public.project_owners owner_row
      where owner_row.project_id = requested_project_id
        and owner_row.profile_id = auth.uid()
    ) then 'manager'::public.project_permission
    when public.can_view_open_content() and exists (
      select 1 from public.projects project
      where project.id = requested_project_id
        and project.access_mode = 'open'
    ) then 'editor'::public.project_permission
    when exists (
      select 1 from public.project_group_grants grant_row
      where grant_row.project_id = requested_project_id
        and public.member_has_group_access(auth.uid(), grant_row.group_id)
    ) then 'editor'::public.project_permission
    else null::public.project_permission
  end;
$function$;

create or replace function public.can_assign_to_project(requested_profile_id uuid, requested_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select public.is_app_owner() or exists (
    select 1
    from public.profiles profile
    where profile.id = requested_profile_id
      and profile.onboarding_completed
      and (
        (requested_project_id is null and not public.member_is_guest(profile.id))
        or public.has_global_content_access(profile.id)
        or exists (
          select 1 from public.project_owners owner_row
          where owner_row.project_id = requested_project_id
            and owner_row.profile_id = profile.id
        )
        or (not public.member_is_guest(profile.id) and exists (
          select 1 from public.projects project
          where project.id = requested_project_id
            and project.access_mode = 'open'
        ))
        or exists (
          select 1 from public.project_group_grants grant_row
          where grant_row.project_id = requested_project_id
            and public.member_has_group_access(profile.id, grant_row.group_id)
        )
      )
  );
$function$;

create or replace function public.can_access_category(requested_category_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select public.has_global_content_access(auth.uid())
    or exists (
      select 1
      from public.work_groups category
      where category.id = requested_category_id
        and (
          (category.access_mode = 'open' and public.can_view_open_content())
          or exists (
            select 1
            from public.category_group_grants grant_row
            where grant_row.category_id = category.id
              and public.member_has_group_access(auth.uid(), grant_row.group_id)
          )
        )
    );
$function$;

create or replace function public.can_view_task(requested_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select (
    case
      when task_row.project_id is null then public.can_view_open_content()
      else public.can_view_project(task_row.project_id)
    end
  ) and public.can_access_task_categories(task_row.id)
  from public.tasks task_row
  where task_row.id = requested_task_id;
$function$;

create or replace function public.can_edit_task(requested_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select (
    case
      when task_row.project_id is null then public.can_view_open_content()
      else public.can_edit_project(task_row.project_id)
    end
  ) and public.can_access_task_categories(task_row.id)
  from public.tasks task_row
  where task_row.id = requested_task_id;
$function$;

create or replace function public.member_can_view_workspace_area(requested_member uuid, requested_area text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.profiles profile
    where profile.id = requested_member and profile.onboarding_completed
      and (
        profile.app_role = 'owner'
        or exists (
          select 1 from public.workspace_area_access area_row
          where area_row.area = requested_area
            and (
              (area_row.access_mode = 'open' and not public.member_is_guest(profile.id))
              or (area_row.access_mode = 'restricted' and exists (
                select 1 from public.workspace_area_group_grants grant_row
                where grant_row.area = area_row.area
                  and public.member_has_group_access(profile.id, grant_row.group_id)
              ))
            )
        )
        or (requested_area is distinct from 'ryd'
          and not public.member_is_guest(profile.id)
          and not exists (
            select 1 from public.workspace_area_access area_row
            where area_row.area = requested_area
          ))
      )
  );
$function$;

create or replace function public.can_view_workspace_calendar()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select public.can_view_workspace_area('calendar') and (
    public.is_app_owner()
    or exists (
      select 1
      from public.access_group_members membership
      join public.access_groups access_group
        on access_group.id = membership.group_id
      where membership.profile_id = auth.uid()
        and access_group.calendar_access
    )
    or exists (
      select 1
      from public.access_group_members membership
      join public.access_groups member_tier
        on member_tier.id = membership.group_id
       and member_tier.kind = 'tier'
       and not member_tier.guest
      join public.access_groups granted_tier
        on granted_tier.kind = 'tier'
       and not granted_tier.guest
       and granted_tier.calendar_access
       and granted_tier.hierarchy_rank <= member_tier.hierarchy_rank
      where membership.profile_id = auth.uid()
    )
  );
$function$;

create or replace function public.set_default_access_tier(requested_group_id uuid)
returns public.access_groups
language plpgsql
security definer
set search_path to ''
as $function$
declare
  saved_group public.access_groups;
begin
  if not public.is_app_owner() then
    raise exception 'Only app owners may change the default tier'
      using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.access_groups
    where id = requested_group_id and kind = 'tier'
  ) then
    raise exception 'The requested access group is not a tier'
      using errcode = 'RS001';
  end if;
  if exists (
    select 1 from public.access_groups
    where id = requested_group_id and guest
  ) then
    raise exception 'A guest tier cannot be the default for new members'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('public.access_groups.default_tier', 0)
  );
  update public.access_groups
  set is_default = false
  where is_default and id <> requested_group_id;
  update public.access_groups
  set is_default = true
  where id = requested_group_id
  returning * into saved_group;

  return saved_group;
end;
$function$;

-- Projectless tasks are open to every non-guest member.
drop policy if exists "members view accessible tasks" on public.tasks;
create policy "members view accessible tasks" on public.tasks
for select using (
  case
    when project_id is null then (select public.can_view_open_content())
    else project_id in (select projects.id from public.projects)
  end
  and (
    (select public.is_app_owner())
    or not (id in (select public.tasks_with_unreachable_categories()))
  )
);

drop policy if exists "editors create tasks" on public.tasks;
create policy "editors create tasks" on public.tasks
for insert with check (
  (select public.is_app_owner())
  or (
    ((project_id is null and (select public.can_view_open_content())) or public.can_edit_project(project_id))
    and created_by = (select auth.uid())
    and (assignee_id is null or public.can_assign_to_project(assignee_id, project_id))
  )
);

drop policy if exists "editors update tasks" on public.tasks;
create policy "editors update tasks" on public.tasks
for update using (public.can_edit_task(id))
with check (
  ((project_id is null and (select public.can_view_open_content())) or public.can_edit_project(project_id))
  and public.can_access_task_categories(id)
  and (assignee_id is null or public.can_assign_to_project(assignee_id, project_id))
);

-- The member directory and category ownership are for the organization.
-- A guest still reads their own profile through "members read own profile".
drop policy if exists "team reads profiles" on public.profiles;
create policy "team reads profiles" on public.profiles
for select using ((select public.can_view_open_content()));

drop policy if exists "members view category owner metadata" on public.category_owners;
create policy "members view category owner metadata" on public.category_owners
for select using ((select public.can_view_open_content()));

-- ===== 20261111000100_ryd_settings_access.sql =====
-- RY-D Settings becomes its own lockable page, so someone can work the RY-D
-- queue without changing the review form, fulfillment's address, the upload
-- reminder, or the Google connection. Like RY-D it needs an explicit access
-- row: unconfigured, it is owner-only rather than open. It starts restricted to
-- exactly the groups RY-D grants today, so nobody's access changes until an
-- owner narrows it in /admin/access.

create or replace function public.member_can_view_workspace_area(requested_member uuid, requested_area text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.profiles profile
    where profile.id = requested_member and profile.onboarding_completed
      and (
        profile.app_role = 'owner'
        or exists (
          select 1 from public.workspace_area_access area_row
          where area_row.area = requested_area
            and (
              (area_row.access_mode = 'open' and not public.member_is_guest(profile.id))
              or (area_row.access_mode = 'restricted' and exists (
                select 1 from public.workspace_area_group_grants grant_row
                where grant_row.area = area_row.area
                  and public.member_has_group_access(profile.id, grant_row.group_id)
              ))
            )
        )
        or (coalesce(requested_area, '') not in ('ryd', 'ryd-settings')
          and not public.member_is_guest(profile.id)
          and not exists (
            select 1 from public.workspace_area_access area_row
            where area_row.area = requested_area
          ))
      )
  );
$function$;

-- Seed once: a replay must not undo an owner's later narrowing.
do $seed$
begin
  if not exists (select 1 from public.workspace_area_access where area = 'ryd-settings') then
    insert into public.workspace_area_access (area, access_mode)
    values ('ryd-settings', 'restricted');
    insert into public.workspace_area_group_grants (area, group_id, granted_by)
    select 'ryd-settings', grant_row.group_id, grant_row.granted_by
    from public.workspace_area_group_grants grant_row
    where grant_row.area = 'ryd'
    on conflict do nothing;
  end if;
end;
$seed$;

insert into supabase_migrations.schema_migrations(version,name,statements) values
  ('20261111000000','guest_access_tiers',array['-- Applied from the committed dashboard handoff.']),
  ('20261111000100','ryd_settings_access',array['-- Applied from the committed dashboard handoff.'])
on conflict (version) do nothing;
notify pgrst, 'reload schema';
commit;
```

## Block 2: RY-D cards and card batches (run on PRD, after block 1)

```sql
begin;

-- ===== 20261112000000_ryd_cards.sql =====
-- The card a RY-D prints: name, location, and the year the buyer has been a
-- Ryan. NULL across the board means nobody has saved this order's card yet, and
-- the app shows a draft read from the export instead. Verifying requires a
-- complete saved card, so what was approved is exactly what gets printed.

alter table public.ryd_orders
  add column if not exists card_first_name text,
  add column if not exists card_last_name text,
  add column if not exists card_location text,
  add column if not exists card_ryan_since text,
  add column if not exists card_saved_by uuid references public.profiles (id) on delete set null,
  add column if not exists card_saved_at timestamptz;

alter table public.ryd_orders drop constraint if exists ryd_orders_card_shape;
alter table public.ryd_orders add constraint ryd_orders_card_shape check (
  char_length(card_first_name) <= 80
  and char_length(card_last_name) <= 80
  and char_length(card_location) <= 120
  and card_ryan_since ~ '^([0-9]{4})?$'
);

alter table public.ryd_order_events drop constraint if exists ryd_order_events_action_check;
alter table public.ryd_order_events add constraint ryd_order_events_action_check check (
  action in ('imported', 'status', 'note', 'linked', 'unlinked', 'emailed', 'sent', 'production', 'card')
);

-- Whether a stored card can be printed.
create or replace function public.ryd_card_complete(requested_order public.ryd_orders)
returns boolean
language sql
stable
set search_path to ''
as $function$
  select coalesce(
    btrim(requested_order.card_first_name) <> ''
    and btrim(requested_order.card_last_name) <> ''
    and btrim(requested_order.card_location) <> ''
    and requested_order.card_ryan_since ~ '^[0-9]{4}$'
    and requested_order.card_ryan_since::integer between 1900
      and extract(year from now())::integer,
    false
  );
$function$;

revoke all on function public.ryd_card_complete(public.ryd_orders) from public, anon, authenticated;
grant execute on function public.ryd_card_complete(public.ryd_orders) to service_role;

create or replace function public.ryd_review_order(
  requested_actor uuid,
  requested_order text,
  requested_patch jsonb,
  requested_form text default null,
  requested_keys text[] default '{}'
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  current_order public.ryd_orders;
  saved_order public.ryd_orders;
  key text;
  next_status text;
  next_note text;
  card jsonb := requested_patch->'card';
  card_changed boolean := false;
begin
  perform public.ryd_require_operator(requested_actor);
  -- Same lock order as ryd_change_submission: settings, response keys, order.
  perform 1 from public.ryd_settings where id for share;
  if jsonb_typeof(requested_patch) <> 'object' or requested_patch is null
    or exists (select 1 from jsonb_object_keys(requested_patch) k
      where k not in ('status', 'note', 'card', 'expectedStatus', 'expectedUpdatedAt'))
    or not (requested_patch ? 'status' or requested_patch ? 'note' or requested_patch ? 'card')
    or cardinality(requested_keys) > 100
    or (cardinality(requested_keys) > 0 and requested_patch->>'status' is distinct from 'verified') then
    raise exception using errcode = 'RY400', message = 'Choose a valid decision or note.';
  end if;
  if card is not null and (
    jsonb_typeof(card) <> 'object'
    or (select count(*) from jsonb_object_keys(card)) <> 4
    or exists (select 1 from jsonb_each(card) e
      where e.key not in ('firstName', 'lastName', 'location', 'ryanSince')
        or jsonb_typeof(e.value) <> 'string')
  ) then
    raise exception using errcode = 'RY400', message = 'Send every line of the card.';
  end if;
  for key in select distinct unnest(requested_keys) order by 1 loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ryd-response:' || key, 0));
  end loop;
  select * into current_order from public.ryd_orders where order_id = requested_order for update;
  if not found then
    raise exception using errcode = 'RY404', message = 'That order no longer exists.';
  end if;
  if (requested_patch ? 'expectedStatus' and requested_patch->>'expectedStatus' is distinct from current_order.status)
    or (requested_patch ? 'expectedUpdatedAt' and (requested_patch->>'expectedUpdatedAt')::timestamptz is distinct from current_order.updated_at) then
    raise exception using errcode = 'RY409', message = 'This order changed while you were reviewing it. Refresh and review it again.';
  end if;
  next_status := case when requested_patch ? 'status' then requested_patch->>'status' else current_order.status end;
  next_note := case when requested_patch ? 'note' then nullif(btrim(requested_patch->>'note'), '') else current_order.note end;
  if next_status is null or next_status not in ('pending', 'verified', 'needs_info', 'rejected')
    or char_length(next_note) > 2000 then
    raise exception using errcode = 'RY400', message = 'Choose a valid decision and a note of at most 2,000 characters.';
  end if;
  if next_status is distinct from current_order.status
    and (current_order.cleared_batch_id is not null or current_order.production_sent_at is not null) then
    raise exception using errcode = 'RY409', message = 'This order is already with fulfillment or in production. Its decision cannot be changed.';
  end if;

  saved_order := current_order;
  if card is not null then
    saved_order.card_first_name := btrim(card->>'firstName');
    saved_order.card_last_name := btrim(card->>'lastName');
    saved_order.card_location := btrim(card->>'location');
    saved_order.card_ryan_since := btrim(card->>'ryanSince');
    card_changed := saved_order.card_first_name is distinct from current_order.card_first_name
      or saved_order.card_last_name is distinct from current_order.card_last_name
      or saved_order.card_location is distinct from current_order.card_location
      or saved_order.card_ryan_since is distinct from current_order.card_ryan_since;
    if card_changed and (current_order.cleared_batch_id is not null
      or current_order.production_sent_at is not null or current_order.done_at is not null) then
      raise exception using errcode = 'RY409', message = 'This card has already gone to fulfillment. It cannot be changed.';
    end if;
    if card_changed and next_status = 'rejected' then
      raise exception using errcode = 'RY409', message = 'A cancelled order has no card to change.';
    end if;
    if char_length(saved_order.card_first_name) > 80 or char_length(saved_order.card_last_name) > 80
      or char_length(saved_order.card_location) > 120 or saved_order.card_ryan_since !~ '^([0-9]{4})?$' then
      raise exception using errcode = 'RY400', message = 'Keep names to 80 characters, the location to 120, and Ryan since to a four-digit year.';
    end if;
  end if;
  -- A verified card is printed as stored: verifying, or changing a verified
  -- card, needs every line.
  if next_status = 'verified' and (next_status is distinct from current_order.status or card_changed)
    and not public.ryd_card_complete(saved_order) then
    raise exception using errcode = 'RY400', message = 'Fill in every line of the card, with a four-digit Ryan since year, before verifying.';
  end if;

  for key in select distinct unnest(requested_keys) order by 1 loop
    perform public.ryd_change_submission(requested_actor, requested_order, key, 'link', requested_form, 'suggested');
  end loop;
  if next_status is distinct from current_order.status or next_note is distinct from current_order.note or card_changed then
    update public.ryd_orders set status = next_status, note = next_note,
      decided_at = case when next_status = current_order.status then decided_at when next_status = 'pending' then null else now() end,
      decided_by = case when next_status = current_order.status then decided_by when next_status = 'pending' then null else requested_actor end,
      card_first_name = saved_order.card_first_name,
      card_last_name = saved_order.card_last_name,
      card_location = saved_order.card_location,
      card_ryan_since = saved_order.card_ryan_since,
      card_saved_by = case when card_changed then requested_actor else card_saved_by end,
      card_saved_at = case when card_changed then now() else card_saved_at end,
      updated_at = clock_timestamp()
      where order_id = requested_order returning * into saved_order;
    if next_status is distinct from current_order.status then
      insert into public.ryd_order_events(order_id, action, detail, actor_id)
        values (requested_order, 'status', jsonb_build_object('from', current_order.status, 'to', next_status), requested_actor);
    end if;
    if next_note is distinct from current_order.note then
      insert into public.ryd_order_events(order_id, action, detail, actor_id)
        values (requested_order, 'note', jsonb_build_object('note', next_note), requested_actor);
    end if;
    if card_changed then
      insert into public.ryd_order_events(order_id, action, detail, actor_id)
        values (requested_order, 'card', jsonb_build_object(
          'firstName', saved_order.card_first_name,
          'lastName', saved_order.card_last_name,
          'location', saved_order.card_location,
          'ryanSince', saved_order.card_ryan_since,
          -- Changing a verified card re-approves it under the same authority.
          'approved', next_status = 'verified'
        ), requested_actor);
    end if;
  else saved_order := current_order;
  end if;
  return jsonb_build_object('ok', true, 'order', to_jsonb(saved_order));
end;
$function$;

-- ===== 20261113000000_ryd_card_batches.sql =====
-- Card batches: the file fulfillment prints from. Pulling one takes every
-- verified order with an approved card that is still ready to send, freezes
-- those cards, and marks the orders sent to fulfillment with the batch date in
-- the same transaction, so nothing is printed twice. A batch is downloaded
-- again from its frozen rows, never rebuilt from the live queue.

create table if not exists public.ryd_card_batches (
  id uuid primary key default gen_random_uuid(),
  order_count integer not null check (order_count > 0),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.ryd_card_batch_orders (
  batch_id uuid not null references public.ryd_card_batches (id) on delete cascade,
  order_id text not null references public.ryd_orders (order_id) on delete cascade,
  position integer not null check (position >= 0),
  first_name text not null,
  last_name text not null,
  location text not null,
  ryan_since text not null,
  primary key (batch_id, order_id),
  unique (batch_id, position)
);

create index if not exists ryd_card_batch_orders_order_idx
  on public.ryd_card_batch_orders (order_id);

-- Customer data: service role only, like every RY-D table.
alter table public.ryd_card_batches enable row level security;
alter table public.ryd_card_batch_orders enable row level security;
revoke all on public.ryd_card_batches from public, anon, authenticated;
revoke all on public.ryd_card_batch_orders from public, anon, authenticated;
grant all on public.ryd_card_batches to service_role;
grant all on public.ryd_card_batch_orders to service_role;

alter table public.ryd_write_receipts drop constraint if exists ryd_write_receipts_kind_check;
alter table public.ryd_write_receipts add constraint ryd_write_receipts_kind_check
  check (kind in ('import', 'reminder', 'production', 'contact', 'card-batch'));

create or replace function public.ryd_create_card_batch(requested_actor uuid, requested_operation uuid)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  receipt public.ryd_write_receipts;
  batch_id uuid;
  ids text[];
  result jsonb;
begin
  perform public.ryd_require_operator(requested_actor);
  if requested_operation is null then
    raise exception using errcode = 'RY400', message = 'Start a valid card download.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ryd-operation:' || requested_operation::text, 0));
  select * into receipt from public.ryd_write_receipts where operation_id = requested_operation;
  if found then
    if receipt.actor_id <> requested_actor or receipt.kind <> 'card-batch' then
      raise exception using errcode = 'RY409', message = 'That operation was used for different content. Start a new operation.';
    end if;
    return receipt.result;
  end if;
  -- One batch at a time, so two people pulling at once cannot share an order.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ryd-card-batch', 0));

  select array_agg(order_id order by created_at, order_id) into ids
  from (
    select o.order_id, o.created_at from public.ryd_orders o
    where o.status = 'verified'
      and o.cleared_batch_id is null
      and o.production_sent_at is null
      and o.done_at is null
      and public.ryd_card_complete(o)
    order by o.created_at, o.order_id
    for update
  ) ready;

  if ids is null then
    result := jsonb_build_object('batchId', null, 'orderCount', 0);
  else
    batch_id := gen_random_uuid();
    insert into public.ryd_card_batches (id, order_count, created_by)
      values (batch_id, cardinality(ids), requested_actor);
    insert into public.ryd_card_batch_orders
      (batch_id, order_id, position, first_name, last_name, location, ryan_since)
    select batch_id, o.order_id, ordinality::integer - 1,
      btrim(o.card_first_name), btrim(o.card_last_name), btrim(o.card_location), o.card_ryan_since
    from unnest(ids) with ordinality as picked(order_id, ordinality)
    join public.ryd_orders o on o.order_id = picked.order_id;
    -- The same handoff a manual "Mark sent to fulfillment" records.
    insert into public.ryd_fulfillment_batches (id, recipient, order_count, verified_count, sent_by)
      values (batch_id, null, cardinality(ids), cardinality(ids), requested_actor);
    update public.ryd_orders set cleared_batch_id = batch_id, updated_at = clock_timestamp()
      where order_id = any(ids);
    perform public.ryd_set_production(requested_actor, ids, 'in-production');
    insert into public.ryd_order_events (order_id, action, detail, actor_id)
      select unnest(ids), 'sent',
        jsonb_build_object('stage', 'sent-to-fulfillment', 'cardBatch', batch_id), requested_actor;
    result := jsonb_build_object('batchId', batch_id, 'orderCount', cardinality(ids));
  end if;

  insert into public.ryd_write_receipts (operation_id, actor_id, kind, input_hash, result)
    values (requested_operation, requested_actor, 'card-batch',
      encode(sha256(convert_to('card-batch', 'UTF8')), 'hex'), result);
  return result;
end;
$function$;

revoke all on function public.ryd_create_card_batch(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ryd_create_card_batch(uuid, uuid) to service_role;

-- The deployment contract now covers cards, card batches, and RY-D Settings.
create or replace function public.ryd_contract_health()
returns jsonb
language sql
stable
set search_path to ''
as $function$
with required_tables(name, columns, primary_key) as (values
  ('ryd_settings','id,form_id,fulfillment_email,updated_at,updated_by','id'),
  ('ryd_google_integrations','id,encrypted_refresh_token,account_email,connected_by,connected_at,updated_at','id'),
  ('ryd_imports','id,filename,headers,row_count,new_count,uploaded_by,uploaded_at','id'),
  ('ryd_fulfillment_batches','id,recipient,order_count,verified_count,sent_by,sent_at','id'),
  ('ryd_orders','order_id,sales_order,ordered_at,first_name,last_name,email,contact_method,raw,first_import_id,import_position,status,note,decided_by,decided_at,cleared_batch_id,last_emailed_at,created_at,updated_at,production_sent_at,production_sent_by,done_at,done_by,card_first_name,card_last_name,card_location,card_ryan_since,card_saved_by,card_saved_at','order_id'),
  ('ryd_order_submissions','order_id,submission_key,source,linked_by,linked_at','order_id,submission_key'),
  ('ryd_order_events','id,order_id,action,detail,actor_id,created_at','id'),
  ('ryd_dismissed_submissions','submission_key,dismissed_by,dismissed_at','submission_key'),
  ('ryd_submitter_contacts','id,email,contacted_by,contacted_at','id'),
  ('ryd_fulfillment_snapshots','id,state,recipient,headers,order_rows,verified_ids,response_keys,form_id,prepared_by,prepared_at,finished_by,finished_at','id'),
  ('ryd_write_receipts','operation_id,actor_id,kind,input_hash,result,completed_at','operation_id'),
  ('ryd_card_batches','id,order_count,created_by,created_at','id'),
  ('ryd_card_batch_orders','batch_id,order_id,position,first_name,last_name,location,ryan_since','batch_id,order_id')
), tables as (
  select r.*, pg_catalog.to_regclass('public.' || r.name) as oid from required_tables r
), required_rpcs(signature, service_callable) as (values
  ('member_can_view_workspace_area(uuid,text)',true),
  ('workspace_area_members(text)',true),
  ('ryd_require_operator(uuid)',true),
  ('ryd_change_submission(uuid,text,text,text,text,text)',true),
  ('ryd_review_order(uuid,text,jsonb,text,text[])',true),
  ('ryd_set_production(uuid,text[],text)',true),
  ('ryd_fulfillment_is_ready(uuid)',true),
  ('ryd_generate_fulfillment(uuid,text[])',true),
  ('ryd_import_orders(uuid,uuid,jsonb)',true),
  ('ryd_record_reminders(uuid,uuid,jsonb)',true),
  ('ryd_bulk_receipt(uuid,uuid,text,jsonb)',true),
  ('ryd_move_production(uuid,uuid,jsonb)',true),
  ('ryd_record_contacts(uuid,uuid,text[])',true),
  ('ryd_link_submissions(uuid,text,text[],text,text)',true),
  ('ryd_card_complete(public.ryd_orders)',true),
  ('ryd_create_card_batch(uuid,uuid)',true),
  ('ryd_guard_form_change()',false),
  ('ryd_contract_health()',true)
), rpcs as (
  select r.*, pg_catalog.to_regprocedure('public.' || r.signature) as oid from required_rpcs r
), required_checks(tab, name, expression) as (values
  ('ryd_orders','ryd_orders_status_check', $$CHECK ((status = ANY (ARRAY['pending'::text, 'verified'::text, 'needs_info'::text, 'rejected'::text])))$$),
  ('ryd_orders','ryd_orders_done_after_production_check', $$CHECK (((done_at IS NULL) OR (production_sent_at IS NOT NULL)))$$),
  ('ryd_orders','ryd_orders_verified_production_check', $$CHECK (((production_sent_at IS NULL) OR (status = 'verified'::text)))$$),
  ('ryd_fulfillment_snapshots','ryd_fulfillment_snapshots_state_check', $$CHECK ((state = ANY (ARRAY['prepared'::text, 'sent'::text, 'cancelled'::text])))$$),
  ('ryd_fulfillment_snapshots','ryd_fulfillment_snapshots_check', $$CHECK (((state = 'prepared'::text) = (finished_at IS NULL)))$$),
  ('ryd_fulfillment_snapshots','ryd_fulfillment_snapshots_check1', $$CHECK (((finished_at IS NULL) = (finished_by IS NULL)))$$),
  ('ryd_write_receipts','ryd_write_receipts_kind_check', $$CHECK ((kind = ANY (ARRAY['import'::text, 'reminder'::text, 'production'::text, 'contact'::text, 'card-batch'::text])))$$),
  ('ryd_orders','ryd_orders_card_shape', $$CHECK (((char_length(card_first_name) <= 80) AND (char_length(card_last_name) <= 80) AND (char_length(card_location) <= 120) AND (card_ryan_since ~ '^([0-9]{4})?$'::text)))$$)
), required_indexes(tab, name, definition) as (values
  ('ryd_order_submissions','ryd_order_submissions_one_order_idx', $$CREATE UNIQUE INDEX ryd_order_submissions_one_order_idx ON public.ryd_order_submissions USING btree (submission_key)$$),
  ('ryd_fulfillment_snapshots','ryd_fulfillment_one_prepared_idx', $$CREATE UNIQUE INDEX ryd_fulfillment_one_prepared_idx ON public.ryd_fulfillment_snapshots USING btree ((true)) WHERE (state = 'prepared'::text)$$)
), required_triggers(tab, name, signature, events) as (values
  ('ryd_settings','ryd_guard_form_change','ryd_guard_form_change()',19)
), failures(message) as (
  select 'Missing table: ' || t.name from tables t where t.oid is null
  union all
  select 'Missing column: ' || t.name || '.' || col.name from tables t
  cross join lateral pg_catalog.unnest(pg_catalog.string_to_array(t.columns, ',')) col(name)
  where not exists (select 1 from pg_catalog.pg_attribute a where a.attrelid=t.oid and a.attname=col.name and a.attnum>0 and not a.attisdropped)
  union all
  select 'Unsafe table access: ' || t.name from tables t
  where t.oid is not null and (
    not exists(select 1 from pg_catalog.pg_class c where c.oid=t.oid and c.relkind='r' and c.relrowsecurity)
    or exists(select 1 from pg_catalog.pg_policy p where p.polrelid=t.oid)
    or exists(select 1 from pg_catalog.unnest(array['anon','authenticated']) role(name)
      where pg_catalog.has_table_privilege(role.name,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or pg_catalog.has_any_column_privilege(role.name,t.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
    or exists(select 1 from pg_catalog.unnest(array['SELECT','INSERT','UPDATE','DELETE']) privilege(name)
      where not pg_catalog.has_table_privilege('service_role',t.oid,privilege.name)))
  union all
  select 'Missing primary key: ' || t.name from tables t where not exists
    (select 1 from pg_catalog.pg_constraint c where c.conrelid=t.oid and c.contype='p' and c.convalidated
      and (select pg_catalog.string_agg(a.attname,',' order by k.position)
        from pg_catalog.unnest(c.conkey) with ordinality k(number,position)
        join pg_catalog.pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.number)=t.primary_key)
  union all
  select 'Unsafe or missing RPC: ' || r.signature from rpcs r
  where r.oid is null or pg_catalog.has_function_privilege('anon',r.oid,'EXECUTE')
    or pg_catalog.has_function_privilege('authenticated',r.oid,'EXECUTE')
    or (r.service_callable and not pg_catalog.has_function_privilege('service_role',r.oid,'EXECUTE'))
    or not exists(select 1 from pg_catalog.pg_proc p where p.oid=r.oid and p.proconfig @> array['search_path=""'])
  union all
  select 'Missing or changed constraint: ' || r.name from required_checks r where not exists
    (select 1 from pg_catalog.pg_constraint c where c.conrelid=pg_catalog.to_regclass('public.'||r.tab)
      and c.conname=r.name and c.contype='c' and c.convalidated and pg_catalog.pg_get_constraintdef(c.oid)=r.expression)
  union all
  select 'Missing or changed unique index: ' || r.name from required_indexes r where not exists
    (select 1 from pg_catalog.pg_index i where i.indrelid=pg_catalog.to_regclass('public.'||r.tab)
      and i.indexrelid=pg_catalog.to_regclass('public.'||r.name) and i.indisunique and i.indisvalid and i.indisready
      and pg_catalog.pg_get_indexdef(i.indexrelid)=r.definition)
  union all
  select 'Missing or disabled trigger: ' || r.name from required_triggers r where not exists
    (select 1 from pg_catalog.pg_trigger t where t.tgrelid=pg_catalog.to_regclass('public.'||r.tab)
      and t.tgname=r.name and t.tgfoid=pg_catalog.to_regprocedure('public.'||r.signature)
      and t.tgenabled in ('O','A') and t.tgtype=r.events and not t.tgisinternal)
  union all
  select 'Missing RY-D page access metadata' where not exists
    (select 1 from public.workspace_area_access where area='ryd' and access_mode in ('open','restricted'))
  union all
  select 'Missing RY-D Settings page access metadata' where not exists
    (select 1 from public.workspace_area_access where area='ryd-settings' and access_mode in ('open','restricted'))
)
select pg_catalog.jsonb_build_object('contractOk',count(*)=0,'failures',coalesce(pg_catalog.jsonb_agg(message order by message),'[]'::jsonb)) from failures;
$function$;

insert into supabase_migrations.schema_migrations(version,name,statements) values
  ('20261112000000','ryd_cards',array['-- Applied from the committed dashboard handoff.']),
  ('20261113000000','ryd_card_batches',array['-- Applied from the committed dashboard handoff.'])
on conflict (version) do nothing;
notify pgrst, 'reload schema';
commit;
```

## Verify on PRD

```sql
select
  exists(select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'access_groups' and column_name = 'guest')
    as guest_column,
  to_regprocedure('public.can_view_open_content()') is not null
    and to_regprocedure('public.is_guest()') is not null
    and to_regprocedure('public.member_is_guest(uuid)') is not null as guest_functions,
  not has_function_privilege('authenticated', 'public.member_is_guest(uuid)', 'execute')
    as guest_lookup_private,
  position('can_view_open_content' in pg_get_functiondef('public.project_permission_for(uuid)'::regprocedure)) > 0
    as open_projects_skip_guests,
  exists(select 1 from public.workspace_area_access where area = 'ryd-settings')
    as ryd_settings_page,
  not exists(select 1 from public.access_groups where guest) as no_guests_yet,
  (select count(*) = 2 from information_schema.tables
    where table_schema = 'public' and table_name in ('ryd_card_batches', 'ryd_card_batch_orders'))
    as card_batch_tables,
  (select count(*) = 4 from supabase_migrations.schema_migrations
    where version in ('20261111000000', '20261111000100', '20261112000000', '20261113000000'))
    as migrations_recorded,
  not exists(select 1 from public.instance_settings where ryd_enabled is true) as ryd_disabled;
```

Expected: one row with all nine values `true`. If you ran only block 1,
`card_batch_tables` and `migrations_recorded` are `false` and the rest are
`true`. Neither block reads customer rows or sends email.
