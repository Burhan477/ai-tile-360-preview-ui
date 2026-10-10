"use client";

import { useEffect } from "react";

import FloorTileRenderer from "@/components/viewer/FloorTileRenderer";
import { useTileTexture } from "@/components/viewer/TileTexture";
import WallTileRenderer from "@/components/viewer/WallTileRenderer";
import type { TextureStatus } from "@/hooks/useThreeTexture";
import type { TileSurface } from "@/types/tile";
import type { SurfaceMappings, TileRenderConfig, ViewerTileData } from "@/types/viewer";

interface TileRendererProps extends SurfaceMappings {
  tile: ViewerTileData;
  config: TileRenderConfig;
  surface: TileSurface;
  /** Reports loading of the tile image, e.g. to show progress or errors outside the canvas. */
  onTextureStatus?: (imageUrl: string, status: TextureStatus) => void;
}

/** Which surface layers each selection renders. */
const SURFACE_LAYERS: Record<TileSurface, { floor: boolean; wall: boolean }> = {
  floor: { floor: true, wall: false },
  wall: { floor: false, wall: true },
  both: { floor: true, wall: true },
};

/**
 * Routes the tile to the selected surfaces. Each surface is its own layer, so
 * a panorama without a mask for one surface still shows the other. All layers
 * share one tile texture and one layout config, so changing either updates
 * every surface at once.
 */
export default function TileRenderer({
  tile,
  config,
  surface,
  floor,
  wall,
  onTextureStatus,
}: TileRendererProps) {
  const { status, texture: tileTexture } = useTileTexture(tile.imageUrl);

  useEffect(() => {
    onTextureStatus?.(tile.imageUrl, status);
  }, [tile.imageUrl, status, onTextureStatus]);

  if (!tileTexture) return null;

  const { floor: showsFloor, wall: showsWall } = SURFACE_LAYERS[surface];

  return (
    <>
      {showsFloor && floor && <FloorTileRenderer tileTexture={tileTexture} config={config} floor={floor} />}
      {showsWall && wall && <WallTileRenderer tileTexture={tileTexture} config={config} wall={wall} />}
    </>
  );
}
