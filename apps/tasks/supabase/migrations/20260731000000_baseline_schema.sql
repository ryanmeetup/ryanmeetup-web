-- Baseline schema, captured from the linked Ryan Meetup project on 2026-08-25.
--
-- Why this exists: 67 migrations had been applied to production with none of
-- their files kept in the repository, so there was no way to build a second
-- database from source. This file is that missing history, flattened into one
-- starting point. Everything after it is an ordinary forward migration.
--
-- Produced with `supabase db dump` (read-only) rather than `supabase db pull`,
-- because pull reconciles the remote migration history and this project has 67
-- orphaned entries it would have tried to rewrite.
--
-- Contents, in dependency order:
--   1. The public schema: 34 tables, 54 functions, 74 policies, 30 triggers,
--      5 enums, 27 indexes. RLS is enabled on all 34 tables.
--   2. The auth.users trigger that creates a profile row. A public-schema dump
--      does not include it, and without it every invited user silently gets no
--      profile.
--   3. Storage buckets and their 15 policies. A schema dump carries neither:
--      buckets are rows, and the policies live in the storage schema.
--
-- Supabase provisions the auth and storage tables themselves, so this file
-- deliberately does not create them - only the objects this app owns.
--
-- Applying to a NEW project:      supabase db push
-- Marking applied on the EXISTING project, which already has this schema:
--   supabase migration repair --status applied 20260731000000

-- ============================================================
-- 1. Public schema
-- ============================================================



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."access_group_kind" AS ENUM (
    'tier',
    'team'
);


ALTER TYPE "public"."access_group_kind" OWNER TO "postgres";


