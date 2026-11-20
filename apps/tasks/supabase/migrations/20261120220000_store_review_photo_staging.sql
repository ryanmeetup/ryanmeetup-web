-- RMT only: private, processed photo staging. No review association or public publication yet.
create table if not exists public.store_review_photo_drafts (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null check (shop_id ~ '^[1-9][0-9]{0,19}$'),
  customer_subject text not null check (length(customer_subject) between 1 and 512 and customer_subject !~ '[[:cntrl:]]'),
  product_id text not null check (product_id ~ '^[1-9][0-9]{0,19}$'),
  request_key uuid not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  byte_size integer not null check (byte_size between 1 and 4194304),
  width integer not null check (width between 1 and 2048),
  height integer not null check (height between 1 and 2048),
  state text not null default 'uploading' check (state in ('uploading', 'ready', 'discarded')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp() + interval '1 hour',
  unique (shop_id, customer_subject, product_id, request_key),
  check (expires_at > created_at)
);
create index if not exists store_review_photo_drafts_scope
  on public.store_review_photo_drafts (shop_id, customer_subject, product_id, expires_at)
  where state <> 'discarded';
create index if not exists store_review_photo_drafts_expiry on public.store_review_photo_drafts (expires_at);
alter table public.store_review_photo_drafts enable row level security;
revoke all on public.store_review_photo_drafts from public, anon, authenticated;
grant select, insert, update, delete on public.store_review_photo_drafts to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-review-photos', 'store-review-photos', false, 4194304, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- A restrictive exclusion also protects this bucket if another permissive policy is added later.
-- Every other bucket keeps its existing policy behavior. Service role bypasses RLS.
drop policy if exists store_review_photos_private on storage.objects;
create policy store_review_photos_private on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'store-review-photos') with check (bucket_id <> 'store-review-photos');

create or replace function public.store_review_photo_draft_json(p_photo public.store_review_photo_drafts)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('id', p_photo.id, 'productId', p_photo.product_id, 'sha256', p_photo.sha256,
    'byteSize', p_photo.byte_size, 'width', p_photo.width, 'height', p_photo.height,
    'state', p_photo.state, 'expiresAt', p_photo.expires_at);
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
    if v_photo.state = 'discarded' or v_photo.expires_at <= clock_timestamp() then
      return jsonb_build_object('outcome', 'closed', 'photo', null);
    end if;
    return jsonb_build_object('outcome', 'exists', 'photo', public.store_review_photo_draft_json(v_photo));
  end if;
  if (select count(*) from public.store_review_photo_drafts where shop_id = p_shop_id and customer_subject = p_subject
    and product_id = p_product_id and state <> 'discarded' and expires_at > clock_timestamp()) >= 5 then
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
    and p.state <> 'discarded' and p.expires_at > clock_timestamp();
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
  where id = p_id and shop_id = p_shop_id and customer_subject = p_subject and product_id = p_product_id and state <> 'discarded';
  if found then return true; end if;
  return exists (select 1 from public.store_review_photo_drafts where id = p_id and shop_id = p_shop_id
    and customer_subject = p_subject and product_id = p_product_id and state = 'discarded');
end;
$$;

revoke all on function public.store_review_photo_draft_json(public.store_review_photo_drafts),
  public.store_begin_review_photo(text,text,text,uuid,text,integer,integer,integer),
  public.store_get_review_photo(uuid,text,text,text), public.store_finish_review_photo(uuid,text,text,text,text),
  public.store_discard_review_photo(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.store_review_photo_draft_json(public.store_review_photo_drafts),
  public.store_begin_review_photo(text,text,text,uuid,text,integer,integer,integer),
  public.store_get_review_photo(uuid,text,text,text), public.store_finish_review_photo(uuid,text,text,text,text),
  public.store_discard_review_photo(uuid,text,text,text) to service_role;
