"use client";

import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";

import {
  GROUT_COLOR_PRESETS,
  GROUT_WIDTH_STEP_MM,
  MAX_GROUT_WIDTH_MM,
  TILE_ROTATIONS,
} from "@/constants/tiles";
import { formatDimensions } from "@/lib/tile";
import type { TileRenderConfig } from "@/types/viewer";

interface TileSettingsPanelProps {
  id: string;
  config: TileRenderConfig;
  /** Selectable tile sizes in mm. */
  sizeOptions: { width: number; height: number }[];
  onChange: (patch: Partial<TileRenderConfig>) => void;
  onClose: () => void;
}

const SEGMENT =
  "flex h-9 flex-1 cursor-pointer items-center justify-center rounded-lg border border-white/15 px-2 text-xs tabular-nums transition-colors hover:bg-white/10 has-checked:border-accent-muted has-checked:bg-white/15 has-checked:font-medium has-focus-visible:ring-2 has-focus-visible:ring-accent-muted";

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  const Label = htmlFor ? "label" : "p";
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="block text-[11px] font-medium tracking-wide text-white/60 uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}

/**
 * Tile layout controls (size, orientation, grout). A bottom sheet on phones,
 * a floating card under the top-right controls on larger screens.
 */
export default function TileSettingsPanel({
  id,
  config,
  sizeOptions,
  onChange,
  onClose,
}: TileSettingsPanelProps) {
  const ids = { title: useId(), grout: useId(), color: useId() };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <section
      id={id}
      aria-labelledby={ids.title}
      className="absolute inset-x-0 bottom-0 z-30 max-h-[70dvh] overflow-y-auto rounded-t-2xl border border-white/15 bg-stone-950/80 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-white shadow-2xl shadow-black/40 backdrop-blur-md sm:inset-x-auto sm:top-20 sm:right-6 sm:bottom-auto sm:w-72 sm:rounded-2xl sm:bg-stone-950/60 sm:pb-4"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id={ids.title} className="font-display text-base">
          Tile layout
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tile layout"
          className="-mr-1.5 flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-accent-muted focus-visible:outline-none"
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-4">
        <Field label="Size">
          <div role="radiogroup" aria-label="Tile size" className="flex gap-2">
            {sizeOptions.map((size) => (
              <label key={`${size.width}x${size.height}`} className={SEGMENT}>
                <input
                  type="radio"
                  name={`${id}-size`}
                  checked={config.width === size.width && config.height === size.height}
                  onChange={() => onChange(size)}
                  className="sr-only"
                />
                {formatDimensions(size.width, size.height)}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Orientation">
          <div role="radiogroup" aria-label="Tile orientation" className="flex gap-2">
            {TILE_ROTATIONS.map((rotation) => (
              <label key={rotation} className={SEGMENT}>
                <input
                  type="radio"
                  name={`${id}-rotation`}
                  checked={config.rotation === rotation}
                  onChange={() => onChange({ rotation })}
                  className="sr-only"
                />
                {rotation}°
              </label>
            ))}
          </div>
        </Field>

        <Field label="Grout width" htmlFor={ids.grout}>
          <div className="flex items-center gap-3">
            <input
              id={ids.grout}
              type="range"
              min={0}
              max={MAX_GROUT_WIDTH_MM}
              step={GROUT_WIDTH_STEP_MM}
              value={config.groutWidth}
              onChange={(event) => onChange({ groutWidth: Number(event.target.value) })}
              className="h-1.5 flex-1 cursor-pointer accent-accent-muted"
            />
            <output htmlFor={ids.grout} className="w-12 text-right text-xs tabular-nums">
              {config.groutWidth} mm
            </output>
          </div>
        </Field>

        <Field label="Grout color">
          <div className="flex items-center gap-2">
            {GROUT_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => onChange({ groutColor: preset.value })}
                aria-label={preset.name}
                aria-pressed={config.groutColor === preset.value}
                title={preset.name}
                style={{ backgroundColor: preset.value }}
                className="size-8 rounded-full border border-white/30 transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent-muted focus-visible:outline-none aria-pressed:ring-2 aria-pressed:ring-white aria-pressed:ring-offset-2 aria-pressed:ring-offset-stone-900"
              />
            ))}
            <label
              htmlFor={ids.color}
              title="Custom color"
              className="relative ml-auto flex h-8 cursor-pointer items-center gap-2 rounded-full border border-white/15 pr-3 pl-1 text-xs transition-colors hover:bg-white/10 has-focus-visible:ring-2 has-focus-visible:ring-accent-muted"
            >
              <span
                aria-hidden="true"
                style={{ backgroundColor: config.groutColor }}
                className="size-6 rounded-full border border-white/30"
              />
              Custom
              <input
                id={ids.color}
                type="color"
                value={config.groutColor}
                onChange={(event) => onChange({ groutColor: event.target.value })}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
          </div>
        </Field>
      </div>
    </section>
  );
}