CREATE TYPE "public"."app_role" AS ENUM (
    'owner',
    'member'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."calendar_event_kind" AS ENUM (
    'important',
    'away'
);


ALTER TYPE "public"."calendar_event_kind" OWNER TO "postgres";


CREATE TYPE "public"."project_permission" AS ENUM (
    'viewer',
    'editor',
    'manager'
);


ALTER TYPE "public"."project_permission" OWNER TO "postgres";


CREATE TYPE "public"."task_priority" AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


ALTER TYPE "public"."task_priority" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_category_attachment_sort_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.sort_order is null then
    select coalesce(max(attachment.sort_order), 0) + 1024
    into new.sort_order
    from public.category_attachments attachment
    where attachment.category_id = new.category_id;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."assign_category_attachment_sort_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_project_attachment_sort_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.sort_order is null then
    select coalesce(max(attachment.sort_order), 0) + 1024
    into new.sort_order
    from public.project_attachments attachment
    where attachment.project_id = new.project_id;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."assign_project_attachment_sort_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_task_board_position"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.board_position is null then
    select coalesce(max(task.board_position), 0) + 1024
    into new.board_position
    from public.tasks task
    where task.status_id = new.status_id;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."assign_task_board_position"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_permission_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.permission_audit_events(actor_id, action, target_type, target_id, before_state, after_state)
  values (auth.uid(), lower(tg_op), tg_table_name,
    coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(new)->>'project_id')::uuid,
             (to_jsonb(new)->>'category_id')::uuid, (to_jsonb(old)->>'id')::uuid,
             (to_jsonb(old)->>'project_id')::uuid, (to_jsonb(old)->>'category_id')::uuid),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."audit_permission_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_category"("requested_category_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.has_global_content_access(auth.uid())
    or exists (
      select 1
      from public.work_groups category
      where category.id = requested_category_id
        and (
          category.access_mode = 'open'
          or exists (
            select 1
            from public.category_group_grants grant_row
            where grant_row.category_id = category.id
              and public.member_has_group_access(auth.uid(), grant_row.group_id)
          )
        )
    );
$$;


ALTER FUNCTION "public"."can_access_category"("requested_category_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_task_categories"("requested_task_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.is_app_owner() or not exists (
    select 1
    from public.task_categories task_category
    where task_category.task_id = requested_task_id
      and not public.can_access_category(task_category.category_id)
  );
$$;


ALTER FUNCTION "public"."can_access_task_categories"("requested_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_assign_to_project"("requested_profile_id" "uuid", "requested_project_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.is_app_owner() or exists (
    select 1
    from public.profiles profile
    where profile.id = requested_profile_id
      and (
        requested_project_id is null
        or public.has_global_content_access(profile.id)
        or exists (
          select 1
          from public.project_group_grants grant_row
          where grant_row.project_id = requested_project_id
            and public.member_has_group_access(profile.id, grant_row.group_id)
        )
      )
  );
$$;


ALTER FUNCTION "public"."can_assign_to_project"("requested_profile_id" "uuid", "requested_project_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_assign_to_project"("requested_profile_id" "uuid", "requested_project_id" "uuid") IS 'Checks assignment eligibility without treating incomplete onboarding as an update lock.';



CREATE OR REPLACE FUNCTION "public"."can_edit_project"("project_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.project_permission_for(project_id) in ('editor', 'manager');
$$;


ALTER FUNCTION "public"."can_edit_project"("project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_edit_task"("requested_task_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select (
    case
      when task_row.project_id is null then public.is_team_member()
      else public.can_edit_project(task_row.project_id)
    end
  ) and public.can_access_task_categories(task_row.id)
  from public.tasks task_row
  where task_row.id = requested_task_id;
$$;


ALTER FUNCTION "public"."can_edit_task"("requested_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_categories"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.has_global_content_access(auth.uid());
$$;


ALTER FUNCTION "public"."can_manage_categories"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_group_projects"("requested_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from public.project_group_grants
    where group_id = requested_group_id
      and public.can_manage_project(project_id)
  );
$$;


ALTER FUNCTION "public"."can_manage_group_projects"("requested_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_project"("project_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.project_permission_for(project_id) = 'manager';
$$;


ALTER FUNCTION "public"."can_manage_project"("project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_project"("project_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.project_permission_for(project_id) is not null;
$$;


ALTER FUNCTION "public"."can_view_project"("project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_task"("requested_task_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select (
    case
      when task_row.project_id is null then public.is_team_member()
      else public.can_view_project(task_row.project_id)
    end
  ) and public.can_access_task_categories(task_row.id)
  from public.tasks task_row
  where task_row.id = requested_task_id;
$$;


ALTER FUNCTION "public"."can_view_task"("requested_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_workspace_calendar"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select
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
      join public.access_groups granted_tier
        on granted_tier.kind = 'tier'
       and granted_tier.calendar_access
       and granted_tier.hierarchy_rank <= member_tier.hierarchy_rank
      where membership.profile_id = auth.uid()
    );
$$;


ALTER FUNCTION "public"."can_view_workspace_calendar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."category_id_from_storage_path"("object_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
declare candidate text;
begin
  candidate := (storage.foldername(object_name))[1];
  if candidate is null or candidate !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return candidate::uuid;
end;
$_$;


ALTER FUNCTION "public"."category_id_from_storage_path"("object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_privileged_rate_limit"("requested_key" "text", "requested_limit" integer, "requested_window_seconds" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  current_count integer;
begin
  if requested_limit < 1 or requested_window_seconds < 1 or char_length(requested_key) > 200 then
    raise exception 'Invalid rate limit configuration';
  end if;

  insert into public.privileged_rate_limits(rate_key, window_started_at, request_count)
  values (requested_key, now(), 1)
  on conflict (rate_key) do update set
    window_started_at = case
      when public.privileged_rate_limits.window_started_at <= now() - make_interval(secs => requested_window_seconds)
      then now() else public.privileged_rate_limits.window_started_at end,
    request_count = case
      when public.privileged_rate_limits.window_started_at <= now() - make_interval(secs => requested_window_seconds)
      then 1 else public.privileged_rate_limits.request_count + 1 end
  returning request_count into current_count;

  return current_count <= requested_limit;
end;
$$;


ALTER FUNCTION "public"."consume_privileged_rate_limit"("requested_key" "text", "requested_limit" integer, "requested_window_seconds" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."statuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "is_completed" boolean DEFAULT false NOT NULL,
    "order_revision" bigint DEFAULT 0 NOT NULL,
    "description" "text",
    CONSTRAINT "statuses_description_check" CHECK ((("description" IS NULL) OR ("char_length"("description") <= 240)))
);


ALTER TABLE "public"."statuses" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_status"("status_name" "text", "status_description" "text", "status_color" "text") RETURNS SETOF "public"."statuses"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  created_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('public.statuses.ordering', 0));

  insert into public.statuses(
    name,
    description,
    color,
    sort_order,
    order_revision,
    is_default,
    is_completed
  )
  select
    status_name,
    nullif(trim(status_description), ''),
    status_color,
    count(*),
    coalesce(max(order_revision), 0),
    false,
    false
  from public.statuses
  returning id into created_id;

  return query select * from public.statuses where id = created_id;
end;
$$;


ALTER FUNCTION "public"."create_status"("status_name" "text", "status_description" "text", "status_color" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_subtask_with_activity"("subtask_id" "uuid", "parent_task_id" "uuid", "subtask_title" "text", "subtask_sort_order" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  saved_subtask public.subtasks;
  saved_activity public.task_activity;
begin
  insert into public.subtasks (id, task_id, title, sort_order, created_by)
  values (subtask_id, parent_task_id, trim(subtask_title), subtask_sort_order, auth.uid())
  returning * into saved_subtask;
  insert into public.task_activity (task_id, actor_id, action, details)
  values (parent_task_id, auth.uid(), format('added checklist item “%s”', trim(subtask_title)), '{}'::jsonb)
  returning * into saved_activity;
  return jsonb_build_object('subtask', to_jsonb(saved_subtask), 'activity', to_jsonb(saved_activity));
end;
$$;


ALTER FUNCTION "public"."create_subtask_with_activity"("subtask_id" "uuid", "parent_task_id" "uuid", "subtask_title" "text", "subtask_sort_order" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_status"("status_id" "uuid") RETURNS TABLE("id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform pg_advisory_xact_lock(hashtextextended('public.statuses.ordering', 0));

  return query delete from public.statuses where statuses.id = status_id returning statuses.id;

  with normalized as (
    select statuses.id, row_number() over (order by sort_order, statuses.id) - 1 as sort_order
    from public.statuses as statuses
  )
  update public.statuses as statuses
  set sort_order = normalized.sort_order
  from normalized
  where statuses.id = normalized.id;
end;
$$;


ALTER FUNCTION "public"."delete_status"("status_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_task"("deleted_task_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare removed_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  delete from public.tasks where id = deleted_task_id returning id into removed_id;
  if removed_id is null then raise exception 'Task not found'; end if;
  return removed_id;
end; $$;


ALTER FUNCTION "public"."delete_task"("deleted_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_single_access_tier"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if exists (
    select 1 from public.access_groups
    where id = new.group_id and kind = 'tier'
  ) and exists (
    select 1
    from public.access_group_members membership
    join public.access_groups access_group on access_group.id = membership.group_id
    where membership.profile_id = new.profile_id
      and access_group.kind = 'tier'
      and membership.group_id <> new.group_id
  ) then
    raise exception 'A profile may belong to only one organizational tier'
      using errcode = '23505';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_single_access_tier"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_task_attachment_quota"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  attachment_project_id uuid;
  user_bytes bigint;
  project_bytes bigint;
begin
  if new.file_path is null then
    if new.url !~* '^https?://' then
      raise exception using errcode = '23514', message = 'URL attachments must use HTTP or HTTPS';
    end if;
    if new.size_bytes is not null or new.mime_type is not null then
      raise exception using errcode = '23514', message = 'URL attachments cannot include file metadata';
    end if;
    return new;
  end if;

  if new.size_bytes is null or new.size_bytes < 1 or new.size_bytes > 10485760 then
    raise exception using errcode = '23514', message = 'Attachments must be between 1 byte and 10 MB';
  end if;
  if new.mime_type is null or new.mime_type not in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain'
  ) then
    raise exception using errcode = '23514', message = 'Attachment MIME type is not allowed';
  end if;

  -- Serialize quota checks for this uploader and task to prevent concurrent bypass.
  perform pg_advisory_xact_lock(hashtextextended(new.created_by::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(new.task_id::text, 0));

  select project_id into attachment_project_id
  from public.tasks where id = new.task_id;

  select coalesce(sum(size_bytes), 0) into user_bytes
  from public.task_attachments where created_by = new.created_by;
  if user_bytes + new.size_bytes > 262144000 then
    raise exception using errcode = '23514', message = 'Attachment quota exceeded: 250 MB per user';
  end if;

  select coalesce(sum(a.size_bytes), 0) into project_bytes
  from public.task_attachments a
  join public.tasks t on t.id = a.task_id
  where t.project_id is not distinct from attachment_project_id;
  if project_bytes + new.size_bytes > 2147483648 then
    raise exception using errcode = '23514', message = 'Attachment quota exceeded: 2 GB per project';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_task_attachment_quota"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_new_project_to_creator_groups"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  granted_group_count integer;
begin
  insert into public.project_group_grants (
    project_id,
    group_id,
    permission,
    granted_by
  )
  select
    new.id,
    membership.group_id,
    'viewer'::public.project_permission,
    new.created_by
  from public.access_group_members membership
  join public.profiles creator
    on creator.id = membership.profile_id
   and creator.onboarding_completed
  where membership.profile_id = new.created_by;

  get diagnostics granted_group_count = row_count;
  if granted_group_count = 0 then
    raise exception 'A project creator must belong to at least one access group'
      using errcode = '23514';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."grant_new_project_to_creator_groups"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  tier_id uuid;
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1))
  );

  -- Hosted projects apply the schema independently from seed.sql. Give the
  -- first user the same board used by Ryan Meetup even when that optional seed
  -- step was skipped.
  perform pg_advisory_xact_lock(hashtextextended('public.statuses.bootstrap', 0));
  insert into public.statuses (name, description, color, sort_order, is_default, is_completed)
  select * from (values
    ('Backlog', 'Ideas and requests that are not ready to schedule yet.', '#64748b', 0, true, false),
    ('Todo', 'Ready to be picked up and worked on.', '#2563eb', 1, true, false),
    ('In Progress', 'Actively being worked on right now.', '#d97706', 2, true, false),
    ('In Review', 'Waiting for feedback, approval, or final checks.', '#7c3aed', 3, true, false),
    ('Done', 'Finished work that no longer needs action.', '#059669', 4, true, true),
    ('Will Not Do', null, '#f51b2b', 5, true, false)
  ) as defaults (name, description, color, sort_order, is_default, is_completed)
  where not exists (select 1 from public.statuses);

  select access_group.id into tier_id
  from public.access_groups access_group
  where access_group.kind = 'tier'
  order by access_group.hierarchy_rank
  limit 1;

  -- The first user of an instance arrives before any tier exists, and a
  -- workspace whose members hold no group cannot create a project at all.
  if tier_id is null then
    insert into public.access_groups (name, description, created_by, kind, hierarchy_rank)
    values (
      'Members',
      'Everyone in the workspace. New members join this tier automatically.',
      new.id,
      'tier',
      0
    )
    returning id into tier_id;
  end if;

  insert into public.access_group_members (group_id, profile_id, added_by)
  values (tier_id, new.id, new.id);

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_global_content_access"("requested_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = requested_profile_id
      and profile.onboarding_completed
      and (
        profile.app_role = 'owner'
        or exists (
          select 1
          from public.access_group_members membership
          join public.access_groups access_group on access_group.id = membership.group_id
          where membership.profile_id = profile.id
            and access_group.kind = 'tier'
            and access_group.grants_global_content
        )
      )
  );
$$;


ALTER FUNCTION "public"."has_global_content_access"("requested_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_access_group_member"("requested_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from public.access_group_members
    where group_id = requested_group_id and profile_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_access_group_member"("requested_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_app_owner"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and onboarding_completed and app_role = 'owner'
  );
$$;


ALTER FUNCTION "public"."is_app_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_member"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select auth.uid() is not null and exists (
    select 1
    from public.profiles
    where id = auth.uid() and onboarding_completed
  );
$$;


ALTER FUNCTION "public"."is_team_member"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_orphaned_task_attachment_paths"() RETURNS TABLE("path" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select objects.name
  from storage.objects as objects
  where objects.bucket_id = 'task-attachments'
    and objects.created_at < now() - interval '24 hours'
    and not exists (
      select 1
      from public.task_attachments as attachments
      where attachments.file_path = objects.name
    )
  order by objects.created_at
  limit 500;
$$;


ALTER FUNCTION "public"."list_orphaned_task_attachment_paths"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_task_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_activity (task_id, actor_id, action, details)
    values (new.id, auth.uid(), 'created the task', '{}'::jsonb);
  elsif old.status_id is distinct from new.status_id then
    insert into public.task_activity (task_id, actor_id, action, details)
    values (
      new.id,
      auth.uid(),
      'moved task',
      jsonb_build_object(
        'from_status_id', old.status_id,
        'status_id', new.status_id
      )
    );
  else
    insert into public.task_activity (task_id, actor_id, action, details)
    values (new.id, auth.uid(), 'updated the task', '{}'::jsonb);
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."log_task_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_task_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.permission_audit_events (
    actor_id,
    action,
    target_type,
    target_id,
    before_state,
    after_state
  )
  values (
    auth.uid(),
    'task.delete',
    'task',
    old.id,
    null,
    jsonb_build_object(
      'activity', true,
      'resource_name', old.title,
      'project_id', old.project_id,
      'task_number', old.task_number
    )
  );
  return old;
end;
$$;


ALTER FUNCTION "public"."log_task_deletion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."member_has_group_access"("requested_profile_id" "uuid", "requested_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
            and member_tier.hierarchy_rank >= requested_group.hierarchy_rank
        ))
      )
  );
$$;


ALTER FUNCTION "public"."member_has_group_access"("requested_profile_id" "uuid", "requested_group_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status_id" "uuid" NOT NULL,
    "work_group_id" "uuid",
    "assignee_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "start_date" "date",
    "due_date" "date",
    "priority" "public"."task_priority" DEFAULT 'medium'::"public"."task_priority" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "due_time" time without time zone,
    "reminder_at" timestamp with time zone,
    "project_id" "uuid",
    "completed_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "board_position" double precision NOT NULL,
    "reported_by" "uuid" NOT NULL,
    "task_number" bigint NOT NULL,
    "category_tags" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "category_tags_is_object" CHECK (("jsonb_typeof"("category_tags") = 'object'::"text")),
    CONSTRAINT "tasks_task_number_positive" CHECK (("task_number" > 0)),
    CONSTRAINT "tasks_title_check" CHECK (("char_length"(TRIM(BOTH FROM "title")) > 0)),
    CONSTRAINT "valid_date_range" CHECK ((("due_date" IS NULL) OR ("start_date" IS NULL) OR ("due_date" >= "start_date")))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."move_task"("moved_task_id" "uuid", "next_status_id" "uuid", "next_board_position" double precision) RETURNS "public"."tasks"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  saved public.tasks;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  if not (next_board_position between -1000000000000000 and 1000000000000000) then
    raise exception 'Invalid board position';
  end if;

  update public.tasks
  set status_id = next_status_id, board_position = next_board_position
  where id = moved_task_id
  returning * into saved;
  if saved.id is null then raise exception 'Task not found'; end if;
  return saved;
end;
$$;


ALTER FUNCTION "public"."move_task"("moved_task_id" "uuid", "next_status_id" "uuid", "next_board_position" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_last_owner_removal"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if old.app_role = 'owner' and (tg_op = 'DELETE' or new.app_role <> 'owner')
     and (select count(*) from public.profiles where app_role = 'owner') <= 1 then
    raise exception 'The last app owner cannot be removed';
  end if;
  if tg_op = 'UPDATE' and old.app_role is distinct from new.app_role
     and exists (select 1 from public.profiles where app_role = 'owner')
     and not public.is_app_owner() then
    raise exception 'Only an app owner can change app roles';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


ALTER FUNCTION "public"."prevent_last_owner_removal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_privileged_audit_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  raise exception 'Privileged audit events are immutable';
end;
$$;


ALTER FUNCTION "public"."prevent_privileged_audit_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."project_id_from_storage_path"("object_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
declare candidate text;
begin
  candidate := (storage.foldername(object_name))[1];
  if candidate is null or candidate !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return candidate::uuid;
end;
$_$;


ALTER FUNCTION "public"."project_id_from_storage_path"("object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."project_permission_for"("requested_project_id" "uuid") RETURNS "public"."project_permission"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select case
    when not public.is_team_member() then null::public.project_permission
    when public.has_global_content_access(auth.uid()) then 'manager'::public.project_permission
    else (
      select case max(permission_rank)
        when 3 then 'manager'::public.project_permission
        when 2 then 'editor'::public.project_permission
        when 1 then 'viewer'::public.project_permission
      end
      from (
        select case grant_row.permission
          when 'manager' then 3 when 'editor' then 2 else 1
        end as permission_rank
        from public.project_group_grants grant_row
        where grant_row.project_id = requested_project_id
          and public.member_has_group_access(auth.uid(), grant_row.group_id)
      ) inherited_grants
    )
  end;
$$;


ALTER FUNCTION "public"."project_permission_for"("requested_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_access_group_kind"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'UPDATE' and old.kind <> new.kind and exists (
    select 1 from public.access_group_members where group_id = old.id
  ) then
    raise exception 'A populated access group cannot change between team and tier'
      using errcode = '23514';
  end if;
  if tg_op = 'DELETE' and old.kind = 'tier' and exists (
    select 1 from public.access_group_members where group_id = old.id
  ) then
    raise exception 'Move every member to another tier before deleting this tier'
      using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


ALTER FUNCTION "public"."protect_access_group_kind"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_required_tier_membership"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if pg_trigger_depth() <= 1
    and coalesce(current_setting('app.replacing_access_tier', true), 'false') <> 'true'
    and exists (
      select 1 from public.access_groups
      where id = old.group_id and kind = 'tier'
    )
    and exists (
      select 1 from public.profiles
      where id = old.profile_id and app_role = 'member'
    )
  then
    raise exception 'A regular member must always have an organizational tier'
      using errcode = '23514';
  end if;
  return old;
end;
$$;


ALTER FUNCTION "public"."protect_required_tier_membership"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_removed_category_tags"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if old.tags is distinct from new.tags then
    update public.tasks
    set category_tags = jsonb_set(
      category_tags,
      array[new.id::text],
      coalesce(
        (
          select jsonb_agg(value)
          from jsonb_array_elements_text(category_tags -> new.id::text) selected(value)
          where selected.value = any(new.tags)
        ),
        '[]'::jsonb
      )
    )
    where category_tags ? new.id::text;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."prune_removed_category_tags"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_privileged_audit_event"("requested_actor_id" "uuid", "requested_action" "text", "requested_target_type" "text", "requested_target_id" "uuid" DEFAULT NULL::"uuid", "requested_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.privileged_audit_events(actor_id, action, target_type, target_id, metadata)
  values (requested_actor_id, requested_action, requested_target_type, requested_target_id, requested_metadata);
end;
$$;


ALTER FUNCTION "public"."record_privileged_audit_event"("requested_actor_id" "uuid", "requested_action" "text", "requested_target_type" "text", "requested_target_id" "uuid", "requested_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_tasks_for_status_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if old.is_completed is distinct from new.is_completed then
    update public.tasks
    set status_id = status_id
    where status_id = new.id;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."refresh_tasks_for_status_completion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_statuses"("ordered_status_ids" "uuid"[], "expected_revision" bigint) RETURNS SETOF "public"."statuses"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  current_revision bigint;
  status_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('public.statuses.ordering', 0));

  select count(*), coalesce(max(order_revision), 0)
  into status_count, current_revision
  from public.statuses;

  if expected_revision is null or expected_revision <> current_revision then
    raise exception using
      errcode = '40001',
      message = 'The status ordering revision is stale';
  end if;

  if coalesce(cardinality(ordered_status_ids), 0) <> status_count
     or (select count(distinct id) from unnest(ordered_status_ids) as ids(id)) <> status_count
     or exists (
       select 1 from unnest(ordered_status_ids) as ids(id)
       where not exists (select 1 from public.statuses where statuses.id = ids.id)
     ) then
    raise exception using
      errcode = 'P0002',
      message = 'The status list changed';
  end if;

  update public.statuses as statuses
  set sort_order = (requested.position - 1)::integer,
      order_revision = current_revision + 1
  from unnest(ordered_status_ids) with ordinality as requested(id, position)
  where statuses.id = requested.id;

  return query
    select * from public.statuses order by sort_order;
end;
$$;


ALTER FUNCTION "public"."reorder_statuses"("ordered_status_ids" "uuid"[], "expected_revision" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_project_managers"("requested_project_id" "uuid", "requested_profile_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.can_manage_project(requested_project_id) then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from unnest(coalesce(requested_profile_ids, '{}'::uuid[])) requested_id
    where not exists (
      select 1 from public.profiles p
      where p.id = requested_id and p.onboarding_completed
    )
  ) then
    raise exception 'A selected project manager is not eligible';
  end if;

  delete from public.project_user_grants
  where project_id = requested_project_id and permission = 'manager';

  insert into public.project_user_grants(project_id, profile_id, permission, granted_by)
  select requested_project_id, requested_id, 'manager', auth.uid()
  from unnest(coalesce(requested_profile_ids, '{}'::uuid[])) requested_id
  on conflict (project_id, profile_id) do update
  set permission = excluded.permission, granted_by = excluded.granted_by;
end;
$$;


ALTER FUNCTION "public"."replace_project_managers"("requested_project_id" "uuid", "requested_profile_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_contact"("contact_id" "uuid", "contact_name" "text", "contact_notes" "text", "category_ids" "uuid"[], "new_category_names" "text"[], "people" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  saved_id uuid;
  category_name text;
  new_category_id uuid;
  person jsonb;
begin
  if not public.is_team_member() then raise exception 'Not authorized'; end if;
  if contact_name is null or char_length(btrim(contact_name)) not between 1 and 160 then
    raise exception 'Invalid contact name';
  end if;
  if jsonb_typeof(people) <> 'array' or jsonb_array_length(people) > 100 then
    raise exception 'Invalid people';
  end if;

  if contact_id is null then
    insert into public.contacts (display_name, notes, created_by)
    values (btrim(contact_name), nullif(btrim(contact_notes), ''), auth.uid())
    returning id into saved_id;
  else
    update public.contacts
    set display_name = btrim(contact_name), notes = nullif(btrim(contact_notes), '')
    where id = contact_id
    returning id into saved_id;
    if saved_id is null then raise exception 'Contact not found'; end if;
  end if;

  delete from public.contact_category_assignments
  where contact_category_assignments.contact_id = saved_id;
  insert into public.contact_category_assignments (contact_id, category_id)
  select saved_id, id
  from public.contact_categories
  where id = any(coalesce(category_ids, '{}'));

  foreach category_name in array coalesce(new_category_names, '{}') loop
    category_name := btrim(category_name);
    if char_length(category_name) not between 1 and 80 then raise exception 'Invalid category'; end if;
    insert into public.contact_categories (name, created_by)
    values (category_name, auth.uid())
    on conflict (name) do update set name = excluded.name
    returning id into new_category_id;
    insert into public.contact_category_assignments (contact_id, category_id)
    values (saved_id, new_category_id) on conflict do nothing;
  end loop;

  delete from public.contact_people
  where contact_people.contact_id = saved_id;
  for person in select value from jsonb_array_elements(people) loop
    if char_length(btrim(person->>'full_name')) not between 1 and 160 then raise exception 'Invalid person name'; end if;
    if char_length(btrim(person->>'title')) > 160 then raise exception 'Invalid person title'; end if;
    insert into public.contact_people (
      id, contact_id, full_name, title, emails, phone, instagram_handle
    ) values (
      coalesce(nullif(person->>'id', '')::uuid, gen_random_uuid()),
      saved_id,
      btrim(person->>'full_name'),
      nullif(btrim(person->>'title'), ''),
      coalesce(array(select lower(btrim(value)) from jsonb_array_elements_text(coalesce(person->'emails', '[]'::jsonb))), '{}'),
      nullif(btrim(person->>'phone'), ''),
      nullif(ltrim(btrim(person->>'instagram_handle'), '@'), '')
    );
  end loop;
  return saved_id;
end;
$$;


ALTER FUNCTION "public"."save_contact"("contact_id" "uuid", "contact_name" "text", "contact_notes" "text", "category_ids" "uuid"[], "new_category_names" "text"[], "people" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_task"("task_id" "uuid", "task_values" "jsonb", "category_ids" "uuid"[], "assignee_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  saved_task public.tasks;
  requested_tags jsonb := coalesce(task_values -> 'category_tags', '{}'::jsonb);
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  if coalesce(array_length(category_ids, 1), 0) = 0 then
    raise exception 'Select at least one category';
  end if;
  if jsonb_typeof(requested_tags) <> 'object' then
    raise exception 'Category tags must be an object';
  end if;
  if exists (
    select 1
    from jsonb_each(requested_tags) entry
    left join public.work_groups category on category.id::text = entry.key
    where category.id is null
      or not (category.id = any(category_ids))
      or jsonb_typeof(entry.value) <> 'array'
      or exists (
        select 1 from jsonb_array_elements_text(entry.value) chosen(tag)
        where not (chosen.tag = any(category.tags))
      )
  ) then
    raise exception 'A selected tag does not belong to its category';
  end if;

  if task_id is null then
    insert into public.tasks (
      title, description, status_id, work_group_id, project_id, assignee_id,
      created_by, reported_by, start_date, due_date, due_time, reminder_at,
      priority, category_tags
    ) values (
      trim(task_values ->> 'title'), nullif(task_values ->> 'description', ''),
      (task_values ->> 'status_id')::uuid,
      nullif(task_values ->> 'work_group_id', '')::uuid,
      nullif(task_values ->> 'project_id', '')::uuid,
      nullif(task_values ->> 'assignee_id', '')::uuid,
      auth.uid(), (task_values ->> 'reported_by')::uuid,
      nullif(task_values ->> 'start_date', '')::date,
      nullif(task_values ->> 'due_date', '')::date,
      nullif(task_values ->> 'due_time', '')::time,
      nullif(task_values ->> 'reminder_at', '')::timestamptz,
      (task_values ->> 'priority')::public.task_priority, requested_tags
    ) returning * into saved_task;
  else
    update public.tasks set
      title = trim(task_values ->> 'title'),
      description = nullif(task_values ->> 'description', ''),
      status_id = (task_values ->> 'status_id')::uuid,
      work_group_id = nullif(task_values ->> 'work_group_id', '')::uuid,
      project_id = nullif(task_values ->> 'project_id', '')::uuid,
      assignee_id = nullif(task_values ->> 'assignee_id', '')::uuid,
      reported_by = (task_values ->> 'reported_by')::uuid,
      start_date = nullif(task_values ->> 'start_date', '')::date,
      due_date = nullif(task_values ->> 'due_date', '')::date,
      due_time = nullif(task_values ->> 'due_time', '')::time,
      reminder_at = nullif(task_values ->> 'reminder_at', '')::timestamptz,
      priority = (task_values ->> 'priority')::public.task_priority,
      category_tags = requested_tags
    where id = task_id returning * into saved_task;
    if saved_task.id is null then raise exception 'Task not found'; end if;
  end if;

  delete from public.task_assignees where task_assignees.task_id = saved_task.id;
  insert into public.task_assignees (task_id, profile_id)
  select saved_task.id, id from unnest(coalesce(assignee_ids, '{}'::uuid[])) id;
  delete from public.task_categories where task_categories.task_id = saved_task.id;
  insert into public.task_categories (task_id, category_id)
  select saved_task.id, id from unnest(category_ids) id;

  return jsonb_build_object(
    'task', to_jsonb(saved_task),
    'assignees', coalesce((select jsonb_agg(to_jsonb(a)) from public.task_assignees a where a.task_id = saved_task.id), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(to_jsonb(c)) from public.task_categories c where c.task_id = saved_task.id), '[]'::jsonb)
  );
end;
$$;


ALTER FUNCTION "public"."save_task"("task_id" "uuid", "task_values" "jsonb", "category_ids" "uuid"[], "assignee_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_category_access"("requested_category_id" "uuid", "requested_access_mode" "text", "requested_group_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.is_app_owner() then
    raise exception 'Only app owners may change category access'
      using errcode = '42501';
  end if;
  if requested_access_mode not in ('open', 'restricted') then
    raise exception 'Invalid category access mode' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.work_groups where id = requested_category_id
  ) then
    raise exception 'Category not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from unnest(coalesce(requested_group_ids, '{}'::uuid[])) requested_group_id
    where not exists (
      select 1 from public.access_groups
      where id = requested_group_id and not grants_global_content
    )
  ) then
    raise exception 'Invalid access group' using errcode = '23514';
  end if;

  update public.work_groups
  set access_mode = requested_access_mode
  where id = requested_category_id;

  delete from public.category_group_grants
  where category_id = requested_category_id;

  if requested_access_mode = 'restricted' then
    insert into public.category_group_grants (
      category_id, group_id, granted_by
    )
    select requested_category_id, requested_group_id, auth.uid()
    from unnest(coalesce(requested_group_ids, '{}'::uuid[])) requested_group_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."set_category_access"("requested_category_id" "uuid", "requested_access_mode" "text", "requested_group_ids" "uuid"[]) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."access_group_members" (
    "group_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "added_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."access_group_members" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_profile_access_tier"("requested_profile_id" "uuid", "requested_group_id" "uuid") RETURNS "public"."access_group_members"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  membership public.access_group_members;
begin
  if not public.is_app_owner() then
    raise exception 'Only app owners may change organizational tiers'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.access_groups
    where id = requested_group_id and kind = 'tier'
  ) then
    raise exception 'The requested access group is not a tier'
      using errcode = '23514';
  end if;

  perform set_config('app.replacing_access_tier', 'true', true);
  delete from public.access_group_members existing
  using public.access_groups access_group
  where existing.profile_id = requested_profile_id
    and existing.group_id = access_group.id
    and access_group.kind = 'tier';

  insert into public.access_group_members (group_id, profile_id, added_by)
  values (requested_group_id, requested_profile_id, auth.uid())
  returning * into membership;
  perform set_config('app.replacing_access_tier', 'false', true);
  return membership;
end;
$$;


ALTER FUNCTION "public"."set_profile_access_tier"("requested_profile_id" "uuid", "requested_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_task_completion_lifecycle"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  status_is_completed boolean;
begin
  select is_completed
  into status_is_completed
  from public.statuses
  where id = new.status_id;

  if status_is_completed then
    if new.completed_at is null then
      new.completed_at = now();
    end if;
    if new.archived_at is null then
      new.archived_at = new.completed_at + interval '14 days';
    end if;
  else
    new.completed_at = null;
    new.archived_at = null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_task_completion_lifecycle"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."task_id_from_storage_path"("object_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
declare candidate text;
begin
  candidate := (storage.foldername(object_name))[1];
  if candidate is null or candidate !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return candidate::uuid;
end;
$_$;


ALTER FUNCTION "public"."task_id_from_storage_path"("object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_instance_settings"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_instance_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin new.updated_at = now(); return new; end;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."access_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "color" "text" DEFAULT '#2563eb'::"text" NOT NULL,
    "kind" "public"."access_group_kind" DEFAULT 'team'::"public"."access_group_kind" NOT NULL,
    "hierarchy_rank" integer,
    "grants_global_content" boolean DEFAULT false NOT NULL,
    "calendar_access" boolean DEFAULT false NOT NULL,
    CONSTRAINT "access_groups_color_hex" CHECK (("color" ~ '^#[0-9a-fA-F]{6}$'::"text")),
    CONSTRAINT "access_groups_hierarchy_rank_positive" CHECK ((("hierarchy_rank" IS NULL) OR ("hierarchy_rank" >= 0))),
    CONSTRAINT "access_groups_name_check" CHECK ((("name" = TRIM(BOTH FROM "name")) AND ("char_length"("name") > 0))),
    CONSTRAINT "access_groups_tier_shape" CHECK (((("kind" = 'tier'::"public"."access_group_kind") AND ("hierarchy_rank" IS NOT NULL)) OR (("kind" = 'team'::"public"."access_group_kind") AND ("hierarchy_rank" IS NULL) AND (NOT "grants_global_content"))))
);


ALTER TABLE "public"."access_groups" OWNER TO "postgres";


COMMENT ON COLUMN "public"."access_groups"."calendar_access" IS 'Allows members of this access group to view the workspace Google Calendar.';



CREATE TABLE IF NOT EXISTS "public"."calendar_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kind" "public"."calendar_event_kind" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "starts_at" timestamp without time zone NOT NULL,
    "ends_at" timestamp without time zone NOT NULL,
    "all_day" boolean DEFAULT true NOT NULL,
    "project_id" "uuid",
    "category_id" "uuid",
    "profile_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recurrence" "jsonb",
    CONSTRAINT "calendar_events_dates_ordered" CHECK (("ends_at" >= "starts_at")),
    CONSTRAINT "calendar_events_description_check" CHECK ((("description" IS NULL) OR ("char_length"("description") <= 2000))),
    CONSTRAINT "calendar_events_kind_shape" CHECK (((("kind" = 'away'::"public"."calendar_event_kind") AND ("profile_id" IS NOT NULL) AND ("project_id" IS NULL) AND ("category_id" IS NULL)) OR (("kind" = 'important'::"public"."calendar_event_kind") AND ("profile_id" IS NULL)))),
    CONSTRAINT "calendar_events_one_scope" CHECK (("num_nonnulls"("project_id", "category_id") <= 1)),
    CONSTRAINT "calendar_events_title_check" CHECK ((("char_length"("btrim"("title")) >= 1) AND ("char_length"("btrim"("title")) <= 160)))
);


ALTER TABLE "public"."calendar_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "name" "text" NOT NULL,
    "body" "text",
    "url" "text" DEFAULT ''::"text" NOT NULL,
    "file_path" "text",
    "mime_type" "text",
    "size_bytes" bigint,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sort_order" double precision NOT NULL,
    CONSTRAINT "category_attachment_shape" CHECK (((("kind" = 'note'::"text") AND ("body" IS NOT NULL) AND (("char_length"(TRIM(BOTH FROM "body")) >= 1) AND ("char_length"(TRIM(BOTH FROM "body")) <= 10000)) AND ("file_path" IS NULL) AND ("mime_type" IS NULL) AND ("size_bytes" IS NULL)) OR (("kind" = 'file'::"text") AND ("body" IS NULL) AND ("file_path" IS NOT NULL) AND ("mime_type" = ANY (ARRAY['application/pdf'::"text", 'image/jpeg'::"text", 'image/png'::"text", 'image/webp'::"text", 'text/plain'::"text"])) AND (("size_bytes" >= 1) AND ("size_bytes" <= 10485760))))),
    CONSTRAINT "category_attachments_kind_check" CHECK (("kind" = ANY (ARRAY['note'::"text", 'file'::"text"]))),
    CONSTRAINT "category_attachments_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 200)))
);


ALTER TABLE "public"."category_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category_group_grants" (
    "category_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "granted_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."category_group_grants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category_owners" (
    "category_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL
);


ALTER TABLE "public"."category_owners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#71717a'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contact_categories_color_check" CHECK (("color" ~ '^#[0-9a-fA-F]{6}$'::"text"))
);


ALTER TABLE "public"."contact_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_category_assignments" (
    "contact_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL
);


ALTER TABLE "public"."contact_category_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "emails" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "phone" "text",
    "instagram_handle" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text",
    CONSTRAINT "contact_people_full_name_check" CHECK ((("char_length"("btrim"("full_name")) >= 1) AND ("char_length"("btrim"("full_name")) <= 160))),
    CONSTRAINT "contact_people_instagram_handle_check" CHECK ((("instagram_handle" IS NULL) OR ("char_length"("instagram_handle") <= 100))),
    CONSTRAINT "contact_people_phone_check" CHECK ((("phone" IS NULL) OR ("char_length"("phone") <= 40))),
    CONSTRAINT "contact_people_title_check" CHECK ((("title" IS NULL) OR ("char_length"("title") <= 160)))
);


ALTER TABLE "public"."contact_people" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "display_name" "text" NOT NULL,
    "notes" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_url" "text",
    "contact_group" "text",
    CONSTRAINT "contacts_contact_group_check" CHECK ((("contact_group" IS NULL) OR ("contact_group" = ANY (ARRAY['Brand Partner'::"text", 'Venue & Host'::"text", 'Event Vendor'::"text", 'Hospitality'::"text", 'Media & Press'::"text", 'Talent & Entertainment'::"text"])))),
    CONSTRAINT "contacts_display_name_check" CHECK ((("char_length"("btrim"("display_name")) >= 1) AND ("char_length"("btrim"("display_name")) <= 160))),
    CONSTRAINT "contacts_image_url_check" CHECK ((("image_url" IS NULL) OR ("char_length"("image_url") <= 2048))),
    CONSTRAINT "contacts_notes_check" CHECK ((("notes" IS NULL) OR ("char_length"("notes") <= 5000)))
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."contacts"."contact_group" IS 'Optional single-select grouping used to organize the Contacts page.';



CREATE TABLE IF NOT EXISTS "public"."instance_settings" (
    "id" boolean DEFAULT true NOT NULL,
    "name" "text",
    "product_name" "text",
    "tagline" "text",
    "description" "text",
    "monogram" "text",
    "accent_color" "text",
    "logo_path" "text",
    "beta_banner_enabled" boolean,
    "feedback_in_workspace" boolean,
    "feedback_url" "text",
    "footer_variant" "text",
    "footer_subtitle" "text",
    "footer_sections" "jsonb",
    "footer_socials" "jsonb",
    "credit_prefix" "text",
    "credit_label" "text",
    "credit_url" "text",
    "credit_suffix" "text",
    "og_alt" "text",
    "og_headline" "text",
    "og_tagline" "text",
    "og_motto" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "instance_settings_accent_color_check" CHECK (("accent_color" ~ '^#[0-9a-fA-F]{6}$'::"text")),
    CONSTRAINT "instance_settings_credit_label_check" CHECK ((("char_length"("credit_label") >= 1) AND ("char_length"("credit_label") <= 80))),
    CONSTRAINT "instance_settings_credit_prefix_check" CHECK ((("char_length"("credit_prefix") >= 1) AND ("char_length"("credit_prefix") <= 80))),
    CONSTRAINT "instance_settings_credit_suffix_check" CHECK ((("char_length"("credit_suffix") >= 1) AND ("char_length"("credit_suffix") <= 80))),
    CONSTRAINT "instance_settings_credit_url_check" CHECK (("credit_url" ~ '^https://'::"text")),
    CONSTRAINT "instance_settings_description_check" CHECK ((("char_length"("description") >= 1) AND ("char_length"("description") <= 400))),
    CONSTRAINT "instance_settings_feedback_url_check" CHECK ((("feedback_url" ~ '^https://[^\s]+$'::"text") OR ("feedback_url" ~ '^mailto:[^\s@]+@[^\s@]+$'::"text"))),
    CONSTRAINT "instance_settings_footer_sections_check" CHECK ((("jsonb_typeof"("footer_sections") = 'array'::"text") AND ("jsonb_array_length"("footer_sections") <= 3))),
    CONSTRAINT "instance_settings_footer_socials_check" CHECK ((("jsonb_typeof"("footer_socials") = 'array'::"text") AND ("jsonb_array_length"("footer_socials") <= 8))),
    CONSTRAINT "instance_settings_footer_subtitle_check" CHECK ((("char_length"("footer_subtitle") >= 1) AND ("char_length"("footer_subtitle") <= 80))),
    CONSTRAINT "instance_settings_footer_variant_check" CHECK (("footer_variant" = ANY (ARRAY['branded'::"text", 'minimal'::"text", 'none'::"text"]))),
    CONSTRAINT "instance_settings_id_check" CHECK ("id"),
    CONSTRAINT "instance_settings_logo_path_check" CHECK ((("logo_path" ~ '^/[^/]'::"text") OR ("logo_path" ~ '^https://'::"text"))),
    CONSTRAINT "instance_settings_monogram_check" CHECK (("char_length"("monogram") = 1)),
    CONSTRAINT "instance_settings_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 80))),
    CONSTRAINT "instance_settings_og_alt_check" CHECK ((("char_length"("og_alt") >= 1) AND ("char_length"("og_alt") <= 200))),
    CONSTRAINT "instance_settings_og_headline_check" CHECK ((("char_length"("og_headline") >= 1) AND ("char_length"("og_headline") <= 60))),
    CONSTRAINT "instance_settings_og_motto_check" CHECK ((("char_length"("og_motto") >= 1) AND ("char_length"("og_motto") <= 120))),
    CONSTRAINT "instance_settings_og_tagline_check" CHECK ((("char_length"("og_tagline") >= 1) AND ("char_length"("og_tagline") <= 120))),
    CONSTRAINT "instance_settings_product_name_check" CHECK ((("char_length"("product_name") >= 1) AND ("char_length"("product_name") <= 120))),
    CONSTRAINT "instance_settings_tagline_check" CHECK ((("char_length"("tagline") >= 1) AND ("char_length"("tagline") <= 80)))
);


ALTER TABLE "public"."instance_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."instance_settings" IS 'Singleton row of runtime branding overrides. NULL columns fall back to build-time NEXT_PUBLIC_* defaults.';



CREATE TABLE IF NOT EXISTS "public"."labels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" NOT NULL,
    "created_by" "uuid" NOT NULL
);


ALTER TABLE "public"."labels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."note_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "note_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    CONSTRAINT "note_comments_body_check" CHECK ((("char_length"(TRIM(BOTH FROM "body")) > 0) AND ("char_length"("body") <= 5000)))
);


ALTER TABLE "public"."note_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text",
    "body" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "converted_task_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    "category_id" "uuid",
    "converted_project_id" "uuid",
    CONSTRAINT "notes_body_check" CHECK ((("char_length"(TRIM(BOTH FROM "body")) > 0) AND ("char_length"("body") <= 10000))),
    CONSTRAINT "notes_title_check" CHECK ((("title" IS NULL) OR ("char_length"("title") <= 200)))
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permission_audit_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid",
    "before_state" "jsonb",
    "after_state" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."permission_audit_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."privileged_audit_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "privileged_audit_events_action_check" CHECK ((("action" = TRIM(BOTH FROM "action")) AND (("char_length"("action") >= 1) AND ("char_length"("action") <= 100)))),
    CONSTRAINT "privileged_audit_events_metadata_check" CHECK (("jsonb_typeof"("metadata") = 'object'::"text")),
    CONSTRAINT "privileged_audit_events_target_type_check" CHECK ((("target_type" = TRIM(BOTH FROM "target_type")) AND (("char_length"("target_type") >= 1) AND ("char_length"("target_type") <= 100))))
);


ALTER TABLE "public"."privileged_audit_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."privileged_rate_limits" (
    "rate_key" "text" NOT NULL,
    "window_started_at" timestamp with time zone NOT NULL,
    "request_count" integer NOT NULL,
    CONSTRAINT "privileged_rate_limits_request_count_check" CHECK (("request_count" > 0))
);


ALTER TABLE "public"."privileged_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "avatar_url" "text",
    "onboarding_completed" boolean DEFAULT false NOT NULL,
    "app_role" "public"."app_role" DEFAULT 'member'::"public"."app_role" NOT NULL,
    "task_details_open_by_default" boolean DEFAULT false NOT NULL,
    "favorite_project_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "assign_new_tasks_to_self" boolean DEFAULT false NOT NULL,
    "editor_surface" "text" DEFAULT 'auto'::"text" NOT NULL,
    "calendar_default_view" "text" DEFAULT 'all'::"text" NOT NULL,
    CONSTRAINT "profiles_editor_surface_check" CHECK (("editor_surface" = ANY (ARRAY['auto'::"text", 'modal'::"text", 'page'::"text"]))),
    CONSTRAINT "profiles_calendar_default_view_check" CHECK (("calendar_default_view" = ANY (ARRAY['all'::"text", 'task'::"text", 'away'::"text", 'important'::"text", 'google'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."favorite_project_ids" IS 'Project IDs favorited by this profile for personalized navigation and dashboard shortcuts.';



COMMENT ON COLUMN "public"."profiles"."assign_new_tasks_to_self" IS 'When true, a new task drafted by this profile starts assigned to them.';



COMMENT ON COLUMN "public"."profiles"."editor_surface" IS 'Where create and edit forms open for this profile: auto (dialog from the sm breakpoint up, page below it), modal, or page.';



COMMENT ON COLUMN "public"."profiles"."calendar_default_view" IS 'Source selected when this profile opens Calendar: all, task, away, important, or google.';



CREATE TABLE IF NOT EXISTS "public"."project_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "name" "text" NOT NULL,
    "body" "text",
    "url" "text" DEFAULT ''::"text" NOT NULL,
    "file_path" "text",
    "mime_type" "text",
    "size_bytes" bigint,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sort_order" double precision NOT NULL,
    CONSTRAINT "project_attachment_shape" CHECK (((("kind" = 'note'::"text") AND ("body" IS NOT NULL) AND (("char_length"(TRIM(BOTH FROM "body")) >= 1) AND ("char_length"(TRIM(BOTH FROM "body")) <= 10000)) AND ("file_path" IS NULL) AND ("mime_type" IS NULL) AND ("size_bytes" IS NULL)) OR (("kind" = 'file'::"text") AND ("body" IS NULL) AND ("file_path" IS NOT NULL) AND ("mime_type" = ANY (ARRAY['application/pdf'::"text", 'image/jpeg'::"text", 'image/png'::"text", 'image/webp'::"text", 'text/plain'::"text"])) AND (("size_bytes" >= 1) AND ("size_bytes" <= 10485760))))),
    CONSTRAINT "project_attachments_kind_check" CHECK (("kind" = ANY (ARRAY['note'::"text", 'file'::"text"]))),
    CONSTRAINT "project_attachments_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 200)))
);


ALTER TABLE "public"."project_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_group_grants" (
    "project_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "permission" "public"."project_permission" NOT NULL,
    "granted_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_group_grants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_owners" (
    "project_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL
);


ALTER TABLE "public"."project_owners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_user_grants" (
    "project_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "permission" "public"."project_permission" NOT NULL,
    "granted_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_user_grants" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_user_grants" IS 'Legacy rollback data. Direct grants do not contribute to project access.';



CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "links" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "projects_links_check" CHECK (("jsonb_typeof"("links") = 'array'::"text")),
    CONSTRAINT "projects_name_check" CHECK (("char_length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subtasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "is_completed" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "subtasks_title_check" CHECK (("char_length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."subtasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_assignees" (
    "task_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL
);


ALTER TABLE "public"."task_assignees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "file_path" "text",
    "mime_type" "text",
    "size_bytes" bigint,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_categories" (
    "task_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL
);


ALTER TABLE "public"."task_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    "parent_id" "uuid",
    CONSTRAINT "task_comments_body_check" CHECK (("char_length"(TRIM(BOTH FROM "body")) > 0))
);


ALTER TABLE "public"."task_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_labels" (
    "task_id" "uuid" NOT NULL,
    "label_id" "uuid" NOT NULL
);


ALTER TABLE "public"."task_labels" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."task_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."task_number_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."task_number_seq" OWNED BY "public"."tasks"."task_number";



CREATE TABLE IF NOT EXISTS "public"."work_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "description" "text",
    "links" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "archived_at" timestamp with time zone,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "access_mode" "text" DEFAULT 'open'::"text" NOT NULL,
    CONSTRAINT "work_groups_access_mode_check" CHECK (("access_mode" = ANY (ARRAY['open'::"text", 'restricted'::"text"]))),
    CONSTRAINT "work_groups_links_check" CHECK (("jsonb_typeof"("links") = 'array'::"text"))
);


ALTER TABLE "public"."work_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_google_calendar_integrations" (
    "id" "text" NOT NULL,
    "encrypted_refresh_token" "text" NOT NULL,
    "account_email" "text" NOT NULL,
    "calendar_id" "text" DEFAULT 'primary'::"text" NOT NULL,
    "connected_by" "uuid" NOT NULL,
    "connected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workspace_google_calendar_integrations_id_check" CHECK (("id" = 'google_calendar'::"text"))
);


ALTER TABLE "public"."workspace_google_calendar_integrations" OWNER TO "postgres";


ALTER TABLE ONLY "public"."tasks" ALTER COLUMN "task_number" SET DEFAULT "nextval"('"public"."task_number_seq"'::"regclass");



ALTER TABLE ONLY "public"."access_group_members"
    ADD CONSTRAINT "access_group_members_pkey" PRIMARY KEY ("group_id", "profile_id");



ALTER TABLE ONLY "public"."access_groups"
    ADD CONSTRAINT "access_groups_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."access_groups"
    ADD CONSTRAINT "access_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_attachments"
    ADD CONSTRAINT "category_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_group_grants"
    ADD CONSTRAINT "category_group_grants_pkey" PRIMARY KEY ("category_id", "group_id");



ALTER TABLE ONLY "public"."category_owners"
    ADD CONSTRAINT "category_owners_pkey" PRIMARY KEY ("category_id", "profile_id");



ALTER TABLE ONLY "public"."contact_categories"
    ADD CONSTRAINT "contact_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."contact_categories"
    ADD CONSTRAINT "contact_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_category_assignments"
    ADD CONSTRAINT "contact_category_assignments_pkey" PRIMARY KEY ("contact_id", "category_id");



ALTER TABLE ONLY "public"."contact_people"
    ADD CONSTRAINT "contact_people_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."instance_settings"
    ADD CONSTRAINT "instance_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."labels"
    ADD CONSTRAINT "labels_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."labels"
    ADD CONSTRAINT "labels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."note_comments"
    ADD CONSTRAINT "note_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permission_audit_events"
    ADD CONSTRAINT "permission_audit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."privileged_audit_events"
    ADD CONSTRAINT "privileged_audit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."privileged_rate_limits"
    ADD CONSTRAINT "privileged_rate_limits_pkey" PRIMARY KEY ("rate_key");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_attachments"
    ADD CONSTRAINT "project_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_group_grants"
    ADD CONSTRAINT "project_group_grants_pkey" PRIMARY KEY ("project_id", "group_id");



ALTER TABLE ONLY "public"."project_owners"
    ADD CONSTRAINT "project_owners_pkey" PRIMARY KEY ("project_id", "profile_id");



ALTER TABLE ONLY "public"."project_user_grants"
    ADD CONSTRAINT "project_user_grants_pkey" PRIMARY KEY ("project_id", "profile_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."statuses"
    ADD CONSTRAINT "statuses_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."statuses"
    ADD CONSTRAINT "statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."statuses"
    ADD CONSTRAINT "statuses_sort_order_unique" UNIQUE ("sort_order") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."subtasks"
    ADD CONSTRAINT "subtasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_activity"
    ADD CONSTRAINT "task_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_assignees"
    ADD CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("task_id", "profile_id");



ALTER TABLE "public"."task_attachments"
    ADD CONSTRAINT "task_attachments_mime_allowlist" CHECK (("mime_type" = ANY (ARRAY['application/pdf'::"text", 'image/jpeg'::"text", 'image/png'::"text", 'image/webp'::"text", 'text/plain'::"text"]))) NOT VALID;



ALTER TABLE ONLY "public"."task_attachments"
    ADD CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."task_attachments"
    ADD CONSTRAINT "task_attachments_size_limit" CHECK ((("size_bytes" >= 1) AND ("size_bytes" <= 10485760))) NOT VALID;



ALTER TABLE ONLY "public"."task_categories"
    ADD CONSTRAINT "task_categories_pkey" PRIMARY KEY ("task_id", "category_id");



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_id_task_id_key" UNIQUE ("id", "task_id");



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_labels"
    ADD CONSTRAINT "task_labels_pkey" PRIMARY KEY ("task_id", "label_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_task_number_key" UNIQUE ("task_number");



ALTER TABLE ONLY "public"."work_groups"
    ADD CONSTRAINT "work_groups_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."work_groups"
    ADD CONSTRAINT "work_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_google_calendar_integrations"
    ADD CONSTRAINT "workspace_google_calendar_integrations_pkey" PRIMARY KEY ("id");



CREATE INDEX "access_group_members_profile_idx" ON "public"."access_group_members" USING "btree" ("profile_id");



CREATE UNIQUE INDEX "access_groups_unique_tier_rank" ON "public"."access_groups" USING "btree" ("hierarchy_rank") WHERE ("kind" = 'tier'::"public"."access_group_kind");



CREATE INDEX "calendar_events_category_id_idx" ON "public"."calendar_events" USING "btree" ("category_id") WHERE ("category_id" IS NOT NULL);



CREATE INDEX "calendar_events_created_by_idx" ON "public"."calendar_events" USING "btree" ("created_by");



CREATE INDEX "calendar_events_profile_id_idx" ON "public"."calendar_events" USING "btree" ("profile_id") WHERE ("profile_id" IS NOT NULL);



CREATE INDEX "calendar_events_project_id_idx" ON "public"."calendar_events" USING "btree" ("project_id") WHERE ("project_id" IS NOT NULL);



CREATE INDEX "calendar_events_starts_at_idx" ON "public"."calendar_events" USING "btree" ("starts_at");



CREATE INDEX "category_attachments_category_idx" ON "public"."category_attachments" USING "btree" ("category_id", "sort_order");



CREATE INDEX "category_group_grants_group_idx" ON "public"."category_group_grants" USING "btree" ("group_id");



CREATE INDEX "note_comments_note_idx" ON "public"."note_comments" USING "btree" ("note_id", "created_at");



CREATE INDEX "notes_active_updated_at_idx" ON "public"."notes" USING "btree" ("updated_at" DESC) WHERE ("archived_at" IS NULL);



CREATE INDEX "notes_category_id_idx" ON "public"."notes" USING "btree" ("category_id");



CREATE INDEX "privileged_audit_events_actor_created_idx" ON "public"."privileged_audit_events" USING "btree" ("actor_id", "created_at" DESC);



CREATE INDEX "project_attachments_project_idx" ON "public"."project_attachments" USING "btree" ("project_id", "sort_order");



CREATE INDEX "project_group_grants_group_idx" ON "public"."project_group_grants" USING "btree" ("group_id");



CREATE INDEX "project_user_grants_profile_idx" ON "public"."project_user_grants" USING "btree" ("profile_id");



CREATE INDEX "subtasks_task_idx" ON "public"."subtasks" USING "btree" ("task_id");



CREATE INDEX "task_activity_task_idx" ON "public"."task_activity" USING "btree" ("task_id");



CREATE INDEX "task_assignees_profile_idx" ON "public"."task_assignees" USING "btree" ("profile_id");



CREATE INDEX "task_attachments_task_idx" ON "public"."task_attachments" USING "btree" ("task_id");



CREATE INDEX "task_categories_category_idx" ON "public"."task_categories" USING "btree" ("category_id");



CREATE INDEX "task_comments_parent_id_idx" ON "public"."task_comments" USING "btree" ("parent_id", "created_at");



CREATE INDEX "task_comments_task_idx" ON "public"."task_comments" USING "btree" ("task_id");



CREATE INDEX "task_labels_label_idx" ON "public"."task_labels" USING "btree" ("label_id");



CREATE INDEX "tasks_project_idx" ON "public"."tasks" USING "btree" ("project_id");



CREATE INDEX "tasks_status_board_position_idx" ON "public"."tasks" USING "btree" ("status_id", "board_position");



CREATE INDEX "work_groups_archived_at_idx" ON "public"."work_groups" USING "btree" ("archived_at");



CREATE OR REPLACE TRIGGER "access_group_members_require_tier" BEFORE DELETE ON "public"."access_group_members" FOR EACH ROW EXECUTE FUNCTION "public"."protect_required_tier_membership"();



CREATE OR REPLACE TRIGGER "access_group_members_single_tier" BEFORE INSERT OR UPDATE ON "public"."access_group_members" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_single_access_tier"();



CREATE OR REPLACE TRIGGER "access_groups_protect_kind" BEFORE DELETE OR UPDATE OF "kind" ON "public"."access_groups" FOR EACH ROW EXECUTE FUNCTION "public"."protect_access_group_kind"();



CREATE OR REPLACE TRIGGER "access_groups_updated_at" BEFORE UPDATE ON "public"."access_groups" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "audit_access_group_members" AFTER INSERT OR DELETE OR UPDATE ON "public"."access_group_members" FOR EACH ROW EXECUTE FUNCTION "public"."audit_permission_change"();



CREATE OR REPLACE TRIGGER "audit_access_groups" AFTER INSERT OR DELETE OR UPDATE ON "public"."access_groups" FOR EACH ROW EXECUTE FUNCTION "public"."audit_permission_change"();



CREATE OR REPLACE TRIGGER "audit_category_group_grants" AFTER INSERT OR DELETE OR UPDATE ON "public"."category_group_grants" FOR EACH ROW EXECUTE FUNCTION "public"."audit_permission_change"();



CREATE OR REPLACE TRIGGER "audit_profile_roles" AFTER UPDATE OF "app_role" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."audit_permission_change"();



CREATE OR REPLACE TRIGGER "audit_project_group_grants" AFTER INSERT OR DELETE OR UPDATE ON "public"."project_group_grants" FOR EACH ROW EXECUTE FUNCTION "public"."audit_permission_change"();



CREATE OR REPLACE TRIGGER "audit_project_user_grants" AFTER INSERT OR DELETE OR UPDATE ON "public"."project_user_grants" FOR EACH ROW EXECUTE FUNCTION "public"."audit_permission_change"();



CREATE OR REPLACE TRIGGER "calendar_events_updated_at" BEFORE UPDATE ON "public"."calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "category_attachments_assign_sort_order" BEFORE INSERT ON "public"."category_attachments" FOR EACH ROW EXECUTE FUNCTION "public"."assign_category_attachment_sort_order"();



CREATE OR REPLACE TRIGGER "contacts_updated_at" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "enforce_task_attachment_quota" BEFORE INSERT OR UPDATE OF "size_bytes", "created_by", "task_id" ON "public"."task_attachments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_task_attachment_quota"();



CREATE OR REPLACE TRIGGER "instance_settings_touch" BEFORE UPDATE ON "public"."instance_settings" FOR EACH ROW EXECUTE FUNCTION "public"."touch_instance_settings"();



CREATE OR REPLACE TRIGGER "notes_updated_at" BEFORE UPDATE ON "public"."notes" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "privileged_audit_events_immutable" BEFORE DELETE OR UPDATE ON "public"."privileged_audit_events" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_privileged_audit_mutation"();



CREATE OR REPLACE TRIGGER "profiles_protect_last_owner_delete" BEFORE DELETE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_last_owner_removal"();



CREATE OR REPLACE TRIGGER "profiles_protect_owner_role" BEFORE UPDATE OF "app_role" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_last_owner_removal"();



CREATE OR REPLACE TRIGGER "project_attachments_assign_sort_order" BEFORE INSERT ON "public"."project_attachments" FOR EACH ROW EXECUTE FUNCTION "public"."assign_project_attachment_sort_order"();



CREATE OR REPLACE TRIGGER "project_group_grants_updated_at" BEFORE UPDATE ON "public"."project_group_grants" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "project_user_grants_updated_at" BEFORE UPDATE ON "public"."project_user_grants" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "projects_grant_creator_groups" AFTER INSERT ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."grant_new_project_to_creator_groups"();



CREATE OR REPLACE TRIGGER "statuses_refresh_task_completion" AFTER UPDATE OF "is_completed" ON "public"."statuses" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_tasks_for_status_completion"();



CREATE OR REPLACE TRIGGER "task_activity_log" AFTER INSERT OR UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."log_task_change"();



CREATE OR REPLACE TRIGGER "task_deletion_activity_log" BEFORE DELETE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."log_task_deletion"();



CREATE OR REPLACE TRIGGER "tasks_assign_board_position" BEFORE INSERT ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."assign_task_board_position"();



CREATE OR REPLACE TRIGGER "tasks_completion_lifecycle" BEFORE INSERT OR UPDATE OF "status_id" ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_task_completion_lifecycle"();



CREATE OR REPLACE TRIGGER "tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "work_groups_prune_removed_tags" AFTER UPDATE OF "tags" ON "public"."work_groups" FOR EACH ROW EXECUTE FUNCTION "public"."prune_removed_category_tags"();



ALTER TABLE ONLY "public"."access_group_members"
    ADD CONSTRAINT "access_group_members_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."access_group_members"
    ADD CONSTRAINT "access_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."access_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."access_group_members"
    ADD CONSTRAINT "access_group_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."access_groups"
    ADD CONSTRAINT "access_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."work_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_attachments"
    ADD CONSTRAINT "category_attachments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."work_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_attachments"
    ADD CONSTRAINT "category_attachments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."category_group_grants"
    ADD CONSTRAINT "category_group_grants_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."work_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_group_grants"
    ADD CONSTRAINT "category_group_grants_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."category_group_grants"
    ADD CONSTRAINT "category_group_grants_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."access_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_owners"
    ADD CONSTRAINT "category_owners_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."work_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_owners"
    ADD CONSTRAINT "category_owners_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_categories"
    ADD CONSTRAINT "contact_categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."contact_category_assignments"
    ADD CONSTRAINT "contact_category_assignments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."contact_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_category_assignments"
    ADD CONSTRAINT "contact_category_assignments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_people"
    ADD CONSTRAINT "contact_people_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."instance_settings"
    ADD CONSTRAINT "instance_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."labels"
    ADD CONSTRAINT "labels_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."note_comments"
    ADD CONSTRAINT "note_comments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."note_comments"
    ADD CONSTRAINT "note_comments_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."work_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_converted_project_id_fkey" FOREIGN KEY ("converted_project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_converted_task_id_fkey" FOREIGN KEY ("converted_task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."permission_audit_events"
    ADD CONSTRAINT "permission_audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."privileged_audit_events"
    ADD CONSTRAINT "privileged_audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_attachments"
    ADD CONSTRAINT "project_attachments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."project_attachments"
    ADD CONSTRAINT "project_attachments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_group_grants"
    ADD CONSTRAINT "project_group_grants_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."project_group_grants"
    ADD CONSTRAINT "project_group_grants_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."access_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_group_grants"
    ADD CONSTRAINT "project_group_grants_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_owners"
    ADD CONSTRAINT "project_owners_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_owners"
    ADD CONSTRAINT "project_owners_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_user_grants"
    ADD CONSTRAINT "project_user_grants_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."project_user_grants"
    ADD CONSTRAINT "project_user_grants_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_user_grants"
    ADD CONSTRAINT "project_user_grants_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."subtasks"
    ADD CONSTRAINT "subtasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."subtasks"
    ADD CONSTRAINT "subtasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_activity"
    ADD CONSTRAINT "task_activity_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_activity"
    ADD CONSTRAINT "task_activity_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_assignees"
    ADD CONSTRAINT "task_assignees_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_assignees"
    ADD CONSTRAINT "task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_attachments"
    ADD CONSTRAINT "task_attachments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."task_attachments"
    ADD CONSTRAINT "task_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_categories"
    ADD CONSTRAINT "task_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."work_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_categories"
    ADD CONSTRAINT "task_categories_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_parent_task_fkey" FOREIGN KEY ("parent_id", "task_id") REFERENCES "public"."task_comments"("id", "task_id") ON DELETE SET NULL ("parent_id");



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_labels"
    ADD CONSTRAINT "task_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_labels"
    ADD CONSTRAINT "task_labels_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."statuses"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_work_group_id_fkey" FOREIGN KEY ("work_group_id") REFERENCES "public"."work_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_groups"
    ADD CONSTRAINT "work_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."workspace_google_calendar_integrations"
    ADD CONSTRAINT "workspace_google_calendar_integrations_connected_by_fkey" FOREIGN KEY ("connected_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE "public"."access_group_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."access_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authors delete note comments" ON "public"."note_comments" FOR DELETE USING ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."notes"
  WHERE ("notes"."id" = "note_comments"."note_id")))));



CREATE POLICY "authors update note comments" ON "public"."note_comments" FOR UPDATE USING ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."notes"
  WHERE ("notes"."id" = "note_comments"."note_id"))))) WITH CHECK ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."notes"
  WHERE ("notes"."id" = "note_comments"."note_id")))));



ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calendar_events_delete" ON "public"."calendar_events" FOR DELETE TO "authenticated" USING (("public"."is_app_owner"() OR ((("created_by" = "auth"."uid"()) OR ("profile_id" = "auth"."uid"())) AND (("project_id" IS NULL) OR "public"."can_edit_project"("project_id")) AND (("category_id" IS NULL) OR "public"."can_access_category"("category_id")))));



CREATE POLICY "calendar_events_insert" ON "public"."calendar_events" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_team_member"() AND ("created_by" = "auth"."uid"()) AND (("kind" <> 'away'::"public"."calendar_event_kind") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "away_profile"
  WHERE (("away_profile"."id" = "calendar_events"."profile_id") AND "away_profile"."onboarding_completed")))) AND (("project_id" IS NULL) OR "public"."can_edit_project"("project_id")) AND (("category_id" IS NULL) OR "public"."can_access_category"("category_id"))));



