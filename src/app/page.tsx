import Header from "@/components/layout/Header";
import PreviewWorkflow from "@/components/tile/PreviewWorkflow";
import { listRoomTypes, listTileDesigns } from "@/lib/server/catalog";
import { resolvePlace } from "@/lib/selection";

export default async function Home({ searchParams }: PageProps<"/">) {
  const [params, roomTypes, tiles] = await Promise.all([searchParams, listRoomTypes(), listTileDesigns()]);
  // Restores the place when coming back from the viewer; the tile itself is
  // kept in client memory by TileDraftProvider.
  const initialPlaceId = resolvePlace(params)?.id ?? null;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-16 sm:px-6 sm:pt-14 lg:pb-24">
        <div className="mb-10 max-w-2xl sm:mb-14">
          <p className="text-xs tracking-[0.2em] text-stone-500 uppercase">
            Tile visualiser
          </p>
          <h1 className="font-display mt-3 text-3xl leading-tight text-ink sm:text-5xl">
            See your own tile design in the room before you lay it.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-stone-600">
            Choose a space, upload your tile design and set its size, then step inside an interactive 360° view.
          </p>
        </div>
        <PreviewWorkflow initialPlaceId={initialPlaceId} roomTypes={roomTypes.data} catalogTiles={tiles.data} />
      </main>
    </>
  );
}
