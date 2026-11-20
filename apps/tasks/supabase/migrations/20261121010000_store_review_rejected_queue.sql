-- RMT-only. Rejected reviews were always kept (a rejection only marks the
-- revision), but staff could neither list them on their own nor change their
-- mind. This adds a rejected queue, a product filter, and a staff action that
-- publishes a rejected revision after all.

-- v4 adds the `rejected` filter and field, and an optional product filter.
-- `rejected` is the latest revision when staff rejected it and the buyer has
-- not written anything since; that is the only revision "Publish anyway" accepts.
-- v3 stays unchanged for deployments that still read it.
create or replace function public.store_review_moderation_page_v4(
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
      'displayName', v.display_name, 'submittedAt', public.store_review_staff_time(v.submitted_at)) content
    from public.store_review_revisions v where v.review_id = r.id and v.status = 'pending'
  ) pending on true
  left join lateral (
    select jsonb_build_object('id', v.id, 'rating', v.rating, 'title', v.title, 'body', v.body,
      'displayName', v.display_name, 'submittedAt', public.store_review_staff_time(v.submitted_at)) content
    from public.store_review_revisions v where v.id = r.approved_revision_id and v.review_id = r.id
  ) approved on true
  left join lateral (
    select v.status, jsonb_build_object('id', v.id, 'rating', v.rating, 'title', v.title, 'body', v.body,
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
    and (p_product_id is null or r.product_id = p_product_id)
    and (p_after_created_at is null or (r.created_at, r.id) > (p_after_created_at, p_after_id))
    and case p_filter
      when 'pending' then pending.content is not null and r.state <> 'withdrawn'
      when 'published' then r.state = 'active' and r.approved_revision_id is not null
      when 'hidden' then r.state = 'hidden'
      when 'rejected' then latest.status = 'rejected' and r.state <> 'withdrawn'
      else true end
  order by r.created_at, r.id
  limit least(greatest(coalesce(p_limit, 21), 1), 51);
end;
$$;

-- Every product with at least one review, for the staff product filter. The
-- title is the most recent review's purchase snapshot.
create or replace function public.store_review_moderation_products(p_actor uuid, p_shop_id text)
returns setof jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.store_require_review_owner(p_actor);
  return query
  select jsonb_build_object('productId', p.product_id, 'productTitle', p.product_title)
  from (
    select distinct on (r.product_id) r.product_id, r.product_title
    from public.store_reviews r where r.shop_id = p_shop_id
    order by r.product_id, r.created_at desc, r.id desc
  ) p
  order by lower(p.product_title), p.product_id
  limit 500;
end;
$$;

-- Same contract as before, plus `republish`: publish a rejected revision after
-- all. Only the latest revision qualifies, so staff never publish text the
-- buyer has since replaced. Like approval, it keeps a hidden review hidden.
create or replace function public.store_moderate_review(
  p_actor uuid, p_shop_id text, p_review_id uuid, p_expected_updated_at timestamptz,
  p_action text, p_revision_id uuid, p_note text
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_review public.store_reviews;
  v_revision public.store_review_revisions;
  v_now timestamptz;
begin
  perform public.store_require_review_owner(p_actor);
  if p_action is null or p_action not in ('approve', 'reject', 'hide', 'restore', 'republish')
    or (p_action in ('approve', 'reject', 'republish')) <> (p_revision_id is not null)
    or (p_note is not null and (p_note <> btrim(p_note) or char_length(p_note) not between 1 and 1000))
    or (p_action in ('reject', 'hide') and p_note is null) then
    raise exception 'Invalid moderation decision' using errcode = '22023';
  end if;
  select r.* into v_review from public.store_reviews r
  where r.id = p_review_id and r.shop_id = p_shop_id for update;
  if not found or v_review.state = 'withdrawn'
    or p_expected_updated_at is null or v_review.updated_at <> p_expected_updated_at then
    return false;
  end if;
  if p_action = 'republish' then
    select v.* into v_revision from public.store_review_revisions v
    where v.id = p_revision_id and v.review_id = v_review.id and v.status = 'rejected'
    for update;
    if not found then return false; end if;
    perform 1 from public.store_review_revisions w
    where w.review_id = v_review.id and w.id <> v_revision.id
      and (w.status = 'pending' or (w.submitted_at, w.id) > (v_revision.submitted_at, v_revision.id));
    if found then return false; end if;
    -- Millisecond precision, matching approval, so public dates stay exact page cursors.
    v_now := date_trunc('milliseconds', clock_timestamp());
    update public.store_review_revisions v set status = 'superseded'
    where v.review_id = v_review.id and v.status = 'approved';
    update public.store_review_revisions v set status = 'approved', decided_at = v_now, decided_by = p_actor::text
    where v.id = v_revision.id;
    update public.store_reviews r set approved_revision_id = v_revision.id,
      first_published_at = coalesce(r.first_published_at, v_now), updated_at = v_now
    where r.id = v_review.id;
    insert into public.store_review_events (review_id, revision_id, action, actor_kind, actor, note)
    values (v_review.id, v_revision.id, 'approved', 'staff', p_actor::text, p_note);
    return true;
  end if;
  if p_action in ('approve', 'reject') then
    perform 1 from public.store_review_revisions v
    where v.id = p_revision_id and v.review_id = v_review.id and v.status = 'pending';
    if not found then return false; end if;
    -- Approval of a hidden edit does not restore it to the storefront.
    if not public.store_decide_review_revision(p_revision_id, p_shop_id, p_action = 'approve', p_actor::text, p_note) then
      return false;
    end if;
    -- Rejection also advances the review's concurrency token.
    update public.store_reviews set updated_at = clock_timestamp() where id = v_review.id;
    return true;
  end if;
  return public.store_set_review_hidden(p_review_id, p_shop_id, p_action = 'hide', p_actor::text, p_note);
end;
$$;

revoke all on function
  public.store_review_moderation_page_v4(uuid,text,text,text,integer,timestamptz,uuid),
  public.store_review_moderation_products(uuid,text),
  public.store_moderate_review(uuid,text,uuid,timestamptz,text,uuid,text)
  from public, anon, authenticated;
grant execute on function
  public.store_review_moderation_page_v4(uuid,text,text,text,integer,timestamptz,uuid),
  public.store_review_moderation_products(uuid,text),
  public.store_moderate_review(uuid,text,uuid,timestamptz,text,uuid,text)
  to service_role;
notify pgrst, 'reload schema';