CREATE POLICY "calendar_events_select" ON "public"."calendar_events" FOR SELECT TO "authenticated" USING (("public"."is_team_member"() AND (("kind" = 'away'::"public"."calendar_event_kind") OR ((("project_id" IS NULL) OR "public"."can_view_project"("project_id")) AND (("category_id" IS NULL) OR "public"."can_access_category"("category_id"))))));



CREATE POLICY "calendar_events_update" ON "public"."calendar_events" FOR UPDATE TO "authenticated" USING (("public"."is_app_owner"() OR ((("created_by" = "auth"."uid"()) OR ("profile_id" = "auth"."uid"())) AND (("project_id" IS NULL) OR "public"."can_edit_project"("project_id")) AND (("category_id" IS NULL) OR "public"."can_access_category"("category_id"))))) WITH CHECK (("public"."is_app_owner"() OR ((("created_by" = "auth"."uid"()) OR ("profile_id" = "auth"."uid"())) AND (("kind" <> 'away'::"public"."calendar_event_kind") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "away_profile"
  WHERE (("away_profile"."id" = "calendar_events"."profile_id") AND "away_profile"."onboarding_completed")))) AND (("project_id" IS NULL) OR "public"."can_edit_project"("project_id")) AND (("category_id" IS NULL) OR "public"."can_access_category"("category_id")))));



