import type { LucideIcon } from "lucide-react";

import type { ApiError, ImageContentType, StorageBucket } from "@/types/api";

export type PlaceId =
  | "hall"
  | "living-room"
  | "bedroom"
  | "bathroom"
  | "kitchen"
  | "dining-room";

export interface Place {
  id: PlaceId;
  name: string;
  description: string;
  icon: LucideIcon;
}

export type TileSurface = "floor" | "wall" | "both";

export type TileUnit = "mm";

/** A tile design image held in browser memory (user tile uploads never leave the device). */
export interface TileImage {
  id: string;
  /** `blob:` object URL for user uploads, or the catalog image URL for catalog tiles. */
  url: string;
  fileName: string;
  /** Bytes; `null` when the catalog does not record it. */
  fileSize: number | null;
  /** Intrinsic pixel size, read while validating an upload; `null` when the catalog does not record it. */
  pixelWidth: number | null;
  pixelHeight: number | null;
  source: "upload" | "catalog";
}

/** A fully specified tile, ready to be previewed. */
export interface TileDesign {
  id: string;
  name: string;
  imageUrl: string;
  fileName: string;
  fileSize: number | null;
  width: number;
  height: number;
  unit: TileUnit;
}

export interface TileSizePreset {
  id: string;
  width: number;
  height: number;
}

/** A preset id, or "custom" for user-entered dimensions. */
export type TileSizeOption = TileSizePreset["id"] | "custom";

/**
 * Editable form state for the tile input steps. Dimensions are kept as the
 * raw input strings so partially typed values survive re-renders.
 */
export interface TileDraft {
  image: TileImage | null;
  name: string;
  sizeOption: TileSizeOption | null;
  customWidth: string;
  customHeight: string;
  surface: TileSurface;
}

export interface PreviewSelection {
  place: PlaceId;
  tile: TileDesign;
  surface: TileSurface;
}

/** An active row of the `tile_designs` table, usable instead of an upload. */
export interface CatalogTile {
  id: string;
  name: string;
  /** App-relative `/public` path, or a public URL in the `tile-images` bucket. */
  image: string;
  fileSize: number | null;
  pixelWidth: number | null;
  pixelHeight: number | null;
  /** Suggested lay size in mm. */
  width: number;
  height: number;
}

/** An active row of the `room_types` table whose id the app has a place for. */
export interface RoomType {
  id: PlaceId;
  name: string;
  description: string;
}

/** A catalog read: the rows, or a client-safe error when the query failed. */
export type CatalogResult<T> = { data: T; error: null } | { data: null; error: ApiError };

/**
 * A room photo stored by `POST /api/uploads` (private `room-images` bucket).
 * Kept in client memory for the AI preview step; no table stores it yet.
 */
export interface RoomImage {
  bucket: StorageBucket;
  /** Object path; use it (not a URL) to reference the photo later. */
  path: string;
  contentType: ImageContentType;
  size: number;
  fileName: string;
  /** Local `blob:` URL of the picked file, for the preview thumbnail. */
  previewUrl: string;
}
