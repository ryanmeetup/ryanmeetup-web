-- Staff moderation lists the newest reviews first. Unchanged from 20261121150000
-- apart from the sort and its keyset, which now pages toward older reviews.
create or replace function public.store_review_moderation_page_v5(
  p_actor uuid, p_shop_id text, p_filter text, p_product_id text, p_limit integer,
  p_after_created_at timestamptz default null, p_after_id uuid default null
) returns setof jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.store_require_review_owner(p_actor);
  if p_filter is null or p_filter not in ('pending', 'published', 'hidden', 'rejected', 'all')
    or (p_product_id is not null and p_product_id !~ '^[1-9][0-9]{0,19}$')
    or (p_after_created_at is null) <> (p_after_id is null) then
    raise exception 'Invalid moderation page' using errcode = '22023';
  end if;
  return query
  select jsonb_build_object(
    'id', r.id, 'state', r.state,
    'createdAt', public.store_review_staff_time(r.created_at),
    'updatedAt', public.store_review_staff_time(r.updated_at),
    'item', jsonb_build_object('productId', r.product_id, 'productTitle', r.product_title, 'variantTitle', r.variant_title),
    'verifiedPurchase', r.order_id is not null,
    'source', r.source,
    'pending', pending.content, 'published', approved.content, 'latest', latest.content,
    'rejected', case when latest.status = 'rejected' and r.state <> 'withdrawn' then latest.content else null end,
    'reply', case when reply.review_id is null then null else jsonb_build_object(
      'body', reply.body, 'publishedAt', public.store_review_staff_time(reply.published_at),
      'updatedAt', public.store_review_staff_time(reply.updated_at)) end,
    'recentEvents', coalesce(events.content, '[]'::jsonb)
  )
  from public.store_reviews r
  left join public.store_review_replies reply on reply.review_id = r.id
  left join lateral (
    select jsonb_build_object('id', v.id, 'rating', v.rating, 'title', v.title, 'body', v.body,
      'displayName', v.display_name, 'submittedAt', public.store_review_staff_time(v.submitted_at), 'photos', public.store_staff_revision_photos(v.id)) content
    from public.store_review_revisions v where v.review_id = r.id and v.status = 'pending'
  ) pending on true
  left join lateral (
    select jsonb_build_object('id', v.id, 'rating', v.rating, 'title', v.title, 'body', v.body,
      'displayName', v.display_name, 'submittedAt', public.store_review_staff_time(v.submitted_at), 'photos', public.store_staff_revision_photos(v.id)) content
    from public.store_review_revisions v where v.id = r.approved_revision_id and v.review_id = r.id
  ) approved on true
  left join lateral (
    select v.status, jsonb_build_object('id', v.id, 'rating', v.rating, 'title', v.title, 'body', v.body,
      'displayName', v.display_name, 'submittedAt', public.store_review_staff_time(v.submitted_at), 'photos', public.store_staff_revision_photos(v.id)) content
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
    and (p_product_id is null or r.product_id = p_product_id)
    and (p_after_created_at is null or (r.created_at, r.id) < (p_after_created_at, p_after_id))
    and case p_filter
      when 'pending' then r.state <> 'withdrawn' and (pending.content is not null or public.store_review_has_pending_photos(r.id))
      when 'published' then r.state = 'active' and r.approved_revision_id is not null
      when 'hidden' then r.state = 'hidden'
      when 'rejected' then latest.status = 'rejected' and r.state <> 'withdrawn'
      else true end
  order by r.created_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 21), 1), 51);
end;
$$;

notify pgrst, 'reload schema';
