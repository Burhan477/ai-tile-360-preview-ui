This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database (Supabase)

The app's backend runs in Next.js Route Handlers (`src/app/api/`) and talks to
Supabase PostgreSQL from server code (`src/lib/server/supabase.ts`) using the
publishable key. Row Level Security limits that key to reading the active
catalog; it cannot write anything.

### 1. Create the schema

In the Supabase Dashboard → SQL Editor, run the files in
`supabase/migrations/` in name order:

| File | Creates | When |
| --- | --- | --- |
| `20261009000001_catalog.sql` | `room_types`, `tile_designs` (+ seed data) | Now (M4-A) |
| `20261009000002_preview_jobs.sql` | `preview_jobs`, `generated_images` | When AI previews start (M4-B) |
| `20261009000004_generation_jobs.sql` | Generation columns on `preview_jobs` | With AI generation (M5-A), after `…0002` |

All are safe to re-run. With the Supabase CLI, `supabase link` followed by
`supabase db push` applies them instead.

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Where to find it | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → Data API → Project URL | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → Publishable key (`sb_publishable_…`) | Public; read-only via RLS |

Both are safe to expose. Never put the secret or `service_role` key in a
`NEXT_PUBLIC_` variable; the app refuses to start a query if a secret key is
found there.

### 3. Check the connection

Every API route returns `{"ok":true,"data":…}` or
`{"ok":false,"error":{"code":"…","message":"…"}}` (types in `src/types/api.ts`).
Responses never include env values, keys or raw database errors; details go
to the server log.

With `npm run dev` running:

```bash
curl -i http://localhost:3000/api/health            # config only, no DB call
curl -i http://localhost:3000/api/health/database   # one read-only query
```

`/api/health/db` is kept as an alias of `/api/health/database`.

| Result | Meaning |
| --- | --- |
| 200, `"roomTypes":6` | Connected and the catalog migration is applied. |
| 500 `CONFIG_INVALID` | A variable is unset or malformed; the message names it, never its value. |
| 503 `DATABASE_SCHEMA_MISSING` | Connected, but the catalog migration has not been run (or run `notify pgrst, 'reload schema';` after running it). |
| 503 `DATABASE_PERMISSION_DENIED` | The migration predates the read policies; re-run `20261009000001_catalog.sql`. |
| 503 `DATABASE_AUTH_FAILED` | The publishable key is wrong or revoked. |
| 503 `DATABASE_UNREACHABLE` / `DATABASE_UNEXPECTED_RESPONSE` | Wrong project URL, or Supabase is down/paused. |

## Image storage (Supabase Storage)

Image bytes live in Supabase Storage, never in PostgreSQL; store the
`bucket` + `path` that the API returns, not URLs (signed URLs expire).

| Bucket | Public | Contents | Written by |
| --- | --- | --- | --- |
| `tile-images` | yes | Curated tile catalog | Admin (Dashboard upload) |
| `tile-uploads` | no | Tile images users upload | `POST /api/uploads` (`kind=tile`) |
| `room-images` | no | Room photos users upload | `POST /api/uploads` (`kind=room`) |
| `generated-previews` | no | AI room previews | Server code (later milestone) |

### Setup

1. Run `supabase/migrations/20261009000003_storage.sql` in the SQL Editor
   (safe to re-run). It creates the buckets with a 10 MiB per-object limit and
   JPEG/PNG/WebP only, and adds **no** `storage.objects` policies: the
   publishable key cannot list, read, write or delete objects; public-bucket
   objects are readable by URL only.
2. Add `SUPABASE_SECRET_KEY` (Project Settings → API Keys → Secret key) to
   `.env.local`, and in Vercel for each environment. It is server-only; never
   give it a `NEXT_PUBLIC_` prefix.
3. Check: `curl -i http://localhost:3000/api/health/storage` →
   `{"ok":true,"data":{"status":"ok","buckets":{…all "ok"}}}`.

