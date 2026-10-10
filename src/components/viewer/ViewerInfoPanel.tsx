import Image from "next/image";
import { CircleAlert } from "lucide-react";

import { formatDimensions, SURFACE_LABELS } from "@/lib/tile";
import type { TileSurface } from "@/types/tile";
import type { TileRotation } from "@/types/viewer";

interface ViewerInfoPanelProps {
  tileName: string;
  width: number;
  height: number;
  rotation?: TileRotation;
  surface: TileSurface | null;
  imageUrl?: string;
  /** Short status/warning line, e.g. when the tile cannot be shown. */
  notice?: string;
}

/** Compact summary of the tile being previewed. */
export default function ViewerInfoPanel({
  tileName,
  width,
  height,
  rotation = 0,
  surface,
  imageUrl,
  notice,
}: ViewerInfoPanelProps) {
  return (
    <section
      aria-label="Tile details"
      className="w-64 max-w-full rounded-2xl border border-white/15 bg-stone-950/45 p-3 text-white shadow-lg shadow-black/20 backdrop-blur-md"
    >
      <div className="flex items-start gap-3">
        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-white/20 bg-stone-800">
          {imageUrl && (
            <Image src={imageUrl} alt="Selected tile design" fill sizes="48px" className="object-cover" />
          )}
        </span>
        <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-white/55">Tile</dt>
          <dd className="truncate font-medium">{tileName}</dd>
          <dt className="text-white/55">Size</dt>
          <dd className="tabular-nums">
            {formatDimensions(width, height)}
            {rotation !== 0 && ` · ${rotation}°`}
          </dd>
          {surface && (
            <>
              <dt className="text-white/55">Surface</dt>
              <dd>{SURFACE_LABELS[surface]}</dd>
            </>
          )}
        </dl>
      </div>
      {notice && (
        <p role="status" className="mt-2.5 flex items-start gap-1.5 border-t border-white/10 pt-2.5 text-[11px] leading-snug text-amber-200">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}
    </section>
  );
}
