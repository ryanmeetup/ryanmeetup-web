# PRD: unlock a sent RY-D card

Run the complete block below in the **PRD** Supabase dashboard **SQL Editor**
for `projects.ryanle.dev` (project `vjsnobmfsfrsnwukfaoq`), rather than RMT.
Keep RY-D disabled on PRD. This aligns its schema without enabling the feature.
Apply [importing card details](PRD_RYD_IMPORT_CARD_DETAILS_SQL.md) first.
The block replaces one function and changes no rows.

Source: `supabase/migrations/20261118000000_ryd_unlock_sent_card.sql`, with
the migration-history insert added before commit. It is safe to run again.
RMT is applied separately through the CLI by the agent.

```sql
-- Let a reviewer unlock a card that has gone to fulfillment and correct it,
-- keeping the order's stage and send date. The request has to say so with
-- `unlockCard`, so a stale page can't change a sent card by accident. The
-- decision stays locked, and a done order's card never changes. The audit
-- event records that the card was unlocked.
--
-- Same signature as before, so existing grants carry over.
begin;

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
  unlock_card boolean := false;
begin
  perform public.ryd_require_operator(requested_actor);
  -- Same lock order as ryd_change_submission: settings, response keys, order.
  perform 1 from public.ryd_settings where id for share;
  if jsonb_typeof(requested_patch) <> 'object' or requested_patch is null
    or exists (select 1 from jsonb_object_keys(requested_patch) k
      where k not in ('status', 'note', 'card', 'unlockCard', 'expectedStatus', 'expectedUpdatedAt'))
    or (requested_patch ? 'unlockCard' and (jsonb_typeof(requested_patch->'unlockCard') <> 'boolean' or card is null))
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
  unlock_card := coalesce((requested_patch->'unlockCard')::boolean, false);
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
    -- A sent card changes only when the reviewer unlocks it on purpose; a
    -- finished order's card never changes.
    if card_changed and current_order.done_at is not null then
      raise exception using errcode = 'RY409', message = 'This order is done. Its card cannot be changed.';
    end if;
    if card_changed and not unlock_card and (current_order.cleared_batch_id is not null
      or current_order.production_sent_at is not null) then
      raise exception using errcode = 'RY409', message = 'This card has already gone to fulfillment. Unlock it to change it.';
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
          'approved', next_status = 'verified',
          'unlocked', current_order.cleared_batch_id is not null or current_order.production_sent_at is not null
        ), requested_actor);
    end if;
  else saved_order := current_order;
  end if;
  return jsonb_build_object('ok', true, 'order', to_jsonb(saved_order));
end;
$function$;

insert into supabase_migrations.schema_migrations(version,name,statements)
values ('20261118000000','ryd_unlock_sent_card',array['-- Applied from the committed dashboard handoff.'])
on conflict (version) do nothing;
notify pgrst, 'reload schema';
commit;
```

Then verify in the same editor:

```sql
select
  exists(select 1 from supabase_migrations.schema_migrations where version='20261118000000') as recorded,
  pg_get_functiondef('public.ryd_review_order(uuid,text,jsonb,text,text[])'::regprocedure) like '%unlockCard%' as unlocks_sent_cards,
  public.ryd_contract_health() as health;
```

Expected: `recorded` and `unlocks_sent_cards` are `true`, and `health` has
`"contractOk": true` with an empty `failures` list.