ALTER TABLE "public"."category_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."category_group_grants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."category_owners" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comment authors delete comments" ON "public"."task_comments" FOR DELETE USING (("public"."can_edit_task"("task_id") AND ("created_by" = "auth"."uid"())));



CREATE POLICY "comment authors update comments" ON "public"."task_comments" FOR UPDATE USING (("public"."can_edit_task"("task_id") AND ("created_by" = "auth"."uid"()))) WITH CHECK (("public"."can_edit_task"("task_id") AND ("created_by" = "auth"."uid"())));



ALTER TABLE "public"."contact_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_category_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_people" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "editors add activity" ON "public"."task_activity" FOR INSERT WITH CHECK (("public"."can_edit_task"("task_id") AND ("actor_id" = "auth"."uid"())));



CREATE POLICY "editors create project attachments" ON "public"."project_attachments" FOR INSERT WITH CHECK (("public"."can_edit_project"("project_id") AND ("created_by" = "auth"."uid"())));



CREATE POLICY "editors create tasks" ON "public"."tasks" FOR INSERT WITH CHECK (("public"."is_app_owner"() OR (((("project_id" IS NULL) AND "public"."is_team_member"()) OR "public"."can_edit_project"("project_id")) AND ("created_by" = "auth"."uid"()) AND (("assignee_id" IS NULL) OR "public"."can_assign_to_project"("assignee_id", "project_id")))));



