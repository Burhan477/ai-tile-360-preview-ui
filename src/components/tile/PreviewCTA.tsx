import Image from "next/image";
import { Rotate3d } from "lucide-react";

import { formatDimensions, SURFACE_LABELS } from "@/lib/tile";
import type { Place, TileDesign, TileSurface } from "@/types/tile";

interface PreviewCTAProps {
  place: Place | null;
  /** The completed tile, or `null` while details are missing. */
  tile: TileDesign | null;
  /** Thumbnail of the uploaded image, shown even before the tile is complete. */
  imageUrl: string | null;
  tileName: string;
  dimensions: { width: number; height: number } | null;
  surface: TileSurface;
  /** Human-readable list of what still needs to be provided. */
  missing: string[];
  /** True while navigating to the viewer. */
  isOpening: boolean;
  onOpenViewer: () => void;
}

export default function PreviewCTA({
  place,
  tile,
  imageUrl,
  tileName,
  dimensions,
  surface,
  missing,
  isOpening,
  onOpenViewer,
}: PreviewCTAProps) {
  const isReady = place !== null && tile !== null;

  const summary = [
    { label: "Place", value: place?.name },
    { label: "Tile", value: tileName || undefined },
    {
      label: "Size",
      value: dimensions ? formatDimensions(dimensions.width, dimensions.height) : undefined,
    },
    { label: "Surface", value: SURFACE_LABELS[surface] },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-4">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
          {imageUrl && (
            <Image src={imageUrl} alt="" fill sizes="56px" className="object-cover" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs tracking-wider text-stone-500 uppercase">Your selection</p>
          <p className="font-display truncate text-lg text-ink">
            {tileName || (imageUrl ? "Untitled tile" : "No tile uploaded yet")}
          </p>
        </div>
      </div>

      <dl className="mt-5 divide-y divide-stone-100 border-y border-stone-100 text-sm">
        {summary.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-stone-500">{item.label}</dt>
            <dd
              className={`truncate tabular-nums ${item.value ? "font-medium text-ink" : "text-stone-400"}`}
            >
              {item.value ?? "—"}
            </dd>
          </div>
        ))}
      </dl>

      <button
        type="button"
        onClick={onOpenViewer}
        disabled={!isReady || isOpening}
        aria-describedby="preview-cta-status"
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
      >
        <Rotate3d
          className={`size-4 ${isOpening ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
        {isOpening ? "Opening viewer…" : "Open 360° Viewer"}
      </button>

      <div id="preview-cta-status" aria-live="polite" className="mt-3 text-xs">
        {!isReady && missing.length > 0 && (
          <p className="text-center text-stone-500">Still needed: {missing.join(", ")}.</p>
        )}
      </div>
    </div>
  );
}
