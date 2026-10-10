-- M5-A · AI room-panorama generation on top of preview_jobs.
--
-- Run after 20261009000002_preview_jobs.sql (which creates preview_jobs and
-- generated_images). One preview_jobs row is one generation request; the
-- image itself goes to the private `generated-previews` bucket and
-- generated_images stores its bucket/path, never the bytes.
--
-- Status lifecycle (existing check constraint):
--   pending → processing → succeeded | failed
-- A job is claimed by moving it from pending to processing with a
-- conditional update, so a future worker can pick up pending rows without
-- double-processing them.
--
-- The selected tile is rendered by the viewer, not by the AI model; the tile
-- columns only record what the user had selected. Uploaded tiles never leave
-- the browser, so tile_design_id is set only for catalog tiles.
--
-- Safe to re-run.

alter table public.preview_jobs alter column tile_design_id drop not null;

alter table public.preview_jobs
  add column if not exists provider     text,
  add column if not exists model        text,
  -- Built on the server from the place and surface; never client text.
  add column if not exists prompt       text,
  -- Stable code from src/types/api.ts (GenerationErrorCode); error_message
  -- holds the matching client-safe text, never provider or stack details.
  add column if not exists error_code   text,
  add column if not exists started_at   timestamptz,
  add column if not exists completed_at timestamptz;

comment on table public.preview_jobs is
  'AI generation jobs (M5-A: room panoramas). status: pending → processing → succeeded | failed.';
comment on column public.preview_jobs.tile_design_id is
  'Catalog tile selected when the job was created; null for uploaded tiles (they stay in the browser).';
