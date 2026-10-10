-- M4-C · Supabase Storage buckets for tile, room and generated images.
--
-- Image bytes live here, never in PostgreSQL: tables hold the bucket + object
-- path only (e.g. generated_images.storage_bucket/storage_path).
--
-- | Bucket             | Public | Written by                                   |
-- | ------------------ | ------ | -------------------------------------------- |
-- | tile-images        | yes    | Admin (Dashboard / secret key): catalog only |
-- | tile-uploads       | no     | POST /api/uploads (kind=tile)                |
-- | room-images        | no     | POST /api/uploads (kind=room)                |
-- | generated-previews | no     | Server-side AI generation (later milestone)  |
--
-- Access model (no auth in the POC): no storage.objects policies are created,
-- so with RLS on, the anon/publishable key can neither list, read, write nor
-- delete objects through the API. The app reads and writes with the secret
-- key from Route Handlers only, and hands out signed URLs for private
-- objects. Public-bucket objects are readable by URL without a policy.
-- Do not add anon policies on storage.objects, and do not disable RLS.
--
-- Limits are enforced by Storage itself, on top of the app's own checks:
-- 10 MiB per object (BUCKET_FILE_SIZE_LIMIT_BYTES in src/lib/server/env.ts)
-- and JPEG/PNG/WebP only. SVG is excluded on purpose (it can carry scripts).
--
-- Safe to re-run: buckets upsert, so re-running also resets their settings.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('tile-images',        'tile-images',        true,  10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('tile-uploads',       'tile-uploads',       false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('room-images',        'room-images',        false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('generated-previews', 'generated-previews', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
