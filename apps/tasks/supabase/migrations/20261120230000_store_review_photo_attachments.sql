-- RMT only. Private pending-revision associations and bounded photo collection.
-- Text approval never publishes media. Public projections remain unchanged.
alter table public.store_review_photo_drafts drop constraint if exists store_review_photo_drafts_state_check;
alter table public.store_review_photo_drafts add constraint store_review_photo_drafts_state_check
  check (state in ('uploading', 'ready', 'discarded', 'attached'));
alter table public.store_review_photo_drafts add column if not exists attached_review_id uuid
  references public.store_reviews(id) on delete restrict;
alter table public.store_review_photo_drafts drop constraint if exists store_review_photo_drafts_attachment_check;
alter table public.store_review_photo_drafts add constraint store_review_photo_drafts_attachment_check
  check ((state = 'attached') = (attached_review_id is not null));

create table if not exists public.store_review_revision_photos (
  revision_id uuid not null references public.store_review_revisions(id) on delete cascade,
  photo_id uuid not null references public.store_review_photo_drafts(id) on delete restrict,
  position smallint not null check (position between 1 and 5),
  moderation_state text not null default 'pending' check (moderation_state in ('pending', 'approved', 'rejected')),
  primary key (revision_id, photo_id),
  unique (revision_id, position)
);
alter table public.store_review_revision_photos enable row level security;
revoke all on public.store_review_revision_photos from public, anon, authenticated;
grant select, insert, update, delete on public.store_review_revision_photos to service_role;

create table if not exists public.store_review_photo_budgets (
  shop_id text not null check (shop_id ~ '^[1-9][0-9]{0,19}$'),
  customer_subject text not null check (length(customer_subject) between 1 and 512 and customer_subject !~ '[[:cntrl:]]'),
  window_started_at timestamptz not null,
  attempts smallint not null check (attempts between 1 and 30),
  primary key (shop_id, customer_subject)
);
alter table public.store_review_photo_budgets enable row level security;
revoke all on public.store_review_photo_budgets from public, anon, authenticated;
grant select, insert, update, delete on public.store_review_photo_budgets to service_role;