Optional variables: `UPLOAD_MAX_BYTES` (default 4 MiB) and
`SIGNED_URL_TTL_SECONDS` (default 3600); see `.env.example`.

### `POST /api/uploads`

`multipart/form-data` with `kind` (`room` or `tile`) and one `file`. The type
is detected from the file's bytes (JPEG, PNG, WebP; not SVG); the client's
filename and declared type are ignored, and the object path is generated
(`YYYY/MM/<uuid>.<ext>`). Uploads never overwrite.

```bash
curl -i -F kind=room -F file=@photo.jpg http://localhost:3000/api/uploads
```

```json
201 {"ok":true,"data":{"bucket":"room-images","path":"2026/10/1b0c…e2.jpg","visibility":"private",
     "contentType":"image/jpeg","size":245112,"url":"https://…/object/sign/room-images/…?token=…",
     "expiresAt":"2026-10-09T11:00:00.000Z"}}
```

| Status | Code | When |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Bad `kind`, no/multiple files, empty file, malformed body |
| 411 | `LENGTH_REQUIRED` | No `Content-Length` header |
| 413 | `PAYLOAD_TOO_LARGE` | Larger than `UPLOAD_MAX_BYTES` (checked before the body is read) |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Not multipart, or the bytes are not JPEG/PNG/WebP |
| 500 | `CONFIG_INVALID` | `SUPABASE_SECRET_KEY` missing or malformed |
| 503 | `STORAGE_NOT_CONFIGURED` / `STORAGE_UNAVAILABLE` | Bucket missing, key rejected, Storage down |

### `GET /api/images?bucket=…&path=…`

Returns a URL for one object: the permanent public URL for `tile-images`,
otherwise a signed URL valid for `SIGNED_URL_TTL_SECONDS`. 404 `NOT_FOUND` if
a private object does not exist; 400 for an unknown bucket or a path outside
`segment/segment/name.(jpg|jpeg|png|webp)`.

```bash
curl -s "http://localhost:3000/api/images?bucket=room-images&path=2026/10/1b0c…e2.jpg"
```

### Limits and remaining risks (POC, no auth)

- **Vercel body limit:** Route Handler request bodies over 4.5 MB are
  rejected by Vercel before the app runs, so keep `UPLOAD_MAX_BYTES` below
  that (the client currently allows 10 MB tile images). Larger files need
  direct-to-Storage uploads with `createSignedUploadUrl` (not built).
- **Anonymous uploads:** anyone who finds the endpoint can upload images up to
  the limit. They are never public (private buckets, unguessable paths), but
  there is no rate limit or quota, so storage use can grow. Mitigations for
  later: auth, a rate limit (e.g. Vercel Firewall), and a cleanup job deleting
  old `tile-uploads`/`room-images` objects.
- **No auth on retrieval:** anyone holding an object path can get a signed
  URL for it; the random path is the access token.
- Validation checks the file signature, not a full decode, so a file with a
  valid header but corrupt data is accepted (browsers will just fail to show it).

## Frontend integration (M4-D)

- **Tile catalog:** `/` and `/viewer` read active `tile_designs` rows on the
  server (`src/lib/server/catalog.ts`, publishable key + RLS). `image_url`
  must be a `public/` path (`/tiles/x.jpg`) or a public `tile-images` URL of
  this project (allowed in `next.config.ts` `images.remotePatterns`); other
  rows are skipped and logged. On failure the sample chips show an error with
  Retry; uploading your own tile still works.
- **Rooms:** active `room_types` rows whose id has an icon and panorama in
  `src/constants/places.ts`. If the query fails, the built-in list is shown
  with a notice.
- **Room photo (optional):** uploaded with `POST /api/uploads` (`kind=room`);
  the bucket/path is kept in client state (`TileDraftProvider`) for the AI
  step. No table stores it yet, and the photo is **not** shown in the 360°
  viewer, which needs an equirectangular panorama with masks.
