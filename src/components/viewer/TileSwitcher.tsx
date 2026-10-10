"use client";

import Image from "next/image";
import { CircleAlert, LoaderCircle } from "lucide-react";

import { formatDimensions } from "@/lib/tile";
import type { TileDesign } from "@/types/tile";

interface TileSwitcherProps {
  tiles: TileDesign[];
  selectedId: string | null;
  onSelect: (tile: TileDesign) => void;
  /** The selected tile's image is loading. */
  isLoading?: boolean;
  error?: string | null;
}

const GLASS = "border border-white/15 bg-stone-950/45 text-white shadow-lg shadow-black/20 backdrop-blur-md";

/**
 * Horizontal strip of tile designs at the bottom of the viewer. Picking one
 * swaps the tile on the selected surfaces in place; the room, camera and
 * layout settings stay as they are.
 */
export default function TileSwitcher({
  tiles,
  selectedId,
  onSelect,
  isLoading = false,
  error = null,
}: TileSwitcherProps) {
  return (
    <nav
      aria-label="Switch tile"
      className="absolute right-[4.5rem] bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-20 flex flex-col items-start gap-2 sm:right-24 sm:bottom-6 sm:left-6"
    >
      <div aria-live="polite" className="contents">
        {error ? (
          <p role="alert" className={`${GLASS} flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-amber-200`}>
            <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : (
          isLoading && (
            <p className={`${GLASS} flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs`}>
              <LoaderCircle className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
              Switching tile…
            </p>
          )
        )}
      </div>

      {tiles.length > 0 && (
        <ul
          className={`${GLASS} flex max-w-full snap-x gap-1.5 overflow-x-auto rounded-2xl p-1.5 [scrollbar-width:none]`}
        >
          {tiles.map((tile) => {
            const isSelected = tile.id === selectedId;
            return (
              <li key={tile.id} className="shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => onSelect(tile)}
                  aria-pressed={isSelected}
                  className="flex items-center gap-2.5 rounded-xl border border-transparent p-1.5 pr-3 text-left transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-accent-muted focus-visible:outline-none aria-pressed:border-accent-muted/70 aria-pressed:bg-white/15"
                >
                  <span className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-white/20 bg-stone-800">
                    <Image src={tile.imageUrl} alt="" fill sizes="40px" className="object-cover" />
                    {isSelected && isLoading && (
                      <span className="absolute inset-0 flex items-center justify-center bg-stone-950/50">
                        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block max-w-28 truncate text-xs font-medium">{tile.name}</span>
                    <span className="block text-[11px] text-white/60 tabular-nums">
                      {formatDimensions(tile.width, tile.height)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
