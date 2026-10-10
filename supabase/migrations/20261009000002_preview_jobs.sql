-- M4-A (proposed for M4-B) · AI preview jobs and generated image metadata.
--
-- Nothing writes to these tables yet. Apply this file when M4-B starts
-- wiring room-preview generation; it depends on 20261009000001_catalog.sql.
-- AI provider, model and prompt columns are deliberately left for M4-B to add
-- once the provider is chosen.
--
-- Generated images live in Supabase Storage; generated_images stores only the
-- bucket/path and basic metadata.
--
-- Safe to re-run.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.preview_jobs (
  id             uuid primary key default gen_random_uuid(),
  tile_design_id text not null references public.tile_designs (id) on delete restrict,
  room_type_id   text not null references public.room_types (id) on delete restrict,
  surface        text not null check (surface in ('floor', 'wall', 'both')),
  -- Size the user previewed with; may differ from the catalog's suggested size.
  tile_width_mm  numeric(6, 1) not null check (tile_width_mm > 0 and tile_width_mm <= 5000),
  tile_height_mm numeric(6, 1) not null check (tile_height_mm > 0 and tile_height_mm <= 5000),
  status         text not null default 'pending'
                 check (status in ('pending', 'processing', 'succeeded', 'failed')),
  error_message  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists preview_jobs_status_created_at_idx
  on public.preview_jobs (status, created_at);
create index if not exists preview_jobs_tile_design_id_idx on public.preview_jobs (tile_design_id);
create index if not exists preview_jobs_room_type_id_idx   on public.preview_jobs (room_type_id);

drop trigger if exists preview_jobs_set_updated_at on public.preview_jobs;
create trigger preview_jobs_set_updated_at
  before update on public.preview_jobs
  for each row execute function public.set_updated_at();

create table if not exists public.generated_images (
  id             uuid primary key default gen_random_uuid(),
  preview_job_id uuid not null references public.preview_jobs (id) on delete cascade,
  storage_bucket text not null,
  storage_path   text not null,
  mime_type      text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  pixel_width    integer check (pixel_width > 0),
  pixel_height   integer check (pixel_height > 0),
  byte_size      integer check (byte_size > 0),
  created_at     timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists generated_images_preview_job_id_idx
  on public.generated_images (preview_job_id);

alter table public.preview_jobs     enable row level security;
alter table public.generated_images enable row level security;

revoke all on table public.preview_jobs, public.generated_images from anon, authenticated;
grant select, insert, update, delete on table public.preview_jobs, public.generated_images to service_role;
