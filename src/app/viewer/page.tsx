import type { Metadata, Viewport } from "next";

import ViewerExperience from "@/components/viewer/ViewerExperience";
import { DEFAULT_PANORAMA, PLACE_PANORAMAS } from "@/constants/panoramas";
import { listTileDesigns } from "@/lib/server/catalog";
import { getGenerationJob } from "@/lib/server/generation";
import { resolveViewerParams, selectionHref } from "@/lib/selection";
import type { PanoramaAsset } from "@/types/viewer";

export const metadata: Metadata = {
  title: "360° Viewer · Tile 360° Preview",
};

export const viewport: Viewport = {
  // Lets the overlay respect notches via env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: "#0c0a09",
};

export default async function ViewerPage({ searchParams }: PageProps<"/viewer">) {
  const [params, tiles] = await Promise.all([searchParams, listTileDesigns()]);
  const { place, surface, tile, generationId } = resolveViewerParams(params);
  const generated = generationId ? await generatedPanorama(generationId) : null;

  return (
    <main className="flex-1 bg-stone-950">
      <ViewerExperience
        panorama={generated ?? (place ? PLACE_PANORAMAS[place.id] : DEFAULT_PANORAMA)}
        title={generated ? `${place?.name ?? "Room"} · AI photo (not true 360°)` : (place?.name ?? "Sample room")}
        backHref={selectionHref(place?.id)}
        tile={tile}
        surface={surface}
        catalogTiles={tiles.data ?? []}
        catalogError={tiles.error ? "Couldn't load the tile catalog." : null}
      />
    </main>
  );
}

/**
 * A finished AI room image. It is a wide-angle photo (Gemini outputs at most
 * 21:9), not an equirectangular panorama, so the sphere shows a seam and
 * stretched poles. It has no floor/wall mapping either: those need
 * a mask and room geometry made for this exact image, so the viewer shows the
 * room without the tile layer (and says so) rather than misplacing the tile.
 * Falls back to the place's own panorama when the job is not usable.
 */
async function generatedPanorama(id: string): Promise<PanoramaAsset | null> {
  try {
    const job = await getGenerationJob(id);
    if (job?.status === "succeeded" && job.result?.url) return { src: job.result.url };
    console.error(`[viewer] Generation ${id} is not usable (status ${job?.status ?? "not found"}).`);
  } catch (err) {
    console.error(`[viewer] Loading generation ${id} failed:`, err);
  }
  return null;
}
