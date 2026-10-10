import type { TileSizePreset, TileUnit } from "@/types/tile";
import type { TileRenderConfig, TileRotation } from "@/types/viewer";

export const TILE_UNIT: TileUnit = "mm";

export const TILE_SIZE_PRESETS: TileSizePreset[] = [
  { id: "600x600", width: 600, height: 600 },
  { id: "600x1200", width: 600, height: 1200 },
];

/** Grout and orientation used when the viewer opens. */
export const DEFAULT_TILE_LAYOUT: Pick<TileRenderConfig, "groutWidth" | "groutColor" | "rotation"> = {
  groutWidth: 2,
  groutColor: "#c9c6c0",
  rotation: 0,
};

export const MAX_GROUT_WIDTH_MM = 10;
export const GROUT_WIDTH_STEP_MM = 0.5;

export const GROUT_COLOR_PRESETS = [
  { name: "Light gray", value: "#c9c6c0" },
  { name: "Dark gray", value: "#5b5853" },
  { name: "White", value: "#f4f2ee" },
  { name: "Beige", value: "#cbb99a" },
] as const;

export const TILE_ROTATIONS: TileRotation[] = [0, 90];

/** Upper bound for custom dimensions; covers large-format slabs. */
export const MAX_TILE_DIMENSION_MM = 5000;

export const ACCEPTED_TILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ACCEPTED_TILE_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;
export const MAX_TILE_IMAGE_BYTES = 10 * 1024 * 1024;
