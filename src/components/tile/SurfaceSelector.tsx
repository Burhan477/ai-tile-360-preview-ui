import { Check } from "lucide-react";

import { SURFACE_LABELS } from "@/lib/tile";
import type { TileSurface } from "@/types/tile";

interface SurfaceSelectorProps {
  value: TileSurface;
  onChange: (surface: TileSurface) => void;
}

const OPTIONS: { id: TileSurface; description: string }[] = [
  { id: "floor", description: "Tile the floor only" },
  { id: "wall", description: "Tile the walls only" },
  { id: "both", description: "Floor and walls" },
];

/** Small room-corner diagram highlighting the tiled surfaces. */
function SurfaceDiagram({ surface, active }: { surface: TileSurface; active: boolean }) {
  const lit = active ? "fill-accent/70 stroke-accent" : "fill-accent-muted stroke-stone-400";
  const plain = "fill-stone-50 stroke-stone-300";
  const floor = surface !== "wall" ? lit : plain;
  const wall = surface !== "floor" ? lit : plain;

  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" className="h-12 w-16" strokeWidth={1} strokeLinejoin="round">
      <polygon points="2,2 14,8 14,32 2,46" className={wall} />
      <polygon points="62,2 50,8 50,32 62,46" className={wall} />
      <rect x={14} y={8} width={36} height={24} className={wall} />
      <polygon points="14,32 50,32 62,46 2,46" className={floor} />
    </svg>
  );
}

export default function SurfaceSelector({ value, onChange }: SurfaceSelectorProps) {
  return (
    <fieldset>
      <legend className="sr-only">Select the surface to tile</legend>
      <div className="grid grid-cols-3 gap-3">
        {OPTIONS.map((option) => {
          const isSelected = option.id === value;

          return (
            <label
              key={option.id}
              className="group relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-stone-200 bg-white px-2 py-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-sm has-checked:border-accent has-checked:bg-accent-soft has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-accent has-focus-visible:ring-offset-2 sm:px-4 sm:py-5"
            >
              <input
                type="radio"
                name="surface"
                value={option.id}
                checked={isSelected}
                onChange={() => onChange(option.id)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`absolute top-2.5 right-2.5 flex size-5 items-center justify-center rounded-full bg-accent text-white transition-all duration-200 ${
                  isSelected ? "scale-100 opacity-100" : "scale-75 opacity-0"
                }`}
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              <SurfaceDiagram surface={option.id} active={isSelected} />
              <span>
                <span className="block text-sm font-medium text-ink">
                  {SURFACE_LABELS[option.id]}
                </span>
                <span className="mt-0.5 hidden text-xs text-stone-500 sm:block">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
