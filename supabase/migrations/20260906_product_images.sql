-- Public product images with authenticated, tenant-scoped write access.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists smarterp_product_images_insert on storage.objects;
drop policy if exists smarterp_product_images_update on storage.objects;
drop policy if exists smarterp_product_images_delete on storage.objects;

create policy smarterp_product_images_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.business_members bm
    where bm.user_id = auth.uid()
      and bm.active = true
      and bm.business_id::text = (storage.foldername(name))[1]
      and lower(bm.role::text) in ('owner', 'admin', 'manager', 'warehouse', 'purchasing')
  )
);

create policy smarterp_product_images_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.business_members bm
    where bm.user_id = auth.uid()
      and bm.active = true
      and bm.business_id::text = (storage.foldername(name))[1]
      and lower(bm.role::text) in ('owner', 'admin', 'manager', 'warehouse', 'purchasing')
  )
)
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.business_members bm
    where bm.user_id = auth.uid()
      and bm.active = true
      and bm.business_id::text = (storage.foldername(name))[1]
      and lower(bm.role::text) in ('owner', 'admin', 'manager', 'warehouse', 'purchasing')
  )
);

create policy smarterp_product_images_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.business_members bm
    where bm.user_id = auth.uid()
      and bm.active = true
      and bm.business_id::text = (storage.foldername(name))[1]
      and lower(bm.role::text) in ('owner', 'admin', 'manager', 'warehouse', 'purchasing')
  )
);
