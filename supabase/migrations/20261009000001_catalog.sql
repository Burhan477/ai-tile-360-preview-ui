-- M4-A · Catalog tables: room types and tile designs.
--
-- Mirrors the static catalog the frontend ships today
-- (`src/constants/places.ts`, `src/constants/tiles.ts`) so later milestones
-- can read it from the database. Image files stay out of PostgreSQL: rows hold
-- a URL/path only.
--
-- Access model (no auth in the POC): the app uses the publishable key, which
-- runs as the `anon` role. The catalog is public data, so anon may SELECT
-- active rows and nothing else; writes need the secret key (service_role).
--
-- Safe to re-run: tables use IF NOT EXISTS, policies are recreated, seeds upsert.

create table if not exists public.room_types (
  id          text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null check (char_length(name) between 1 and 60),
  description text not null default '',
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.room_types is
  'Rooms a tile can be previewed in. id matches PlaceId in src/types/tile.ts; icons and panorama mappings stay in frontend code.';

create table if not exists public.tile_designs (
  id              text primary key default gen_random_uuid()::text
                  check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name            text not null check (char_length(name) between 1 and 60),
  image_url       text not null,
  width_mm        numeric(6, 1) not null check (width_mm > 0 and width_mm <= 5000),
  height_mm       numeric(6, 1) not null check (height_mm > 0 and height_mm <= 5000),
  pixel_width     integer check (pixel_width > 0),
  pixel_height    integer check (pixel_height > 0),
  file_size_bytes integer check (file_size_bytes > 0),
  sort_order      integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

comment on table public.tile_designs is
  'Tile catalog. Matches SAMPLE_TILES in src/constants/tiles.ts; width_mm/height_mm are the suggested lay size.';
comment on column public.tile_designs.image_url is
  'App-relative path under /public (e.g. /tiles/petra-crema.jpg) or an absolute Storage URL. Never image bytes.';

alter table public.room_types   enable row level security;
alter table public.tile_designs enable row level security;

revoke all on table public.room_types, public.tile_designs from anon, authenticated;
grant select on table public.room_types, public.tile_designs to anon, authenticated;
grant select, insert, update, delete on table public.room_types, public.tile_designs to service_role;

drop policy if exists "Active room types are public" on public.room_types;
create policy "Active room types are public" on public.room_types
  for select to anon, authenticated using (is_active);

drop policy if exists "Active tile designs are public" on public.tile_designs;
create policy "Active tile designs are public" on public.tile_designs
  for select to anon, authenticated using (is_active);

insert into public.room_types (id, name, description, sort_order) values
  ('hall',        'Hall',        'Entrance & passage', 10),
  ('living-room', 'Living Room', 'Open lounge space',  20),
  ('bedroom',     'Bedroom',     'Calm & private',     30),
  ('bathroom',    'Bathroom',    'Wet-area finish',    40),
  ('kitchen',     'Kitchen',     'High-traffic floor', 50),
  ('dining-room', 'Dining Room', 'Gathering space',    60)
on conflict (id) do update set
  name        = excluded.name,
  description = excluded.description,
  sort_order  = excluded.sort_order;

insert into public.tile_designs
  (id, name, image_url, width_mm, height_mm, pixel_width, pixel_height, file_size_bytes, sort_order)
values
  ('petra-crema',  'Petra Crema',  '/tiles/petra-crema.jpg',  600, 1200, 1000, 1000, 386264, 10),
  ('petra-camel',  'Petra Camel',  '/tiles/petra-camel.jpg',  600,  600,  447,  447,  21304, 20),
  ('petra-bianco', 'Petra Bianco', '/tiles/petra-bianco.jpg', 600, 1200,  554,  554,  16459, 30),
  ('stone-grey',   'Stone Grey',   '/tiles/stone-grey.svg',   600,  600,  600,  600,    814, 40)
on conflict (id) do update set
  name            = excluded.name,
  image_url       = excluded.image_url,
  width_mm        = excluded.width_mm,
  height_mm       = excluded.height_mm,
  pixel_width     = excluded.pixel_width,
  pixel_height    = excluded.pixel_height,
  file_size_bytes = excluded.file_size_bytes,
  sort_order      = excluded.sort_order;
