import type { TileDesign } from "@/types/tile";

/** What the 360° viewer needs from a tile to render it; any `TileDesign` fits. */
export type ViewerTileData = Pick<TileDesign, "imageUrl" | "name">;

export type TileRotation = 0 | 90;

/**
 * How the tile is laid, shared by every surface renderer. Changing it only
 * updates shader uniforms; the panorama and textures are not reloaded.
 */
export interface TileRenderConfig {
  /** Millimetres, as the image is drawn (before rotation). */
  width: number;
  /** Millimetres, as the image is drawn (before rotation). */
  height: number;
  /** Joint width in millimetres; 0 for none. */
  groutWidth: number;
  /** CSS hex colour, e.g. `#c9c6c0`. */
  groutColor: string;
  /** 90 turns each tile a quarter turn: a 600 × 1200 tile then lies 1200 across. */
  rotation: TileRotation;
}

/**
 * How the floor of a panorama maps onto a flat plane. Values are in metres,
 * in the panorama's own frame: the image centre looks down −Z, +X is to the
 * right and +Y is up.
 */
export interface FloorMapping {
  /** Grayscale equirectangular mask, same aspect as the panorama; white = floor. */
  mask: string;
  /** Camera height above the floor when the panorama was captured. */
  cameraHeight: number;
  /** Shifts the tile grid on the floor plane, e.g. to start at a wall corner. */
  gridOffset: [x: number, z: number];
  /** Rotates the tile grid around the vertical axis (radians) to follow the walls. */
  gridRotation: number;
}

/**
 * How the walls of a panorama map onto the four sides of a box room, in the
 * same frame as `FloorMapping` with the camera at the origin. Values are in
 * metres. The tile grid runs continuously around the room (front, right,
 * back, left), so joints carry over the corners.
 */
export interface WallMapping {
  /** Grayscale equirectangular mask, same aspect as the panorama; white = tileable wall. */
  mask: string;
  /** Camera height above the floor; tile rows start at the floor line. */
  cameraHeight: number;
  /** Floor-to-ceiling height. */
  wallHeight: number;
  /** Wall positions relative to the camera: left/right (x) and front/back (z) walls. */
  room: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Turns the room box around the vertical axis (radians) to line up with the photo. */
  yaw: number;
  /** Shifts the tile grid along the walls and up from the floor. */
  gridOffset: [along: number, up: number];
}

/** Prepared tile surfaces of a panorama; omitted ones have no mask yet. */
export interface SurfaceMappings {
  floor?: FloorMapping;
  wall?: WallMapping;
}

export interface PanoramaAsset extends SurfaceMappings {
  /** Equirectangular (2:1) image URL. */
  src: string;
}
