import { useCallback, useEffect, useState } from "react";

import type { TextureStatus } from "@/hooks/useThreeTexture";
import type { TileDesign } from "@/types/tile";

/** How long the "couldn't load" message stays up. */
const ERROR_DISPLAY_MS = 5000;

/**
 * The viewer's single source of truth for the tile being previewed.
 *
 * Selecting a tile only changes `currentTile`; the renderers swap the texture
 * in place. Their load status comes back through `handleTextureStatus`, which
 * tracks the last tile that actually rendered, so a tile whose image fails to
 * load is rolled back to that one instead of leaving the selection out of
 * sync with what is on screen.
 */
export function useViewerTile(initialTile: TileDesign | null) {
  const [currentTile, setCurrentTile] = useState(initialTile);
  const [renderedTile, setRenderedTile] = useState<TileDesign | null>(null);
  const [isLoading, setIsLoading] = useState(initialTile !== null);
  const [error, setError] = useState<string | null>(null);

  const selectTile = useCallback((tile: TileDesign) => {
    setError(null);
    setCurrentTile(tile);
  }, []);

  /** Resizes the current tile (e.g. 600 × 600 → 600 × 1200) without switching it. */
  const resizeTile = useCallback((size: { width: number; height: number }) => {
    const resize = (tile: TileDesign | null) => (tile ? { ...tile, ...size } : tile);
    setCurrentTile(resize);
    // Keep the fallback in step, so a failed switch restores the current size.
    setRenderedTile((rendered) => (rendered?.id === currentTile?.id ? resize(rendered) : rendered));
  }, [currentTile?.id]);

  const handleTextureStatus = useCallback(
    (imageUrl: string, status: TextureStatus) => {
      // Ignore reports for an image that is no longer selected.
      if (!currentTile || imageUrl !== currentTile.imageUrl) return;

      setIsLoading(status === "loading");
      if (status === "ready") {
        setRenderedTile(currentTile);
      } else if (status === "error") {
        setError("Unable to load tile preview.");
        // The previous texture is still on screen; point the selection back at it.
        if (renderedTile) setCurrentTile(renderedTile);
      }
    },
    [currentTile, renderedTile],
  );

  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => setError(null), ERROR_DISPLAY_MS);
    return () => clearTimeout(timeout);
  }, [error]);

  return {
    currentTile,
    selectTile,
    resizeTile,
    handleTextureStatus,
    /** True while the selected tile's image is loading. */
    isLoading,
    /** True once any tile has rendered, i.e. a load replaces a visible tile. */
    isSwitching: isLoading && renderedTile !== null,
    error,
  };
}
