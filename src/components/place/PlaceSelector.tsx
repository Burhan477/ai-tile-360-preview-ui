import { Check } from "lucide-react";

import type { Place, PlaceId } from "@/types/tile";

interface PlaceSelectorProps {
  places: Place[];
  selectedPlaceId: PlaceId | null;
  onSelect: (placeId: PlaceId) => void;
}

export default function PlaceSelector({
  places,
  selectedPlaceId,
  onSelect,
}: PlaceSelectorProps) {
  return (
    <fieldset>
      <legend className="sr-only">Select a place</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {places.map((place) => {
          const Icon = place.icon;
          const isSelected = place.id === selectedPlaceId;

          return (
            <label
              key={place.id}
              className="group relative flex cursor-pointer flex-col gap-4 rounded-xl border border-stone-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-sm has-checked:border-accent has-checked:bg-accent-soft has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-accent has-focus-visible:ring-offset-2 sm:p-5"
            >
              <input
                type="radio"
                name="place"
                value={place.id}
                checked={isSelected}
                onChange={() => onSelect(place.id)}
                className="sr-only"
              />
              <span className="flex items-center justify-between">
                <span
                  className={`flex size-10 items-center justify-center rounded-lg transition-colors ${
                    isSelected
                      ? "bg-accent-muted text-accent"
                      : "bg-stone-100 text-stone-600 group-hover:bg-stone-200"
                  }`}
                >
                  <Icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <span
                  aria-hidden="true"
                  className={`flex size-5 items-center justify-center rounded-full bg-accent text-white transition-all duration-200 ${
                    isSelected ? "scale-100 opacity-100" : "scale-75 opacity-0"
                  }`}
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
              </span>
              <span>
                <span className="block text-sm font-medium text-ink sm:text-base">
                  {place.name}
                </span>
                <span className="mt-0.5 block text-xs text-stone-500">
                  {place.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