CREATE POLICY "editors delete project attachments" ON "public"."project_attachments" FOR DELETE USING ("public"."can_edit_project"("project_id"));



CREATE POLICY "editors delete tasks" ON "public"."tasks" FOR DELETE USING ("public"."can_edit_task"("id"));



CREATE POLICY "editors update project attachments" ON "public"."project_attachments" FOR UPDATE USING ("public"."can_edit_project"("project_id")) WITH CHECK ("public"."can_edit_project"("project_id"));



CREATE POLICY "editors update tasks" ON "public"."tasks" FOR UPDATE USING ("public"."can_edit_task"("id")) WITH CHECK ((((("project_id" IS NULL) AND "public"."is_team_member"()) OR "public"."can_edit_project"("project_id")) AND "public"."can_access_task_categories"("id") AND (("assignee_id" IS NULL) OR "public"."can_assign_to_project"("assignee_id", "project_id"))));



CREATE POLICY "instance settings are publicly readable" ON "public"."instance_settings" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."instance_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."labels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "managers add eligible project owner metadata" ON "public"."project_owners" FOR INSERT WITH CHECK (("public"."can_manage_project"("project_id") AND "public"."can_assign_to_project"("profile_id", "project_id")));



CREATE POLICY "managers delete project owner metadata" ON "public"."project_owners" FOR DELETE USING ("public"."can_manage_project"("project_id"));



