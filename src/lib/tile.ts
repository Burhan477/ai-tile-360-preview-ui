import {
  ACCEPTED_TILE_IMAGE_EXTENSIONS,
  ACCEPTED_TILE_IMAGE_TYPES,
  MAX_TILE_DIMENSION_MM,
  MAX_TILE_IMAGE_BYTES,
  TILE_SIZE_PRESETS,
  TILE_UNIT,
} from "@/constants/tiles";
import type { CatalogTile, TileDesign, TileDraft, TileImage, TileSurface } from "@/types/tile";

export const SURFACE_LABELS: Record<TileSurface, string> = {
  floor: "Floor",
  wall: "Wall",
  both: "Floor + Wall",
};

export const EMPTY_TILE_DRAFT: TileDraft = {
  image: null,
  name: "",
  sizeOption: null,
  customWidth: "",
  customHeight: "",
  surface: "floor",
};

export const MAX_TILE_NAME_LENGTH = 60;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 10485760 → "10 MB", 4718592 → "4.5 MB" */
export function formatMegabytes(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

export function formatDimensions(width: number, height: number): string {
  return `${width} × ${height} ${TILE_UNIT}`;
}

/** "petra_crema-final.JPG" → "Petra Crema Final" */
export function nameFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (char) => char.toUpperCase())
    .slice(0, MAX_TILE_NAME_LENGTH);
}

/** Returns a user-facing error, or `null` when the file is an acceptable image of at most `maxBytes`. */
export function validateImageFile(file: File, maxBytes: number): string | null {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const typeOk = (ACCEPTED_TILE_IMAGE_TYPES as readonly string[]).includes(file.type);
  const extensionOk = (ACCEPTED_TILE_IMAGE_EXTENSIONS as readonly string[]).includes(extension);
  // Some platforms report an empty MIME type; fall back to the extension then.
  const formatOk = file.type ? typeOk : extensionOk;

  if (!formatOk) return "Please upload a JPG, PNG, or WEBP image.";
  if (file.size > maxBytes) return `Image size must be less than ${formatMegabytes(maxBytes)}.`;
  if (file.size === 0) return "This file is empty. Please choose another image.";
  return null;
}

export function validateTileFile(file: File): string | null {
  return validateImageFile(file, MAX_TILE_IMAGE_BYTES);
}

/** Decodes an image URL to confirm it is a real image and read its pixel size. */
export function readImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Image could not be decoded"));
    img.src = url;
  });
}

/** Parses a dimension input; returns an error message or the value in mm. */
export function parseDimension(raw: string, label: string): { value: number } | { error: string } {
  if (raw.trim() === "") return { error: `Enter a ${label.toLowerCase()}.` };
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return { error: `${label} must be a positive number.` };
  }
  if (value > MAX_TILE_DIMENSION_MM) {
    return { error: `${label} must be ${MAX_TILE_DIMENSION_MM} ${TILE_UNIT} or less.` };
  }
  return { value };
}

/** The draft's dimensions, or `null` while no valid size is selected/entered. */
export function resolveDraftDimensions(
  draft: TileDraft,
): { width: number; height: number } | null {
  if (draft.sizeOption === null) return null;

  if (draft.sizeOption === "custom") {
    const width = parseDimension(draft.customWidth, "Width");
    const height = parseDimension(draft.customHeight, "Height");
    if ("error" in width || "error" in height) return null;
    return { width: width.value, height: height.value };
  }

  const preset = TILE_SIZE_PRESETS.find((p) => p.id === draft.sizeOption);
  return preset ? { width: preset.width, height: preset.height } : null;
}

/** A catalog tile as an in-memory tile image, like an upload. */
export function catalogTileImage(tile: CatalogTile): TileImage {
  return {
    id: `catalog-${tile.id}`,
    url: tile.image,
    fileName: tile.image.slice(tile.image.lastIndexOf("/") + 1),
    fileSize: tile.fileSize,
    pixelWidth: tile.pixelWidth,
    pixelHeight: tile.pixelHeight,
    source: "catalog",
  };
}

/** Draft fields selecting a size: its preset when one matches, otherwise custom values. */
export function sizeDraftFor(
  width: number,
  height: number,
): Pick<TileDraft, "sizeOption" | "customWidth" | "customHeight"> {
  const preset = TILE_SIZE_PRESETS.find((p) => p.width === width && p.height === height);
  return preset
    ? { sizeOption: preset.id, customWidth: "", customHeight: "" }
    : { sizeOption: "custom", customWidth: String(width), customHeight: String(height) };
}

export function tileDesignFromImage(
  image: TileImage,
  name: string,
  dimensions: { width: number; height: number },
): TileDesign {
  return {
    id: image.id,
    name,
    imageUrl: image.url,
    fileName: image.fileName,
    fileSize: image.fileSize,
    width: dimensions.width,
    height: dimensions.height,
    unit: TILE_UNIT,
  };
}

/** A catalog tile at its suggested size; shares its id with `catalogTileImage`. */
export function catalogTileDesign(tile: CatalogTile): TileDesign {
  return tileDesignFromImage(catalogTileImage(tile), tile.name, tile);
}

/** Builds the final tile, or `null` while required information is missing. */
export function buildTileDesign(draft: TileDraft): TileDesign | null {
  const name = draft.name.trim();
  const dimensions = resolveDraftDimensions(draft);
  if (!draft.image || !name || !dimensions) return null;

  return tileDesignFromImage(draft.image, name, dimensions);
}
