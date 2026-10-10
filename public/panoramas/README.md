# Panoramas

360° room images used by the viewer (`/viewer`).

## Current state: placeholder only

`placeholder-room.png` is a **generated placeholder**, not a photograph. It is a
simple ray-cast box room (tiled floor, window, door) produced by
`scripts/generate-placeholder-panorama.mjs`, so the viewer works end-to-end
without third-party images. Regenerate it with:

```bash
node scripts/generate-placeholder-panorama.mjs
```

The same script writes its floor mask, `public/masks/placeholder-room-floor.png`,
and its wall mask, `public/masks/living-room-wall.png`.

All places currently point to it via `src/constants/panoramas.ts`.

## Required assets (to be provided)

One real panorama per place:

| Place       | Suggested file        |
| ----------- | --------------------- |
| Hall        | `hall.jpg`            |
| Living Room | `living-room.jpg`     |
| Bedroom     | `bedroom.jpg`         |
| Bathroom    | `bathroom.jpg`        |
| Kitchen     | `kitchen.jpg`         |
| Dining Room | `dining-room.jpg`     |

Requirements:

- **Projection:** equirectangular, exactly **2:1** aspect ratio.
- **Resolution:** 4096 × 2048 recommended (minimum 2048 × 1024; avoid > 8192 wide for mobile GPUs).
- **Format:** JPEG (quality ~80) or WebP, sRGB colour space, ideally < 3 MB.
- **Orientation:** horizon level; the image centre is the initial view direction.
- **Capture:** camera at standing eye height (~1.6 m), floor clearly visible — later
  milestones will replace the floor/wall tiles in these images.
- **Licensing:** owned or properly licensed; no hot-linked external URLs.

After adding a file, update its entry in `src/constants/panoramas.ts`.

To preview tiles on the floor or walls, each panorama also needs a floor and/or
wall mask in `public/masks/` — see `public/masks/README.md`. Without one the
viewer shows that surface as-is.