CREATE POLICY "managers update category attachments" ON "public"."category_attachments" FOR UPDATE USING ("public"."can_manage_categories"()) WITH CHECK ("public"."can_manage_categories"());



CREATE POLICY "managers update eligible project owner metadata" ON "public"."project_owners" FOR UPDATE USING ("public"."can_manage_project"("project_id")) WITH CHECK (("public"."can_manage_project"("project_id") AND "public"."can_assign_to_project"("profile_id", "project_id")));



CREATE POLICY "managers update projects" ON "public"."projects" FOR UPDATE USING ("public"."can_manage_project"("id")) WITH CHECK ("public"."can_manage_project"("id"));



CREATE POLICY "members create note comments" ON "public"."note_comments" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."notes"
  WHERE ("notes"."id" = "note_comments"."note_id")))));



CREATE POLICY "members create notes" ON "public"."notes" FOR INSERT WITH CHECK (("public"."is_team_member"() AND ("created_by" = "auth"."uid"()) AND ("converted_task_id" IS NULL) AND (("category_id" IS NULL) OR "public"."can_access_category"("category_id"))));



CREATE POLICY "members delete notes" ON "public"."notes" FOR DELETE USING (("public"."is_team_member"() AND (("category_id" IS NULL) OR "public"."can_access_category"("category_id"))));



