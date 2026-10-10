import type { PlaceId } from "@/types/tile";
import type { PanoramaAsset } from "@/types/viewer";

/**
 * Generated placeholder room (`scripts/generate-placeholder-panorama.mjs`).
 * Its floor and wall values mirror the generator's ROOM and EYE constants, so
 * tiles render at true physical scale and the grid starts at the room's corner.
 */
const PLACEHOLDER_PANORAMA: PanoramaAsset = {
  src: "/panoramas/placeholder-room.png",
  floor: {
    mask: "/masks/placeholder-room-floor.png",
    cameraHeight: 1.6,
    // EYE (0.25, 0.35) minus the room's minimum corner (-3, -2.6).
    gridOffset: [3.25, 2.95],
    gridRotation: 0,
  },
  wall: {
    mask: "/masks/living-room-wall.png",
    cameraHeight: 1.6,
    wallHeight: 2.8,
    // ROOM bounds minus EYE (0.25, 0.35).
    room: { minX: -3.25, maxX: 2.75, minZ: -2.95, maxZ: 2.25 },
    yaw: 0,
    gridOffset: [0, 0],
  },
};

/** Shown when no place is selected, and for places without their own photo. */
export const DEFAULT_PANORAMA = PLACEHOLDER_PANORAMA;

/**
 * Equirectangular (2:1) panorama per place, served from `public/panoramas/`,
 * with optional floor/wall masks from `public/masks/`. Every place uses the
 * generated placeholder until real photography is added; see
 * `public/panoramas/README.md` and `public/masks/README.md`.
 */
export const PLACE_PANORAMAS: Record<PlaceId, PanoramaAsset> = {
  hall: DEFAULT_PANORAMA,
  "living-room": DEFAULT_PANORAMA,
  bedroom: DEFAULT_PANORAMA,
  bathroom: DEFAULT_PANORAMA,
  kitchen: DEFAULT_PANORAMA,
  "dining-room": DEFAULT_PANORAMA,
};
