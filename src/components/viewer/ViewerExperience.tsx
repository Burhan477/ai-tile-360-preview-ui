"use client";

import dynamic from "next/dynamic";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { Hand, SlidersHorizontal } from "lucide-react";

import { useTileDraft } from "@/components/tile/TileDraftProvider";
import type { PanoramaViewerHandle } from "@/components/viewer/PanoramaViewer";
import TileSettingsPanel from "@/components/viewer/TileSettingsPanel";
import TileSwitcher from "@/components/viewer/TileSwitcher";
import ViewerControls, { ICON_BUTTON } from "@/components/viewer/ViewerControls";
import ViewerInfoPanel from "@/components/viewer/ViewerInfoPanel";
import ViewerLoading from "@/components/viewer/ViewerLoading";
import { DEFAULT_TILE_LAYOUT, TILE_SIZE_PRESETS } from "@/constants/tiles";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useViewerTile } from "@/hooks/useViewerTile";
import type { ViewerTileInfo } from "@/lib/selection";
import { catalogTileDesign, tileDesignFromImage } from "@/lib/tile";
import type { CatalogTile, TileDesign, TileSurface } from "@/types/tile";
import type { PanoramaAsset, TileRenderConfig } from "@/types/viewer";

// WebGL only exists in the browser, so the Three.js tree is never prerendered.
const PanoramaViewer = dynamic(() => import("@/components/viewer/PanoramaViewer"), {
  ssr: false,
  loading: () => <ViewerLoading />,
});

interface ViewerExperienceProps {
  panorama: PanoramaAsset;
  title: string;
  backHref: string;
  /** Tile metadata from the URL. */
  tile: ViewerTileInfo | null;
  surface: TileSurface | null;
  /** Rows of the `tile_designs` table offered in the tile switcher. */
  catalogTiles: CatalogTile[];
  /** Shown in place of the switcher's catalog when it could not be read. */
  catalogError: string | null;
}

function tileNotice(
  currentTile: TileDesign | null,
  surface: TileSurface | null,
  panorama: PanoramaAsset,
  canPickTile: boolean,
): string | undefined {
  if (!currentTile) {
    return canPickTile
      ? "Your tile image isn't loaded. Pick a tile below, or go back to upload it again."
      : "Your tile image isn't loaded. Go back to upload it again.";
  }
  const hasFloor = panorama.floor !== undefined;
  const hasWall = panorama.wall !== undefined;
  if (surface === "floor" && !hasFloor) return "This room isn't prepared for floor preview yet.";
  if (surface === "wall" && !hasWall) return "This room isn't prepared for wall preview yet.";
  if (surface === "both") {
    if (!hasFloor && !hasWall) return "This room isn't prepared for tile preview yet.";
    if (!hasWall) return "Showing the floor only. This room isn't prepared for walls yet.";
    if (!hasFloor) return "Showing the walls only. This room isn't prepared for floors yet.";
  }
  return undefined;
}

/** The size presets, plus the tile's own size when it is a custom one. */
function sizeOptionsFor(tile: TileDesign): { width: number; height: number }[] {
  const presets = TILE_SIZE_PRESETS.map(({ width, height }) => ({ width, height }));
  const isPreset = presets.some((p) => p.width === tile.width && p.height === tile.height);
  return isPreset ? presets : [...presets, { width: tile.width, height: tile.height }];
}

