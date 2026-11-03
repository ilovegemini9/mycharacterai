-- CharacterPlay community image storage setup
-- Run once in Supabase SQL Editor after deploying the image-upload feature.
-- Public reads are intentional so approved profile and character images can render without a login.
-- Upload, replacement, and deletion remain restricted to each user's own folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-images',
  'community-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Community image owners can upload" on storage.objects;
create policy "Community image owners can upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'community-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Community image owners can update" on storage.objects;
create policy "Community image owners can update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'community-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'community-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Community image owners can delete" on storage.objects;
create policy "Community image owners can delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'community-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
