-- RMT only. Private buyer references/previews; no publication or browser storage capability.
-- Match store_buyer_reviews: pending, else approved, else latest buyer attempt by audit event.
create or replace function public.store_buyer_review_photo_selection(p_review_id uuid, p_shop_id text, p_subject text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('reviewId', r.id, 'productId', r.product_id,
    'updatedAt', public.store_review_staff_time(r.updated_at), 'photos', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'width', p.width, 'height', p.height) order by link.position)
      from public.store_review_revision_photos link
      join public.store_review_photo_drafts p on p.id = link.photo_id
      join public.store_review_revisions v on v.id = link.revision_id and v.review_id = r.id
      where link.revision_id = coalesce(
        (select id from public.store_review_revisions where review_id = r.id and status = 'pending'),
        r.approved_revision_id,
        (select e.revision_id from public.store_review_events e
          where e.review_id = r.id and e.action in ('submitted', 'resubmitted', 'edited')
          order by e.id desc limit 1))
        and p.state = 'attached' and p.attached_review_id = r.id
        and p.shop_id = r.shop_id and p.customer_subject = r.customer_subject and p.product_id = r.product_id
    ), '[]'::jsonb))
  from public.store_reviews r
  where r.id = p_review_id and r.shop_id = p_shop_id and r.customer_subject = p_subject;
$$;

create or replace function public.store_get_review_photo_preview(p_id uuid, p_shop_id text, p_subject text, p_product_id text)
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'productId', p.product_id, 'sha256', p.sha256,
    'byteSize', p.byte_size, 'width', p.width, 'height', p.height)
  from public.store_review_photo_drafts p
  where p.id = p_id and p.shop_id = p_shop_id and p.customer_subject = p_subject and p.product_id = p_product_id
    and ((p.state = 'ready' and p.expires_at > clock_timestamp())
      or (p.state = 'attached' and exists (
        select 1 from jsonb_array_elements(public.store_buyer_review_photo_selection(p.attached_review_id, p_shop_id, p_subject)->'photos') photo
        where photo->>'id' = p.id::text)));
$$;

revoke all on function public.store_buyer_review_photo_selection(uuid,text,text),
  public.store_get_review_photo_preview(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.store_buyer_review_photo_selection(uuid,text,text),
  public.store_get_review_photo_preview(uuid,text,text,text) to service_role;
