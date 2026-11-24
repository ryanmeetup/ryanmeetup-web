-- The staff queue pages by cursor, so it cannot tell how many reviews a queue
-- holds. This counts them with the same filter as store_review_moderation_page_v5;
-- keep the two predicates in step.
create or replace function public.store_review_moderation_count(
  p_actor uuid, p_shop_id text, p_filter text, p_product_id text
) returns bigint
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.store_require_review_owner(p_actor);
  if p_filter is null or p_filter not in ('pending', 'published', 'hidden', 'rejected', 'all')
    or (p_product_id is not null and p_product_id !~ '^[1-9][0-9]{0,19}$') then
    raise exception 'Invalid moderation count' using errcode = '22023';
  end if;
  return (
    select count(*) from public.store_reviews r
    left join lateral (
      select v.status from public.store_review_revisions v where v.review_id = r.id
      order by v.submitted_at desc, v.id desc limit 1
    ) latest on true
    where r.shop_id = p_shop_id
      and (p_product_id is null or r.product_id = p_product_id)
      and case p_filter
        when 'pending' then r.state <> 'withdrawn' and (
          exists(select 1 from public.store_review_revisions v where v.review_id = r.id and v.status = 'pending')
          or public.store_review_has_pending_photos(r.id))
        when 'published' then r.state = 'active' and r.approved_revision_id is not null
        when 'hidden' then r.state = 'hidden'
        when 'rejected' then latest.status = 'rejected' and r.state <> 'withdrawn'
        else true end
  );
end;
$$;

revoke all on function public.store_review_moderation_count(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.store_review_moderation_count(uuid,text,text,text) to service_role;

notify pgrst, 'reload schema';