create or replace function public.store_consume_review_photo_budget(p_shop_id text, p_subject text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.store_review_photo_budgets;
begin
  insert into public.store_review_photo_budgets (shop_id, customer_subject, window_started_at, attempts)
    values (p_shop_id, p_subject, clock_timestamp(), 1)
  on conflict (shop_id, customer_subject) do update set
    attempts = case when store_review_photo_budgets.window_started_at <= clock_timestamp() - interval '10 minutes'
      then 1 else store_review_photo_budgets.attempts + 1 end,
    window_started_at = case when store_review_photo_budgets.window_started_at <= clock_timestamp() - interval '10 minutes'
      then clock_timestamp() else store_review_photo_budgets.window_started_at end
  where store_review_photo_budgets.attempts < 30 or store_review_photo_budgets.window_started_at <= clock_timestamp() - interval '10 minutes'
  returning * into v_row;
  if found then return jsonb_build_object('allowed', true, 'retryAfter', 0); end if;
  select * into strict v_row from public.store_review_photo_budgets where shop_id = p_shop_id and customer_subject = p_subject;
  return jsonb_build_object('allowed', false, 'retryAfter', greatest(1, least(600,
    ceil(extract(epoch from v_row.window_started_at + interval '10 minutes' - clock_timestamp()))::integer)));
end;
$$;

create or replace function public.store_begin_review_photo(
  p_shop_id text, p_subject text, p_product_id text, p_request_key uuid,
  p_sha256 text, p_byte_size integer, p_width integer, p_height integer
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_photo public.store_review_photo_drafts;
begin
  if p_shop_id is null or p_shop_id !~ '^[1-9][0-9]{0,19}$' or p_product_id is null or p_product_id !~ '^[1-9][0-9]{0,19}$'
    or p_subject is null or length(p_subject) not between 1 and 512 or p_subject ~ '[[:cntrl:]]' or p_request_key is null
    or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or p_byte_size is null or p_byte_size not between 1 and 4194304
    or p_width is null or p_width not between 1 and 2048 or p_height is null or p_height not between 1 and 2048 then
    raise exception using errcode = '22023', message = 'Invalid photo staging request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(jsonb_build_array(p_shop_id, p_subject, p_product_id)::text, 0));
  select * into v_photo from public.store_review_photo_drafts
    where shop_id = p_shop_id and customer_subject = p_subject and product_id = p_product_id and request_key = p_request_key for update;
  if found then
    if v_photo.sha256 <> p_sha256 or v_photo.byte_size <> p_byte_size or v_photo.width <> p_width or v_photo.height <> p_height then
      return jsonb_build_object('outcome', 'conflict', 'photo', null);
    end if;
    if v_photo.state not in ('uploading', 'ready') or v_photo.expires_at <= clock_timestamp() then
      return jsonb_build_object('outcome', 'closed', 'photo', null);
    end if;
    return jsonb_build_object('outcome', 'exists', 'photo', public.store_review_photo_draft_json(v_photo));
  end if;
  if (select count(*) from public.store_review_photo_drafts where shop_id = p_shop_id and customer_subject = p_subject
    and product_id = p_product_id and state in ('uploading', 'ready') and expires_at > clock_timestamp()) >= 5 then
    return jsonb_build_object('outcome', 'full', 'photo', null);
  end if;
  insert into public.store_review_photo_drafts (shop_id, customer_subject, product_id, request_key, sha256, byte_size, width, height)
    values (p_shop_id, p_subject, p_product_id, p_request_key, p_sha256, p_byte_size, p_width, p_height) returning * into v_photo;
  return jsonb_build_object('outcome', 'allocated', 'photo', public.store_review_photo_draft_json(v_photo));
end;
$$;

create or replace function public.store_get_review_photo(p_id uuid, p_shop_id text, p_subject text, p_product_id text)
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select public.store_review_photo_draft_json(p) from public.store_review_photo_drafts p
  where p.id = p_id and p.shop_id = p_shop_id and p.customer_subject = p_subject and p.product_id = p_product_id
    and p.state in ('uploading', 'ready') and p.expires_at > clock_timestamp();
$$;

create or replace function public.store_finish_review_photo(p_id uuid, p_shop_id text, p_subject text, p_product_id text, p_sha256 text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.store_review_photo_drafts set state = 'ready'
  where id = p_id and shop_id = p_shop_id and customer_subject = p_subject and product_id = p_product_id and sha256 = p_sha256
    and state = 'uploading' and expires_at > clock_timestamp();
  if found then return true; end if;
  return exists (select 1 from public.store_review_photo_drafts where id = p_id and shop_id = p_shop_id
    and customer_subject = p_subject and product_id = p_product_id and sha256 = p_sha256 and state = 'ready' and expires_at > clock_timestamp());
end;
$$;

create or replace function public.store_discard_review_photo(p_id uuid, p_shop_id text, p_subject text, p_product_id text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.store_review_photo_drafts set state = 'discarded'
  where id = p_id and shop_id = p_shop_id and customer_subject = p_subject and product_id = p_product_id and state in ('uploading', 'ready');
  if found then return true; end if;
  return exists (select 1 from public.store_review_photo_drafts where id = p_id and shop_id = p_shop_id
    and customer_subject = p_subject and product_id = p_product_id and state = 'discarded');
end;
$$;

create or replace function public.store_edit_review(
  p_review_id uuid, p_shop_id text, p_subject text,
  p_rating smallint, p_title text, p_body text, p_name_style text, p_display_name text
) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  v_state text;
  v_revision uuid;
  v_source uuid;
begin
  select r.state into v_state from public.store_reviews r
  where r.id = p_review_id and r.shop_id = p_shop_id and r.customer_subject = p_subject
  for update;
  if not found then return 'not_found'; end if;
  if v_state <> 'active' then return 'closed'; end if;

  select coalesce((select id from public.store_review_revisions where review_id = p_review_id and status = 'pending'),
    (select approved_revision_id from public.store_reviews where id = p_review_id),
    (select id from public.store_review_revisions where review_id = p_review_id order by submitted_at desc, id desc limit 1)) into v_source;

  update public.store_review_revisions v set status = 'superseded', decided_at = clock_timestamp()
  where v.review_id = p_review_id and v.status = 'pending';
  insert into public.store_review_revisions (review_id, rating, title, body, name_style, display_name)
  values (p_review_id, p_rating, p_title, p_body, p_name_style, p_display_name) returning id into v_revision;
  -- Text-only edits retain the latest photo selection, with a fresh media decision.
  insert into public.store_review_revision_photos (revision_id, photo_id, position)
    select v_revision, photo_id, position from public.store_review_revision_photos where revision_id = v_source;
  update public.store_reviews r set updated_at = clock_timestamp() where r.id = p_review_id;
  insert into public.store_review_events (review_id, revision_id, action, actor_kind, actor)
  values (p_review_id, v_revision, 'edited', 'buyer', p_subject);
  return 'pending';
end;
$$;

-- Called only inside the submit/edit transaction, after its review row is locked.
create or replace function public.store_attach_review_photos(p_review_id uuid, p_shop_id text, p_subject text, p_photo_ids uuid[])
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_review public.store_reviews; v_revision uuid; v_photo public.store_review_photo_drafts; v_id uuid;
begin
  if p_photo_ids is null or cardinality(p_photo_ids) > 5 or array_position(p_photo_ids, null) is not null
    or cardinality(p_photo_ids) <> (select count(distinct id) from unnest(p_photo_ids) as id) then return false; end if;
  select * into v_review from public.store_reviews where id = p_review_id and shop_id = p_shop_id
    and customer_subject = p_subject and state = 'active' for update;
  if not found then return false; end if;
  select id into v_revision from public.store_review_revisions where review_id = p_review_id and status = 'pending' for update;
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(jsonb_build_array(p_shop_id, p_subject, v_review.product_id)::text, 0));
  -- Stable lock ordering also serializes competing claims and discard/upload races.
  for v_id in select id from unnest(p_photo_ids) as id order by id loop
    select * into v_photo from public.store_review_photo_drafts where id = v_id and shop_id = p_shop_id
      and customer_subject = p_subject and product_id = v_review.product_id for update;
    if not found then return false; end if;
    if not ((v_photo.state = 'ready' and v_photo.expires_at > clock_timestamp())
      or (v_photo.state = 'attached' and v_photo.attached_review_id = p_review_id)) then return false; end if;
    if not exists (select 1 from storage.objects where bucket_id = 'store-review-photos'
      and name = p_shop_id || '/' || v_id::text || '.webp') then return false; end if;
  end loop;
  -- Validation completes before changing any association. Wrappers roll back text and events too.
  delete from public.store_review_revision_photos where revision_id = v_revision;
  insert into public.store_review_revision_photos (revision_id, photo_id, position)
    select v_revision, id, position::smallint from unnest(p_photo_ids) with ordinality as photos(id, position);
  update public.store_review_photo_drafts set state = 'attached', attached_review_id = p_review_id
    where id = any(p_photo_ids) and state = 'ready';
  return true;
end;
$$;

create or replace function public.store_submit_review_with_photos(
  p_shop_id text, p_subject text, p_order_id text, p_line_id text,
  p_product_id text, p_variant_id text, p_product_title text, p_variant_title text,
  p_rating smallint, p_title text, p_body text, p_name_style text, p_display_name text, p_photo_ids uuid[]
) returns table (review_id uuid, outcome text)
language plpgsql security invoker set search_path = '' as $$
declare v_result record;
begin
  select * into strict v_result from public.store_submit_review(p_shop_id, p_subject, p_order_id, p_line_id,
    p_product_id, p_variant_id, p_product_title, p_variant_title, p_rating, p_title, p_body, p_name_style, p_display_name);
  if v_result.outcome in ('created', 'resubmitted') and not public.store_attach_review_photos(v_result.review_id, p_shop_id, p_subject, p_photo_ids) then
    raise exception using errcode = 'RP001', message = 'Review photos unavailable';
  end if;
  return query select v_result.review_id::uuid, v_result.outcome::text;
exception when sqlstate 'RP001' then
  return query select null::uuid, 'invalid_photos'::text;
end;
$$;

create or replace function public.store_edit_buyer_review_with_photos(
  p_review_id uuid, p_shop_id text, p_subject text, p_expected_updated_at timestamptz,
  p_rating smallint, p_title text, p_body text, p_name_style text, p_display_name text, p_photo_ids uuid[]
) returns text language plpgsql security invoker set search_path = '' as $$
declare v_outcome text;
begin
  v_outcome := public.store_edit_buyer_review(p_review_id, p_shop_id, p_subject, p_expected_updated_at,
    p_rating, p_title, p_body, p_name_style, p_display_name);
  if v_outcome = 'pending' and not public.store_attach_review_photos(p_review_id, p_shop_id, p_subject, p_photo_ids) then
    raise exception using errcode = 'RP001', message = 'Review photos unavailable';
  end if;
  return v_outcome;
exception when sqlstate 'RP001' then return 'invalid_photos';
end;
$$;

revoke all on function public.store_consume_review_photo_budget(text,text),
  public.store_attach_review_photos(uuid,text,text,uuid[]),
  public.store_submit_review_with_photos(text,text,text,text,text,text,text,text,smallint,text,text,text,text,uuid[]),
  public.store_edit_buyer_review_with_photos(uuid,text,text,timestamptz,smallint,text,text,text,text,uuid[]) from public, anon, authenticated;
grant execute on function public.store_consume_review_photo_budget(text,text),
  public.store_attach_review_photos(uuid,text,text,uuid[]),
  public.store_submit_review_with_photos(text,text,text,text,text,text,text,text,smallint,text,text,text,text,uuid[]),
  public.store_edit_buyer_review_with_photos(uuid,text,text,timestamptz,smallint,text,text,text,text,uuid[]) to service_role;