export default function ViewerExperience({
  panorama,
  title,
  backHref,
  tile,
  surface,
  catalogTiles,
  catalogError,
}: ViewerExperienceProps) {
  // Metadata comes from the URL; the image itself never travels in it and
  // is read from client memory (TileDraftProvider). Read once: from here on
  // the viewer's own tile state is the source of truth.
  const tileImage = useTileDraft().draft.image;
  const [initialTile] = useState(() =>
    tile && tileImage ? tileDesignFromImage(tileImage, tile.name, tile) : null,
  );
  const viewerTile = useViewerTile(initialTile);
  const { currentTile, resizeTile, selectTile } = viewerTile;

  // The opening tile (an upload, or a catalog tile with the user's name and
  // size) followed by the catalog tiles.
  const switcherTiles = useMemo(() => {
    const catalog = catalogTiles.map(catalogTileDesign);
    if (!initialTile) return catalog;
    return catalog.some((t) => t.id === initialTile.id)
      ? catalog.map((t) => (t.id === initialTile.id ? initialTile : t))
      : [initialTile, ...catalog];
  }, [initialTile, catalogTiles]);

  // Grout and orientation persist across tile switches; the size belongs to the tile.
  const [layout, setLayout] = useState(DEFAULT_TILE_LAYOUT);
  const tileConfig = useMemo<TileRenderConfig | null>(
    () => (currentTile ? { width: currentTile.width, height: currentTile.height, ...layout } : null),
    [currentTile, layout],
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PanoramaViewerHandle>(null);
  const { isFullscreen, isSupported, toggle } = useFullscreen(containerRef);
  const [hasInteracted, setHasInteracted] = useState(false);

  const handleInteract = useCallback(() => setHasInteracted(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const updateTileConfig = useCallback(
    ({ width, height, ...layoutPatch }: Partial<TileRenderConfig>) => {
      if (width !== undefined && height !== undefined) resizeTile({ width, height });
      setLayout((current) => ({ ...current, ...layoutPatch }));
    },
    [resizeTile],
  );
  const handleSelectTile = useCallback(
    (next: TileDesign) => {
      selectTile(next);
      handleInteract();
    },
    [selectTile, handleInteract],
  );

  return (
    <div
      ref={containerRef}
      className="relative h-dvh w-full overflow-hidden bg-stone-950 select-none"
    >
      <PanoramaViewer
        src={panorama.src}
        tile={currentTile}
        tileConfig={tileConfig}
        surface={surface}
        surfaces={panorama}
        onTileTextureStatus={viewerTile.handleTextureStatus}
        controllerRef={viewerRef}
        onInteract={handleInteract}
      />

      <ViewerControls
        title={title}
        backHref={backHref}
        info={
          surface &&
          (currentTile || tile) && (
            <ViewerInfoPanel
              tileName={currentTile?.name ?? tile?.name ?? ""}
              width={currentTile?.width ?? tile?.width ?? 0}
              height={currentTile?.height ?? tile?.height ?? 0}
              rotation={layout.rotation}
              surface={surface}
              imageUrl={currentTile?.imageUrl}
              notice={tileNotice(currentTile, surface, panorama, switcherTiles.length > 0)}
            />
          )
        }
        actions={
          tileConfig && (
            <button
              type="button"
              onClick={() => {
                setIsSettingsOpen((open) => !open);
                handleInteract();
              }}
              aria-label="Tile layout"
              title="Tile layout"
              aria-expanded={isSettingsOpen}
              aria-controls={settingsId}
              className={`${ICON_BUTTON} aria-expanded:bg-white/20`}
            >
              <SlidersHorizontal className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </button>
          )
        }
        onZoomIn={() => viewerRef.current?.zoomIn()}
        onZoomOut={() => viewerRef.current?.zoomOut()}
        onReset={() => viewerRef.current?.resetView()}
        isFullscreen={isFullscreen}
        canFullscreen={isSupported}
        onToggleFullscreen={toggle}
      />

      {surface && (switcherTiles.length > 0 || catalogError) && (
        <TileSwitcher
          tiles={switcherTiles.map((t) => (t.id === currentTile?.id ? currentTile : t))}
          selectedId={currentTile?.id ?? null}
          onSelect={handleSelectTile}
          isLoading={viewerTile.isSwitching}
          error={viewerTile.error ?? catalogError}
        />
      )}

      {isSettingsOpen && currentTile && tileConfig && (
        <TileSettingsPanel
          id={settingsId}
          config={tileConfig}
          sizeOptions={sizeOptionsFor(currentTile)}
          onChange={updateTileConfig}
          onClose={closeSettings}
        />
      )}

      <p
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-stone-950/40 px-4 py-2 text-xs whitespace-nowrap text-white backdrop-blur-md transition-opacity duration-500 ${
          // Clear of the tile switcher, which takes the bottom edge when shown.
          surface
            ? "top-1/2 -translate-y-1/2"
            : "bottom-[max(1.25rem,env(safe-area-inset-bottom))] sm:bottom-6"
        } ${hasInteracted ? "opacity-0" : "opacity-100"}`}
      >
        <Hand className="size-3.5" strokeWidth={1.75} />
        Drag to look around
        <span className="-ml-1 hidden sm:inline">· Scroll or pinch to zoom</span>
      </p>
    </div>
  );
}
