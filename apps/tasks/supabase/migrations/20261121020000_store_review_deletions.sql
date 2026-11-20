-- RMT-only. Staff can permanently delete a review that breaks the review
-- policy: spam, fake, abusive, confidential, or unrelated content. Deletion is
-- for those reasons only, never for a low rating or a negative opinion; the
-- FTC's consumer review rule (16 CFR 465.7) forbids suppressing reviews on
-- that basis. Every deletion leaves an append-only audit row that records the
-- reason and the rating, but none of the review's text or the buyer identity,
-- so staff can show the policy was applied the same way whatever the rating.

create table if not exists public.store_review_deletions (
  id bigint generated always as identity primary key,
  shop_id text not null check (shop_id ~ '^[1-9][0-9]{0,19}$'),
  review_id uuid not null unique,
  product_id text not null check (product_id ~ '^[1-9][0-9]{0,19}$'),
  product_title text not null check (char_length(product_title) between 1 and 255),
  -- Rating of the latest revision, so deletions can be compared against the rating mix.
  rating smallint not null check (rating between 1 and 5),
  -- Whether the review was on the storefront when it was deleted.
  was_published boolean not null,
  verified_purchase boolean not null,
  reason text not null check (reason in ('spam', 'false_or_misleading', 'unrelated', 'confidential', 'abusive', 'discriminatory')),
  note text check (note is null or (char_length(note) between 1 and 1000 and note = btrim(note))),
  photo_count smallint not null check (photo_count between 0 and 100),
  review_created_at timestamptz not null,
  deleted_by text not null check (length(deleted_by) between 1 and 200),
  deleted_at timestamptz not null default clock_timestamp()
);
create index if not exists store_review_deletions_recent
  on public.store_review_deletions (shop_id, deleted_at desc);

alter table public.store_review_deletions enable row level security;
revoke all on public.store_review_deletions from public, anon, authenticated, service_role;
-- Append-only: the backend may record and read deletions, never rewrite them.
grant select, insert on public.store_review_deletions to service_role;

-- Deletes the review, its revisions, events, reply, and photo associations in
-- one transaction, and records the audit row. Returns the deleted photo IDs so
-- the caller can remove their private storage objects (`<shop>/<id>.webp`)
-- after this commits; storage objects cannot be removed from SQL. Returns null
-- when the review is gone or changed since staff read it.
create or replace function public.store_delete_review(
  p_actor uuid, p_shop_id text, p_review_id uuid, p_expected_updated_at timestamptz,
  p_reason text, p_note text
) returns uuid[]
language plpgsql security invoker set search_path = '' as $$
declare
  v_review public.store_reviews;
  v_rating smallint;
  v_photos uuid[];
begin
  perform public.store_require_review_owner(p_actor);
  if p_reason is null or p_reason not in ('spam', 'false_or_misleading', 'unrelated', 'confidential', 'abusive', 'discriminatory')
    or (p_note is not null and (p_note <> btrim(p_note) or char_length(p_note) not between 1 and 1000)) then
    raise exception 'Invalid review deletion' using errcode = '22023';
  end if;
  select r.* into v_review from public.store_reviews r
  where r.id = p_review_id and r.shop_id = p_shop_id for update;
  if not found or p_expected_updated_at is null or v_review.updated_at <> p_expected_updated_at then
    return null;
  end if;
  -- The same lock photo attachment takes, so an upload cannot attach mid-delete.
  perform pg_advisory_xact_lock(hashtextextended(
    jsonb_build_array(p_shop_id, v_review.customer_subject, v_review.product_id)::text, 0));

  select v.rating into v_rating from public.store_review_revisions v
  where v.review_id = v_review.id order by v.submitted_at desc, v.id desc limit 1;
  if v_rating is null then
    raise exception 'Review has no revisions' using errcode = 'P0002';
  end if;

  delete from public.store_review_revision_photos rp
  using public.store_review_revisions v
  where rp.revision_id = v.id and v.review_id = v_review.id;
  with removed as (
    delete from public.store_review_photo_drafts d
    where d.shop_id = p_shop_id and d.attached_review_id = v_review.id
    returning d.id
  )
  select coalesce(array_agg(removed.id order by removed.id), '{}') into v_photos from removed;

  insert into public.store_review_deletions (shop_id, review_id, product_id, product_title, rating,
    was_published, verified_purchase, reason, note, photo_count, review_created_at, deleted_by)
  values (p_shop_id, v_review.id, v_review.product_id, v_review.product_title, v_rating,
    v_review.state = 'active' and v_review.approved_revision_id is not null, v_review.order_id is not null,
    p_reason, p_note, cardinality(v_photos), v_review.created_at, p_actor::text);

  -- Revisions, events, and the reply cascade with the review.
  delete from public.store_reviews r where r.id = v_review.id;
  return v_photos;
end;
$$;

revoke all on function public.store_delete_review(uuid,text,uuid,timestamptz,text,text)
  from public, anon, authenticated;
grant execute on function public.store_delete_review(uuid,text,uuid,timestamptz,text,text)
  to service_role;
notify pgrst, 'reload schema';
