-- RMT only. Leave the v1 staff projection unchanged for older deployments.
-- The v2 read obtains review version, reply, revisions, and events from one
-- statement snapshot, so the displayed reply and its concurrency token agree.
create or replace function public.store_review_moderation_page_v2(
  p_actor uuid, p_shop_id text, p_filter text, p_limit integer,
  p_after_created_at timestamptz default null, p_after_id uuid default null
) returns setof jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.store_require_review_owner(p_actor);
  if p_filter is null or p_filter not in ('pending', 'published', 'hidden', 'all')
    or (p_after_created_at is null) <> (p_after_id is null) then
    raise exception 'Invalid moderation page' using errcode = '22023';
  end if;
  return query
  select jsonb_build_object(
    'id', r.id, 'state', r.state,
    'createdAt', public.store_review_staff_time(r.created_at),
    'updatedAt', public.store_review_staff_time(r.updated_at),
    'item', jsonb_build_object('productId', r.product_id, 'productTitle', r.product_title, 'variantTitle', r.variant_title),
    'pending', pending.content, 'published', approved.content, 'latest', latest.content,
    'reply', case when reply.review_id is null then null else jsonb_build_object(
      'body', reply.body, 'publishedAt', public.store_review_staff_time(reply.published_at),
      'updatedAt', public.store_review_staff_time(reply.updated_at)) end,
    'recentEvents', coalesce(events.content, '[]'::jsonb)
  )
  from public.store_reviews r
  left join public.store_review_replies reply on reply.review_id = r.id
  left join lateral (
    select jsonb_build_object('id', v.id, 'rating', v.rating, 'title', v.title, 'body', v.body,
      'displayName', v.display_name, 'submittedAt', public.store_review_staff_time(v.submitted_at)) content
    from public.store_review_revisions v where v.review_id = r.id and v.status = 'pending'
  ) pending on true
  left join lateral (
    select jsonb_build_object('id', v.id, 'rating', v.rating, 'title', v.title, 'body', v.body,
      'displayName', v.display_name, 'submittedAt', public.store_review_staff_time(v.submitted_at)) content
    from public.store_review_revisions v where v.id = r.approved_revision_id and v.review_id = r.id
  ) approved on true
  left join lateral (
    select jsonb_build_object('id', v.id, 'rating', v.rating, 'title', v.title, 'body', v.body,
      'displayName', v.display_name, 'submittedAt', public.store_review_staff_time(v.submitted_at)) content
    from public.store_review_revisions v where v.review_id = r.id
    order by v.submitted_at desc, v.id desc limit 1
  ) latest on true
  left join lateral (
    select jsonb_agg(e.content order by e.id desc) content from (
      select ev.id, jsonb_build_object('action', ev.action, 'actorKind', ev.actor_kind,
        'actor', case when ev.actor_kind = 'staff' then ev.actor else null end,
        'note', ev.note, 'createdAt', public.store_review_staff_time(ev.created_at)) content
      from public.store_review_events ev where ev.review_id = r.id order by ev.id desc limit 10
    ) e
  ) events on true
  where r.shop_id = p_shop_id
    and (p_after_created_at is null or (r.created_at, r.id) > (p_after_created_at, p_after_id))
    and case p_filter
      when 'pending' then pending.content is not null and r.state <> 'withdrawn'
      when 'published' then r.state = 'active' and r.approved_revision_id is not null
      when 'hidden' then r.state = 'hidden'
      else true end
  order by r.created_at, r.id
  limit least(greatest(coalesce(p_limit, 21), 1), 51);
end;
$$;

-- Set/update/remove the official reply only as a current Tasks app owner.
-- Buyer writes and moderation use the same review-first lock order.
create or replace function public.store_save_review_reply(
  p_actor uuid, p_shop_id text, p_review_id uuid,
  p_expected_updated_at timestamptz, p_body text
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_review public.store_reviews;
  v_body text;
begin
  perform public.store_require_review_owner(p_actor);
  if p_body is not null and (p_body <> btrim(p_body) or char_length(p_body) not between 1 and 2000) then
    raise exception 'Invalid official reply' using errcode = '22023';
  end if;
  select r.* into v_review from public.store_reviews r
  where r.id = p_review_id and r.shop_id = p_shop_id for update;
  if not found or v_review.state = 'withdrawn' or v_review.approved_revision_id is null
    or p_expected_updated_at is null or v_review.updated_at <> p_expected_updated_at then
    return false;
  end if;
  select reply.body into v_body from public.store_review_replies reply where reply.review_id = v_review.id;
  -- Repeated/unchanged writes make no additional public edit or audit event.
  if v_body is not distinct from p_body then return false; end if;
  if not public.store_set_review_reply(p_review_id, p_shop_id, p_body, p_actor::text) then return false; end if;
  update public.store_reviews set updated_at = greatest(clock_timestamp(), v_review.updated_at + interval '1 microsecond')
  where id = v_review.id;
  return true;
end;
$$;

revoke all on function
  public.store_review_moderation_page_v2(uuid,text,text,integer,timestamptz,uuid),
  public.store_save_review_reply(uuid,text,uuid,timestamptz,text)
  from public, anon, authenticated;
grant execute on function
  public.store_review_moderation_page_v2(uuid,text,text,integer,timestamptz,uuid),
  public.store_save_review_reply(uuid,text,uuid,timestamptz,text)
  to service_role;
notify pgrst, 'reload schema';
