-- CharacterPlay community image storage setup.
-- Run once in Supabase SQL Editor after configuring the server environment variables.
-- The bucket is public for approved image display. Client-side writes are intentionally
-- NOT allowed: uploads must go through /api/moderate-image, which verifies the session,
-- checks the image, and writes with the server-only service role key.

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

-- Do not add authenticated INSERT/UPDATE/DELETE policies for this bucket.
-- The service role key is used only by the server API and must never be exposed to browsers.