CREATE POLICY "members read accessible categories" ON "public"."work_groups" FOR SELECT USING ("public"."can_access_category"("id"));



CREATE POLICY "members read note comments" ON "public"."note_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."notes"
  WHERE ("notes"."id" = "note_comments"."note_id"))));



CREATE POLICY "members read notes" ON "public"."notes" FOR SELECT USING (("public"."is_team_member"() AND (("category_id" IS NULL) OR "public"."can_access_category"("category_id"))));



CREATE POLICY "members read relevant user grants" ON "public"."project_user_grants" FOR SELECT USING (("public"."can_view_project"("project_id") AND (("profile_id" = "auth"."uid"()) OR "public"."can_manage_project"("project_id"))));



CREATE POLICY "members update notes" ON "public"."notes" FOR UPDATE USING (("public"."is_team_member"() AND (("category_id" IS NULL) OR "public"."can_access_category"("category_id")))) WITH CHECK (("public"."is_team_member"() AND (("category_id" IS NULL) OR "public"."can_access_category"("category_id"))));



CREATE POLICY "members view accessible project owner metadata" ON "public"."project_owners" FOR SELECT USING ("public"."can_view_project"("project_id"));



CREATE POLICY "members view accessible projects" ON "public"."projects" FOR SELECT USING ("public"."can_view_project"("id"));



CREATE POLICY "members view accessible tasks" ON "public"."tasks" FOR SELECT USING ((((("project_id" IS NULL) AND "public"."is_team_member"()) OR "public"."can_view_project"("project_id")) AND "public"."can_access_task_categories"("id")));



CREATE POLICY "members view activity" ON "public"."task_activity" FOR SELECT USING ("public"."can_view_task"("task_id"));



CREATE POLICY "members view assignees" ON "public"."task_assignees" FOR SELECT USING ("public"."can_view_task"("task_id"));



CREATE POLICY "members view attachments" ON "public"."task_attachments" FOR SELECT USING ("public"."can_view_task"("task_id"));



CREATE POLICY "members view category attachments" ON "public"."category_attachments" FOR SELECT USING ("public"."can_access_category"("category_id"));



CREATE POLICY "members view category owner metadata" ON "public"."category_owners" FOR SELECT USING ("public"."is_team_member"());



CREATE POLICY "members view comments" ON "public"."task_comments" FOR SELECT USING ("public"."can_view_task"("task_id"));



CREATE POLICY "members view project attachments" ON "public"."project_attachments" FOR SELECT USING ("public"."can_view_project"("project_id"));



CREATE POLICY "members view subtasks" ON "public"."subtasks" FOR SELECT USING ("public"."can_view_task"("task_id"));



CREATE POLICY "members view task categories" ON "public"."task_categories" FOR SELECT USING ("public"."can_view_task"("task_id"));



CREATE POLICY "members view task labels" ON "public"."task_labels" FOR SELECT USING ("public"."can_view_task"("task_id"));



ALTER TABLE "public"."note_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owners add category owner metadata" ON "public"."category_owners" FOR INSERT WITH CHECK ("public"."is_app_owner"());



CREATE POLICY "owners create projects" ON "public"."projects" FOR INSERT WITH CHECK (("public"."is_app_owner"() AND ("created_by" = "auth"."uid"())));



CREATE POLICY "owners delete category owner metadata" ON "public"."category_owners" FOR DELETE USING ("public"."is_app_owner"());



CREATE POLICY "owners delete projects" ON "public"."projects" FOR DELETE USING ("public"."is_app_owner"());



CREATE POLICY "owners manage access groups" ON "public"."access_groups" USING ("public"."is_app_owner"()) WITH CHECK (("public"."is_app_owner"() AND ("created_by" = "auth"."uid"())));



CREATE POLICY "owners manage category grants" ON "public"."category_group_grants" USING ("public"."is_app_owner"()) WITH CHECK ("public"."is_app_owner"());



CREATE POLICY "owners manage group members" ON "public"."access_group_members" USING ("public"."is_app_owner"()) WITH CHECK (("public"."is_app_owner"() AND ("added_by" = "auth"."uid"())));



CREATE POLICY "owners manage labels" ON "public"."labels" USING ("public"."is_app_owner"()) WITH CHECK ("public"."is_app_owner"());



CREATE POLICY "owners manage project group grants" ON "public"."project_group_grants" USING ("public"."is_app_owner"()) WITH CHECK (("public"."is_app_owner"() AND ("granted_by" = "auth"."uid"())));



CREATE POLICY "owners manage statuses" ON "public"."statuses" USING ("public"."is_app_owner"()) WITH CHECK ("public"."is_app_owner"());



CREATE POLICY "owners read permission audit" ON "public"."permission_audit_events" FOR SELECT USING ("public"."is_app_owner"());



CREATE POLICY "owners read privileged audit" ON "public"."privileged_audit_events" FOR SELECT USING ("public"."is_app_owner"());



CREATE POLICY "owners update category owner metadata" ON "public"."category_owners" FOR UPDATE USING ("public"."is_app_owner"()) WITH CHECK ("public"."is_app_owner"());



CREATE POLICY "owners update profiles" ON "public"."profiles" FOR UPDATE USING ("public"."is_app_owner"()) WITH CHECK ("public"."is_app_owner"());



ALTER TABLE "public"."permission_audit_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."privileged_audit_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."privileged_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project managers manage user grants" ON "public"."project_user_grants" USING ("public"."can_manage_project"("project_id")) WITH CHECK (("public"."can_manage_project"("project_id") AND ("granted_by" = "auth"."uid"())));



ALTER TABLE "public"."project_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_group_grants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_owners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_user_grants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "r suite creates category attachments" ON "public"."category_attachments" FOR INSERT WITH CHECK (("public"."can_manage_categories"() AND ("created_by" = "auth"."uid"())));



CREATE POLICY "r suite deletes category attachments" ON "public"."category_attachments" FOR DELETE USING ("public"."can_manage_categories"());



CREATE POLICY "r suite manages category content" ON "public"."work_groups" USING ("public"."can_manage_categories"()) WITH CHECK ("public"."can_manage_categories"());



ALTER TABLE "public"."statuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subtasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task access controls assignees" ON "public"."task_assignees" USING ("public"."can_edit_task"("task_id")) WITH CHECK (("public"."can_edit_task"("task_id") AND "public"."can_assign_to_project"("profile_id", ( SELECT "tasks"."project_id"
   FROM "public"."tasks"
  WHERE ("tasks"."id" = "task_assignees"."task_id")))));



CREATE POLICY "task access controls attachments" ON "public"."task_attachments" USING ("public"."can_edit_task"("task_id")) WITH CHECK (("public"."can_edit_task"("task_id") AND ("created_by" = "auth"."uid"())));



CREATE POLICY "task access controls categories" ON "public"."task_categories" USING ("public"."can_edit_task"("task_id")) WITH CHECK (("public"."can_edit_task"("task_id") AND "public"."can_access_category"("category_id")));



CREATE POLICY "task access controls comment creation" ON "public"."task_comments" FOR INSERT WITH CHECK (("public"."can_edit_task"("task_id") AND ("created_by" = "auth"."uid"())));



CREATE POLICY "task access controls labels" ON "public"."task_labels" USING ("public"."can_edit_task"("task_id")) WITH CHECK ("public"."can_edit_task"("task_id"));



CREATE POLICY "task access controls subtasks" ON "public"."subtasks" USING ("public"."can_edit_task"("task_id")) WITH CHECK (("public"."can_edit_task"("task_id") AND ("created_by" = "auth"."uid"())));



ALTER TABLE "public"."task_activity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_assignees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_labels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team manages contact assignments" ON "public"."contact_category_assignments" USING ("public"."is_team_member"()) WITH CHECK ("public"."is_team_member"());



CREATE POLICY "team manages contact categories" ON "public"."contact_categories" USING ("public"."is_team_member"()) WITH CHECK (("public"."is_team_member"() AND ("created_by" = "auth"."uid"())));



CREATE POLICY "team manages contact people" ON "public"."contact_people" USING ("public"."is_team_member"()) WITH CHECK ("public"."is_team_member"());



CREATE POLICY "team manages contacts" ON "public"."contacts" USING ("public"."is_team_member"()) WITH CHECK (("public"."is_team_member"() AND ("created_by" = "auth"."uid"())));



CREATE POLICY "team reads labels" ON "public"."labels" FOR SELECT USING ("public"."is_team_member"());



CREATE POLICY "team reads profiles" ON "public"."profiles" FOR SELECT USING ("public"."is_team_member"());



CREATE POLICY "team reads statuses" ON "public"."statuses" FOR SELECT USING ("public"."is_team_member"());



