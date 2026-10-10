import { PLACES } from "@/constants/places";
import { MAX_TILE_DIMENSION_MM } from "@/constants/tiles";
import { MAX_TILE_NAME_LENGTH, SURFACE_LABELS } from "@/lib/tile";
import type { Place, PlaceId, PreviewSelection, TileSurface } from "@/types/tile";

/** Raw search params as provided by Next.js page props. */
export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/**
 * Query-string keys shared by the selection page and the viewer. Only
 * metadata travels in the URL; the tile image itself stays in client memory
 * (see `TileDraftProvider`).
 */
const PARAM = {
  place: "place",
  surface: "surface",
  tileName: "tileName",
  width: "width",
  height: "height",
  generation: "generation",
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tile metadata read back from the viewer URL. */
export interface ViewerTileInfo {
  name: string;
  width: number;
  height: number;
}

export interface ViewerParams {
  place: Place | null;
  surface: TileSurface | null;
  tile: ViewerTileInfo | null;
  /** AI-generated room to show instead of the place's panorama (`preview_jobs.id`). */
  generationId: string | null;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isSurface(value: string | undefined): value is TileSurface {
  return value !== undefined && Object.hasOwn(SURFACE_LABELS, value);
}

function parseMm(value: string | undefined): number | null {
  const n = Number(value);
  return value && Number.isFinite(n) && n > 0 && n <= MAX_TILE_DIMENSION_MM ? n : null;
}

export function resolvePlace(params: SearchParamsRecord): Place | null {
  return PLACES.find((p) => p.id === first(params[PARAM.place])) ?? null;
}

/** Validates viewer search params; unknown or malformed values resolve to `null`. */
export function resolveViewerParams(params: SearchParamsRecord): ViewerParams {
  const surface = first(params[PARAM.surface]);
  const name = first(params[PARAM.tileName])?.trim().slice(0, MAX_TILE_NAME_LENGTH);
  const width = parseMm(first(params[PARAM.width]));
  const height = parseMm(first(params[PARAM.height]));
  const generation = first(params[PARAM.generation]);

  return {
    place: resolvePlace(params),
    surface: isSurface(surface) ? surface : null,
    tile: name && width && height ? { name, width, height } : null,
    generationId: generation && UUID.test(generation) ? generation : null,
  };
}

/** `/viewer?place=…&surface=…&tileName=…&width=…&height=…[&generation=…]` */
export function viewerHref({ place, tile, surface }: PreviewSelection, generationId?: string): string {
  const params = new URLSearchParams({
    [PARAM.place]: place,
    [PARAM.surface]: surface,
    [PARAM.tileName]: tile.name,
    [PARAM.width]: String(tile.width),
    [PARAM.height]: String(tile.height),
  });
  if (generationId) params.set(PARAM.generation, generationId);
  return `/viewer?${params.toString()}`;
}

/** Selection page, restoring the chosen place when there is one. */
export function selectionHref(placeId: PlaceId | null | undefined): string {
  return placeId ? `/?${PARAM.place}=${placeId}` : "/";
}
