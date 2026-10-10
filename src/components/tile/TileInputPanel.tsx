"use client";

import Image from "next/image";
import { CircleAlert } from "lucide-react";

import RetryButton from "@/components/layout/RetryButton";
import StepSection from "@/components/layout/StepSection";
import SurfaceSelector from "@/components/tile/SurfaceSelector";
import TileDetails, { type TileDetailsValue } from "@/components/tile/TileDetails";
import TileUpload from "@/components/tile/TileUpload";
import {
  catalogTileImage,
  formatDimensions,
  nameFromFileName,
  resolveDraftDimensions,
  sizeDraftFor,
} from "@/lib/tile";
import type { CatalogTile, TileDraft, TileImage } from "@/types/tile";

interface TileInputPanelProps {
  draft: TileDraft;
  onChange: (patch: Partial<Omit<TileDraft, "image">>) => void;
  onImageChange: (image: TileImage | null) => void;
  /** Tiles from the `tile_designs` table, or `null` when it could not be read. */
  catalogTiles: CatalogTile[] | null;
  /** Step number of the first section, so numbering continues from earlier steps. */
  firstStep?: number;
}

/** Upload, tile details and surface steps for configuring a custom tile. */
export default function TileInputPanel({
  draft,
  onChange,
  onImageChange,
  catalogTiles,
  firstStep = 1,
}: TileInputPanelProps) {
  const dimensions = resolveDraftDimensions(draft);

  // Suggest a name from the file, unless the user has typed their own.
  const isNameAutofilled =
    draft.name.trim() === "" ||
    (draft.image !== null && draft.name === nameFromFileName(draft.image.fileName));

  const handleImageChange = (image: TileImage | null) => {
    onImageChange(image);
    // A suggested name belongs to its image, so it goes when the image does.
    if (isNameAutofilled) onChange({ name: image ? nameFromFileName(image.fileName) : "" });
  };

  const handleSample = (sample: CatalogTile) => {
    handleImageChange(catalogTileImage(sample));
    if (draft.sizeOption === null) onChange(sizeDraftFor(sample.width, sample.height));
  };

  const details: TileDetailsValue = {
    name: draft.name,
    sizeOption: draft.sizeOption,
    customWidth: draft.customWidth,
    customHeight: draft.customHeight,
  };

  return (
    <>
      <StepSection
        id="upload"
        step={firstStep}
        title="Upload your tile design"
        description="A photo or scan of a single tile face. It stays on your device."
      >
        <TileUpload
          image={draft.image}
          onChange={handleImageChange}
          title={draft.name.trim()}
          subtitle={dimensions ? formatDimensions(dimensions.width, dimensions.height) : undefined}
        />

        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
          {catalogTiles === null ? (
            <>
              <span role="alert" className="flex items-center gap-1.5 text-xs text-red-700">
                <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                We couldn&apos;t load the sample tiles. You can still upload your own.
              </span>
              <RetryButton />
            </>
          ) : catalogTiles.length === 0 ? (
            <span className="text-xs text-stone-500">No sample tiles are in the catalog yet.</span>
          ) : (
            <span className="text-xs text-stone-500">No image to hand? Try a sample:</span>
          )}
          {catalogTiles?.map((sample) => {
            const isActive = draft.image?.id === catalogTileImage(sample).id;
            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleSample(sample)}
                aria-pressed={isActive}
                className={`flex h-9 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none ${
                  isActive
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:text-ink"
                }`}
              >
                <span className="relative size-7 overflow-hidden rounded-full bg-stone-100">
                  <Image src={sample.image} alt="" fill sizes="28px" className="object-cover" />
                </span>
                {sample.name}
              </button>
            );
          })}
        </div>
      </StepSection>

      <StepSection
        id="details"
        step={firstStep + 1}
        title="Tile details"
        description="Name your tile and set its real-world size."
      >
        <TileDetails value={details} onChange={onChange} />
      </StepSection>

      <StepSection
        id="surface"
        step={firstStep + 2}
        title="Select a surface"
        description="Where should this tile be applied in the room?"
      >
        <SurfaceSelector value={draft.surface} onChange={(surface) => onChange({ surface })} />
      </StepSection>
    </>
  );
}