CREATE POLICY "users read own profile" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."work_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_google_calendar_integrations" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."category_attachments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."category_owners";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."project_attachments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."project_owners";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."projects";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."subtasks";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."task_activity";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."task_assignees";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."task_attachments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."task_categories";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."task_comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."task_labels";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tasks";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."assign_category_attachment_sort_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_category_attachment_sort_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_category_attachment_sort_order"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_project_attachment_sort_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_project_attachment_sort_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_project_attachment_sort_order"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_task_board_position"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_task_board_position"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_task_board_position"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_permission_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_permission_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_permission_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_category"("requested_category_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_category"("requested_category_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_category"("requested_category_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_task_categories"("requested_task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_task_categories"("requested_task_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_task_categories"("requested_task_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_assign_to_project"("requested_profile_id" "uuid", "requested_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_assign_to_project"("requested_profile_id" "uuid", "requested_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_assign_to_project"("requested_profile_id" "uuid", "requested_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_edit_project"("project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_edit_project"("project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_edit_project"("project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_edit_task"("requested_task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_edit_task"("requested_task_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_edit_task"("requested_task_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_categories"() TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_categories"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_categories"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_group_projects"("requested_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_group_projects"("requested_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_group_projects"("requested_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_project"("project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_project"("project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_project"("project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_view_project"("project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_project"("project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_project"("project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_view_task"("requested_task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_task"("requested_task_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_task"("requested_task_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_view_workspace_calendar"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_workspace_calendar"() TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_workspace_calendar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_workspace_calendar"() TO "service_role";



GRANT ALL ON FUNCTION "public"."category_id_from_storage_path"("object_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."category_id_from_storage_path"("object_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."category_id_from_storage_path"("object_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_privileged_rate_limit"("requested_key" "text", "requested_limit" integer, "requested_window_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_privileged_rate_limit"("requested_key" "text", "requested_limit" integer, "requested_window_seconds" integer) TO "service_role";



GRANT ALL ON TABLE "public"."statuses" TO "anon";
GRANT ALL ON TABLE "public"."statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."statuses" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_status"("status_name" "text", "status_description" "text", "status_color" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_status"("status_name" "text", "status_description" "text", "status_color" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_subtask_with_activity"("subtask_id" "uuid", "parent_task_id" "uuid", "subtask_title" "text", "subtask_sort_order" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_subtask_with_activity"("subtask_id" "uuid", "parent_task_id" "uuid", "subtask_title" "text", "subtask_sort_order" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_subtask_with_activity"("subtask_id" "uuid", "parent_task_id" "uuid", "subtask_title" "text", "subtask_sort_order" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_status"("status_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_status"("status_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_task"("deleted_task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_task"("deleted_task_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_task"("deleted_task_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_single_access_tier"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_single_access_tier"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_single_access_tier"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_task_attachment_quota"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_task_attachment_quota"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_task_attachment_quota"() TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_new_project_to_creator_groups"() TO "anon";
GRANT ALL ON FUNCTION "public"."grant_new_project_to_creator_groups"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_new_project_to_creator_groups"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_global_content_access"("requested_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_global_content_access"("requested_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_global_content_access"("requested_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_access_group_member"("requested_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_access_group_member"("requested_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_access_group_member"("requested_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_app_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_app_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_app_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_member"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_member"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_member"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_orphaned_task_attachment_paths"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_orphaned_task_attachment_paths"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_task_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_task_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_task_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_task_deletion"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_task_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_task_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_task_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."member_has_group_access"("requested_profile_id" "uuid", "requested_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."member_has_group_access"("requested_profile_id" "uuid", "requested_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."member_has_group_access"("requested_profile_id" "uuid", "requested_group_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON FUNCTION "public"."move_task"("moved_task_id" "uuid", "next_status_id" "uuid", "next_board_position" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."move_task"("moved_task_id" "uuid", "next_status_id" "uuid", "next_board_position" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."move_task"("moved_task_id" "uuid", "next_status_id" "uuid", "next_board_position" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_last_owner_removal"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_last_owner_removal"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_last_owner_removal"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_privileged_audit_mutation"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_privileged_audit_mutation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_privileged_audit_mutation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."project_id_from_storage_path"("object_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."project_id_from_storage_path"("object_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."project_id_from_storage_path"("object_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."project_permission_for"("requested_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."project_permission_for"("requested_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."project_permission_for"("requested_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_access_group_kind"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_access_group_kind"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_access_group_kind"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_required_tier_membership"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_required_tier_membership"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_required_tier_membership"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prune_removed_category_tags"() TO "anon";
GRANT ALL ON FUNCTION "public"."prune_removed_category_tags"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prune_removed_category_tags"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_privileged_audit_event"("requested_actor_id" "uuid", "requested_action" "text", "requested_target_type" "text", "requested_target_id" "uuid", "requested_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_privileged_audit_event"("requested_actor_id" "uuid", "requested_action" "text", "requested_target_type" "text", "requested_target_id" "uuid", "requested_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_tasks_for_status_completion"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_tasks_for_status_completion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_tasks_for_status_completion"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reorder_statuses"("ordered_status_ids" "uuid"[], "expected_revision" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_statuses"("ordered_status_ids" "uuid"[], "expected_revision" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."replace_project_managers"("requested_project_id" "uuid", "requested_profile_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."replace_project_managers"("requested_project_id" "uuid", "requested_profile_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_project_managers"("requested_project_id" "uuid", "requested_profile_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."save_contact"("contact_id" "uuid", "contact_name" "text", "contact_notes" "text", "category_ids" "uuid"[], "new_category_names" "text"[], "people" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_contact"("contact_id" "uuid", "contact_name" "text", "contact_notes" "text", "category_ids" "uuid"[], "new_category_names" "text"[], "people" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_contact"("contact_id" "uuid", "contact_name" "text", "contact_notes" "text", "category_ids" "uuid"[], "new_category_names" "text"[], "people" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_task"("task_id" "uuid", "task_values" "jsonb", "category_ids" "uuid"[], "assignee_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_task"("task_id" "uuid", "task_values" "jsonb", "category_ids" "uuid"[], "assignee_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_task"("task_id" "uuid", "task_values" "jsonb", "category_ids" "uuid"[], "assignee_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_category_access"("requested_category_id" "uuid", "requested_access_mode" "text", "requested_group_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_category_access"("requested_category_id" "uuid", "requested_access_mode" "text", "requested_group_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_category_access"("requested_category_id" "uuid", "requested_access_mode" "text", "requested_group_ids" "uuid"[]) TO "service_role";



GRANT ALL ON TABLE "public"."access_group_members" TO "anon";
GRANT ALL ON TABLE "public"."access_group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."access_group_members" TO "service_role";



GRANT ALL ON FUNCTION "public"."set_profile_access_tier"("requested_profile_id" "uuid", "requested_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_profile_access_tier"("requested_profile_id" "uuid", "requested_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_profile_access_tier"("requested_profile_id" "uuid", "requested_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_task_completion_lifecycle"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_task_completion_lifecycle"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_task_completion_lifecycle"() TO "service_role";



GRANT ALL ON FUNCTION "public"."task_id_from_storage_path"("object_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."task_id_from_storage_path"("object_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."task_id_from_storage_path"("object_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_instance_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_instance_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_instance_settings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."access_groups" TO "anon";
GRANT ALL ON TABLE "public"."access_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."access_groups" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."category_attachments" TO "anon";
GRANT ALL ON TABLE "public"."category_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."category_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."category_group_grants" TO "anon";
GRANT ALL ON TABLE "public"."category_group_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."category_group_grants" TO "service_role";



GRANT ALL ON TABLE "public"."category_owners" TO "anon";
GRANT ALL ON TABLE "public"."category_owners" TO "authenticated";
GRANT ALL ON TABLE "public"."category_owners" TO "service_role";



GRANT ALL ON TABLE "public"."contact_categories" TO "anon";
GRANT ALL ON TABLE "public"."contact_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_categories" TO "service_role";



GRANT ALL ON TABLE "public"."contact_category_assignments" TO "anon";
GRANT ALL ON TABLE "public"."contact_category_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_category_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."contact_people" TO "anon";
GRANT ALL ON TABLE "public"."contact_people" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_people" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."instance_settings" TO "anon";
GRANT ALL ON TABLE "public"."instance_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."instance_settings" TO "service_role";



GRANT ALL ON TABLE "public"."labels" TO "anon";
GRANT ALL ON TABLE "public"."labels" TO "authenticated";
GRANT ALL ON TABLE "public"."labels" TO "service_role";



GRANT ALL ON TABLE "public"."note_comments" TO "anon";
GRANT ALL ON TABLE "public"."note_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."note_comments" TO "service_role";



GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";



GRANT ALL ON TABLE "public"."permission_audit_events" TO "anon";
GRANT ALL ON TABLE "public"."permission_audit_events" TO "authenticated";
GRANT ALL ON TABLE "public"."permission_audit_events" TO "service_role";



GRANT ALL ON TABLE "public"."privileged_audit_events" TO "service_role";



GRANT ALL ON TABLE "public"."privileged_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."project_attachments" TO "anon";
GRANT ALL ON TABLE "public"."project_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."project_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."project_group_grants" TO "anon";
GRANT ALL ON TABLE "public"."project_group_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."project_group_grants" TO "service_role";



GRANT ALL ON TABLE "public"."project_owners" TO "anon";
GRANT ALL ON TABLE "public"."project_owners" TO "authenticated";
GRANT ALL ON TABLE "public"."project_owners" TO "service_role";



GRANT ALL ON TABLE "public"."project_user_grants" TO "anon";
GRANT ALL ON TABLE "public"."project_user_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."project_user_grants" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."subtasks" TO "anon";
GRANT ALL ON TABLE "public"."subtasks" TO "authenticated";
GRANT ALL ON TABLE "public"."subtasks" TO "service_role";



GRANT ALL ON TABLE "public"."task_activity" TO "anon";
GRANT ALL ON TABLE "public"."task_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."task_activity" TO "service_role";



GRANT ALL ON TABLE "public"."task_assignees" TO "anon";
GRANT ALL ON TABLE "public"."task_assignees" TO "authenticated";
GRANT ALL ON TABLE "public"."task_assignees" TO "service_role";



GRANT ALL ON TABLE "public"."task_attachments" TO "anon";
GRANT ALL ON TABLE "public"."task_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."task_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."task_categories" TO "anon";
GRANT ALL ON TABLE "public"."task_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."task_categories" TO "service_role";



GRANT ALL ON TABLE "public"."task_comments" TO "anon";
GRANT ALL ON TABLE "public"."task_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."task_comments" TO "service_role";



GRANT ALL ON TABLE "public"."task_labels" TO "anon";
GRANT ALL ON TABLE "public"."task_labels" TO "authenticated";
GRANT ALL ON TABLE "public"."task_labels" TO "service_role";



GRANT ALL ON SEQUENCE "public"."task_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."task_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."task_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."work_groups" TO "anon";
GRANT ALL ON TABLE "public"."work_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."work_groups" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_google_calendar_integrations" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";




































-- ============================================================
-- 2. Profile creation on signup (trigger lives on auth.users)
-- ============================================================

CREATE OR REPLACE TRIGGER "auth_user_profile" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();

-- ============================================================
-- 3. Storage buckets and policies
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('category-attachments', 'category-attachments', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain']),
  ('instance-assets', 'instance-assets', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']),
  ('organization-images', 'organization-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('profile-avatars', 'profile-avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('project-attachments', 'project-attachments', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain']),
  ('task-attachments', 'task-attachments', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

CREATE POLICY "editors delete project files" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'project-attachments'::"text") AND "public"."can_edit_project"("public"."project_id_from_storage_path"("name"))));

CREATE POLICY "editors delete task files" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'task-attachments'::"text") AND "public"."can_edit_task"("public"."task_id_from_storage_path"("name"))));

CREATE POLICY "instance assets are publicly readable" ON "storage"."objects" FOR SELECT TO "authenticated", "anon" USING (("bucket_id" = 'instance-assets'::"text"));

CREATE POLICY "members read category files" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'category-attachments'::"text") AND "public"."can_access_category"("public"."category_id_from_storage_path"("name"))));

CREATE POLICY "members read project files" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'project-attachments'::"text") AND "public"."can_view_project"("public"."project_id_from_storage_path"("name"))));

CREATE POLICY "members read task files" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'task-attachments'::"text") AND "public"."can_view_task"("public"."task_id_from_storage_path"("name"))));

CREATE POLICY "r suite deletes category files" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'category-attachments'::"text") AND "public"."can_manage_categories"()));

CREATE POLICY "r suite uploads category files" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'category-attachments'::"text") AND "public"."can_manage_categories"()));

CREATE POLICY "team deletes organization images" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'organization-images'::"text") AND "public"."is_team_member"() AND ("owner_id" = ("auth"."uid"())::"text")));

CREATE POLICY "team updates organization images" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'organization-images'::"text") AND "public"."is_team_member"() AND ("owner_id" = ("auth"."uid"())::"text"))) WITH CHECK ((("bucket_id" = 'organization-images'::"text") AND "public"."is_team_member"() AND ("owner_id" = ("auth"."uid"())::"text")));

CREATE POLICY "team uploads organization images" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'organization-images'::"text") AND "public"."is_team_member"() AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));

CREATE POLICY "users delete own avatar" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'profile-avatars'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));

CREATE POLICY "users read own avatar object" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'profile-avatars'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));

CREATE POLICY "users update own avatar" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'profile-avatars'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text"))) WITH CHECK ((("bucket_id" = 'profile-avatars'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));

CREATE POLICY "users upload own avatar" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'profile-avatars'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));


-- ============================================================
-- 4. Match production's table grants on the privileged tables
-- ============================================================
--
-- Supabase's default privileges on schema `public` grant anon and
-- authenticated on every newly created table, and a dump's explicit
-- `GRANT ... TO service_role` does not take those away. Production has them
-- revoked; without this block a database built from the baseline would be
-- strictly more permissive than the one it was captured from.
--
-- Found by `supabase db diff --linked` after applying this file to an empty
-- database, which is the only way this class of difference shows up.

revoke references, trigger, truncate
  on table public.privileged_audit_events
  from anon, authenticated;

revoke references, trigger, truncate
  on table public.privileged_rate_limits
  from anon, authenticated;

revoke references, trigger, truncate
  on table public.workspace_google_calendar_integrations
  from anon, authenticated;
