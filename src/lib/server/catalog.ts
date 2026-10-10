import "server-only";

import { isPlaceId } from "@/constants/places";
import { classifyDatabaseError, type DatabaseError } from "@/lib/server/database";
import { getSupabaseEnv, ServerConfigError } from "@/lib/server/env";
import { getSupabase } from "@/lib/server/supabase";
import type { CatalogResult, CatalogTile, RoomType } from "@/types/tile";

const ROUTE = "catalog";

/** `/tiles/petra-crema.jpg`: a file under `public/`. */
const APP_IMAGE_PATH = /^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.(?:jpe?g|png|webp|svg)$/i;

/** Public objects in the `tile-images` bucket of the configured project. */
const TILE_IMAGES_PUBLIC_PATH = "/storage/v1/object/public/tile-images/";

interface TileDesignRow {
  id: string;
  name: string;
  image_url: string;
  width_mm: number | string;
  height_mm: number | string;
  pixel_width: number | null;
  pixel_height: number | null;
  file_size_bytes: number | null;
}

interface RoomTypeRow {
  id: string;
  name: string;
  description: string;
}

/**
 * Active tile designs, in catalog order. Read with the publishable key, so
 * RLS limits it to active rows. Rows whose image is neither a `public/` file
 * nor a public `tile-images` object of this project are skipped (and logged):
 * the browser and `next/image` could not load them.
 */
export async function listTileDesigns(): Promise<CatalogResult<CatalogTile[]>> {
  return read(async () => {
    const { data, error, status } = await getSupabase()
      .from("tile_designs")
      .select("id, name, image_url, width_mm, height_mm, pixel_width, pixel_height, file_size_bytes")
      .eq("is_active", true)
      .order("sort_order")
      .order("name")
      .overrideTypes<TileDesignRow[], { merge: false }>();
    if (error) return failure(status, error);

    const { url: supabaseOrigin } = getSupabaseEnv();
    const tiles = data.flatMap((row): CatalogTile[] => {
      const image = resolveTileImage(row.image_url, supabaseOrigin);
      const width = Number(row.width_mm);
      const height = Number(row.height_mm);
      if (!image || !(width > 0) || !(height > 0)) {
        console.error(`[${ROUTE}] Skipping tile_designs row "${row.id}": unusable image_url or size.`);
        return [];
      }
      return [
        {
          id: row.id,
          name: row.name,
          image,
          fileSize: row.file_size_bytes,
          pixelWidth: row.pixel_width,
          pixelHeight: row.pixel_height,
          width,
          height,
        },
      ];
    });
    return { data: tiles, error: null };
  });
}

/**
 * Active room types, in catalog order, limited to ids the app has an icon and
 * panorama for (`PLACES`); others are skipped and logged.
 */
export async function listRoomTypes(): Promise<CatalogResult<RoomType[]>> {
  return read(async () => {
    const { data, error, status } = await getSupabase()
      .from("room_types")
      .select("id, name, description")
      .eq("is_active", true)
      .order("sort_order")
      .order("name")
      .overrideTypes<RoomTypeRow[], { merge: false }>();
    if (error) return failure(status, error);

    const rooms = data.flatMap((row): RoomType[] => {
      if (isPlaceId(row.id)) return [{ id: row.id, name: row.name, description: row.description }];
      console.error(`[${ROUTE}] Skipping room_types row "${row.id}": no place is defined for it.`);
      return [];
    });
    return { data: rooms, error: null };
  });
}

function resolveTileImage(value: string, supabaseOrigin: string): string | null {
  if (APP_IMAGE_PATH.test(value)) return value;
  if (!URL.canParse(value)) return null;
  const url = new URL(value);
  const isTileImage =
    url.origin === supabaseOrigin &&
    url.pathname.startsWith(TILE_IMAGES_PUBLIC_PATH) &&
    !url.pathname.includes("..") &&
    !url.search;
  return isTileImage ? url.href : null;
}

function failure(status: number, error: DatabaseError): CatalogResult<never> {
  const { code, message } = classifyDatabaseError(ROUTE, status, error);
  return { data: null, error: { code, message } };
}

/** Runs a catalog read, turning thrown config/unexpected errors into a result. */
async function read<T>(query: () => Promise<CatalogResult<T>>): Promise<CatalogResult<T>> {
  try {
    return await query();
  } catch (err) {
    if (err instanceof ServerConfigError) {
      console.error(`[${ROUTE}]`, err.message);
      return { data: null, error: { code: "CONFIG_INVALID", message: err.message } };
    }
    console.error(`[${ROUTE}] Unexpected error:`, err);
    return { data: null, error: { code: "INTERNAL_ERROR", message: "Internal server error." } };
  }
}
