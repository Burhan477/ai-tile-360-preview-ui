"use client";

import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import RetryButton from "@/components/layout/RetryButton";
import StepSection from "@/components/layout/StepSection";
import PlaceSelector from "@/components/place/PlaceSelector";
import RoomImageUpload from "@/components/place/RoomImageUpload";
import GenerateRoomPanel from "@/components/tile/GenerateRoomPanel";
import PreviewCTA from "@/components/tile/PreviewCTA";
import { useTileDraft } from "@/components/tile/TileDraftProvider";
import TileInputPanel from "@/components/tile/TileInputPanel";
import { PLACES, placesFromRoomTypes } from "@/constants/places";
import { viewerHref } from "@/lib/selection";
import { buildTileDesign, resolveDraftDimensions } from "@/lib/tile";
import type { CatalogTile, PlaceId, RoomType } from "@/types/tile";

interface PreviewWorkflowProps {
  /** Restores the place, e.g. when returning from the viewer. */
  initialPlaceId?: PlaceId | null;
  /** Rows of the `room_types` table, or `null` when it could not be read. */
  roomTypes: RoomType[] | null;
  /** Rows of the `tile_designs` table, or `null` when it could not be read. */
  catalogTiles: CatalogTile[] | null;
}

export default function PreviewWorkflow({
  initialPlaceId = null,
  roomTypes,
  catalogTiles,
}: PreviewWorkflowProps) {
  const router = useRouter();
  const [placeId, setPlaceId] = useState<PlaceId | null>(initialPlaceId);
  const { draft, updateDraft, setImage, roomImage, setRoomImage } = useTileDraft();
  const [isOpening, startOpening] = useTransition();

  // The app's own place list keeps the workflow usable if the database is down.
  const places = roomTypes ? placesFromRoomTypes(roomTypes) : PLACES;
  const place = places.find((p) => p.id === placeId) ?? null;
  const tile = buildTileDesign(draft);
  const dimensions = resolveDraftDimensions(draft);

  const missing = [
    !place && "place",
    !draft.image && "tile image",
    !draft.name.trim() && "tile name",
    !dimensions && "tile size",
  ].filter((item): item is string => typeof item === "string");

  const handleOpenViewer = () => {
    if (!place || !tile) return;
    startOpening(() => router.push(viewerHref({ place: place.id, tile, surface: draft.surface })));
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
      <div className="space-y-12">
        <StepSection
          id="place"
          step={1}
          title="Select a place"
          description="Choose the room you want to visualise."
        >
          {roomTypes === null && (
            <div
              role="status"
              className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-900"
            >
              <span className="flex items-center gap-1.5">
                <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                We couldn&apos;t load the room list, so the built-in rooms are shown.
              </span>
              <RetryButton />
            </div>
          )}
          {places.length > 0 ? (
            <PlaceSelector places={places} selectedPlaceId={placeId} onSelect={setPlaceId} />
          ) : (
            <p className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-6 text-center text-sm text-stone-500">
              No rooms are available right now.
            </p>
          )}
          <RoomImageUpload image={roomImage} onChange={setRoomImage} />
        </StepSection>

        <TileInputPanel
          draft={draft}
          onChange={updateDraft}
          onImageChange={setImage}
          catalogTiles={catalogTiles}
          firstStep={2}
        />
      </div>

      <aside aria-label="Selection summary" className="lg:sticky lg:top-24 lg:self-start">
        <PreviewCTA
          place={place}
          tile={tile}
          imageUrl={draft.image?.url ?? null}
          tileName={draft.name.trim()}
          dimensions={dimensions}
          surface={draft.surface}
          missing={missing}
          isOpening={isOpening}
          onOpenViewer={handleOpenViewer}
        />
        <GenerateRoomPanel
          place={place}
          tile={tile}
          catalogTileId={draft.image?.source === "catalog" ? draft.image.id.replace(/^catalog-/, "") : null}
          surface={draft.surface}
        />
      </aside>
    </div>
  );
}