- **Viewer:** every room still uses the generated placeholder panorama
  (`src/constants/panoramas.ts`).

## AI generation (M5-A)

Generates a photorealistic **wide-angle room photo** for the selected place
with a Gemini image model (`@google/genai`, `models.generateContent`), stores it
in the private `generated-previews` bucket and can open it in the viewer.

It is **not a 360° panorama.** Gemini image models output at most 21:9 and do
not produce an equirectangular projection, so when the photo is wrapped on the
viewer sphere there is a visible left/right seam and stretching at the top and
bottom. The UI and viewer title say so.

### Setup

1. Run `supabase/migrations/20261009000002_preview_jobs.sql`, then
   `20261009000004_generation_jobs.sql`, in the SQL Editor.
2. Add `GEMINI_API_KEY` and `GEMINI_IMAGE_MODEL` (both required, server-only)
   to `.env.local` and to Vercel. Pick a model from
   [the image-generation docs](https://ai.google.dev/gemini-api/docs/image-generation);
   there is no default because image model ids are retired often. The key's
   project needs billing: image models have no free tier. Optional:
   `GEMINI_IMAGE_ASPECT_RATIO` (`21:9` default, or `16:9`), `GEMINI_IMAGE_SIZE`
   (`1K`/`2K`/`4K`; unset = model default, and older models reject it),
   `GENERATION_MAX_ACTIVE` (2), `GENERATION_DAILY_LIMIT` (25). See `.env.example`.

### How a job runs

`POST /api/generations` validates the request, checks the spend limits,
inserts a `preview_jobs` row (`pending`) and answers **202** at once. The same
function then runs the job after the response (`after()` in
`src/app/api/generations/route.ts`):

```
pending ──claim (conditional update)──▶ processing ──▶ succeeded  (+ generated_images row, object in generated-previews)
                                                   └──▶ failed     (error_code + safe error_message)
```

The client polls `GET /api/generations/[id]` every 4 s. Jobs still pending or
processing 6 minutes after creation are marked `failed` / `TIMED_OUT` (the
function was stopped before it could finish).

The prompt is built on the server from the place and surface only
(`buildRoomPrompt` in `src/lib/server/generation.ts`); clients cannot send
prompt text or storage paths.

### API

`POST /api/generations`

```json
{"placeId":"living-room","surface":"floor","tile":{"catalogId":"petra-crema","width":600,"height":1200}}
```

```json
202 {"ok":true,"data":{"id":"5b0e…","status":"pending","placeId":"living-room","surface":"floor",
     "tile":{"catalogId":"petra-crema","width":600,"height":1200},"model":"gemini-3.1-flash-image",
     "error":null,"result":null,"createdAt":"…","updatedAt":"…","startedAt":null,"completedAt":null}}
```

`GET /api/generations/5b0e…` once finished:

```json
200 {"ok":true,"data":{"id":"5b0e…","status":"succeeded", …,
     "result":{"bucket":"generated-previews","path":"2026/10/….jpg","visibility":"private",
               "contentType":"image/jpeg","width":2048,"height":1024,"size":812345,
               "url":"https://…/object/sign/generated-previews/…","expiresAt":"…"}}}
```

or, when it failed, `"status":"failed","error":{"code":"PROVIDER_RATE_LIMITED","message":"The image service is busy. …"}`.
`width`/`height` are read from the stored file's header, not from the request.

| Status | Code | When |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Unknown place/surface, bad tile id or size, malformed JSON, non-UUID id |
| 404 | `NOT_FOUND` | No job with that id |
| 413 / 415 | `PAYLOAD_TOO_LARGE` / `UNSUPPORTED_MEDIA_TYPE` | Body over 4 KB / not JSON |
| 429 | `RATE_LIMITED` | `GENERATION_MAX_ACTIVE` jobs running, or `GENERATION_DAILY_LIMIT` reached |
| 500 | `CONFIG_INVALID` | `GEMINI_API_KEY` or `GEMINI_IMAGE_MODEL` missing (checked before any row is written) or another variable invalid |
| 503 | `DATABASE_SCHEMA_MISSING` | Migrations `…0002`/`…0004` not applied |

Job `error.code` values (`GenerationErrorCode` in `src/types/api.ts`):
`PROVIDER_AUTH_FAILED`, `PROVIDER_MODEL_UNAVAILABLE` (model not enabled for the
account), `PROVIDER_QUOTA_EXCEEDED`, `PROVIDER_RATE_LIMITED`,
`PROVIDER_REJECTED` (incl. safety blocks), `PROVIDER_TIMEOUT` (180 s),
`PROVIDER_UNAVAILABLE`, `PROVIDER_INVALID_RESPONSE`, `STORAGE_FAILED`,
`TIMED_OUT`, `INTERNAL_ERROR`. Provider messages and request ids go to the
server log only.

### Tiles stay separate from the room

The AI model never draws the selected tile: the prompt asks for a plain,
neutral floor (and walls, for wall/both). The viewer draws the real tile image
as its own shader layer, but only where a panorama has a floor/wall **mask and
room geometry** (`src/constants/panoramas.ts`). Generated rooms have neither
yet, so `/viewer?…&generation=<id>` shows the AI room **without** the tile, and
the viewer says the room isn't prepared for tile preview. A misplaced or
wrongly scaled tile would be worse than none.

Smallest next step to tile generated rooms: produce a floor mask per generated
image (a segmentation model, or Gemini image editing asked for a black/white
floor mask) and estimate `cameraHeight` / `gridRotation`; the prompt already
asks for a 1.6 m camera with a level horizon. Then pass `floor` with the
generated `src`, and switching tiles stays a texture swap, no regeneration.

### Limits (POC)

- Not a 360° panorama (see above). Turning a generated room into a real
  equirectangular panorama needs a different model or a stitching/outpainting
  step; that is out of scope for M5-A.
- `after()` runs inside the POST's function and is bounded by `maxDuration`
  (300 s; the Vercel Hobby limit with Fluid compute). The provider call times
  out after 180 s. If the function is stopped, the job ends as `TIMED_OUT`;
  nothing retries it, and the SDK makes no retries either.
- The limits are global (no auth), and two simultaneous requests can both
  pass the active-job check.
- `PROVIDER_QUOTA_EXCEEDED` vs `PROVIDER_RATE_LIMITED` is inferred from
  Google's 429 details (per-day quota or a limit of 0 → quota). Every request
  is billed per output image by Google; check AI Studio usage after the first runs.
- Gemini returns PNG (or JPEG); the stored type and size are read from the
  bytes. 4K PNGs can exceed the 10 MiB bucket limit and fail as `STORAGE_FAILED`.

### Next: asynchronous worker

The job contract is already worker-shaped. To move off `after()`:
1. Replace `after(() => processGenerationJob(id))` with an enqueue (or nothing,
   if the worker polls `preview_jobs where status = 'pending' order by created_at`).
2. Run `processGenerationJob` in a long-running worker; its conditional
   `pending → processing` claim already prevents double processing.
3. Add `attempts` / `next_attempt_at` columns for retries with backoff on
   `PROVIDER_RATE_LIMITED`, `PROVIDER_UNAVAILABLE` and `PROVIDER_TIMEOUT`, and a
   heartbeat instead of the fixed 6-minute stale cutoff.
4. Keep `POST` returning 202 and `GET` unchanged, so the frontend needs no change.

### Vercel

In Vercel → Project → Settings → Environment Variables, add
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for
Production, Preview and Development, then redeploy (`NEXT_PUBLIC_` values are
read at build time). Use Node.js 22 or later (Settings → Build and
Deployment), which `@supabase/supabase-js` requires. For AI generation also add
`SUPABASE_SECRET_KEY`, `GEMINI_API_KEY` and `GEMINI_IMAGE_MODEL` (never with a
`NEXT_PUBLIC_` prefix).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
