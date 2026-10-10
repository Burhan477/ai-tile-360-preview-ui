"use client";

import { CircleAlert, LoaderCircle, Rotate3d, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { fetchGeneration, GENERATION_POLL_MS, GenerationRequestError, startGeneration } from "@/lib/generations";
import { viewerHref } from "@/lib/selection";
import type { GenerationJobData } from "@/types/api";
import type { Place, TileDesign, TileSurface } from "@/types/tile";

interface GenerateRoomPanelProps {
  place: Place | null;
  /** The completed tile, or `null` while details are missing. */
  tile: TileDesign | null;
  /** `tile_designs.id` when the tile came from the catalog. */
  catalogTileId: string | null;
  surface: TileSurface;
}

const BUTTON =
  "flex h-11 w-full items-center justify-center gap-2 rounded-full border px-5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

function isRunning(job: GenerationJobData | null): boolean {
  return job?.status === "pending" || job?.status === "processing";
}

/**
 * Generates an AI room image for the selected place (POST
 * /api/generations), polls until it finishes and opens it in the viewer. The
 * image is an ordinary wide-angle photo, not a 360° panorama, and the selected
 * tile is not painted by the AI; the notes shown with the result say both.
 */
export default function GenerateRoomPanel({ place, tile, catalogTileId, surface }: GenerateRoomPanelProps) {
  const router = useRouter();
  const [job, setJob] = useState<GenerationJobData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isOpening, startOpening] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  // Local clock, so the elapsed time is not skewed by the server's.
  const [startedAt, setStartedAt] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  // Abandon in-flight requests when leaving the page; the job keeps running on the server.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const jobId = job?.id;
  const running = isRunning(job);
  useEffect(() => {
    if (!jobId || !running) return;
    const controller = new AbortController();
    const timer = window.setInterval(async () => {
      setNow(Date.now());
      try {
        const next = await fetchGeneration(jobId, controller.signal);
        if (!controller.signal.aborted) setJob(next);
      } catch (err) {
        if (controller.signal.aborted) return;
        // A failed poll is retried on the next tick; only show it.
        setError(err instanceof GenerationRequestError ? err.message : "Couldn't check the generation status.");
      }
    }, GENERATION_POLL_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [jobId, running]);

  const handleGenerate = async () => {
    if (!place || !tile) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setIsStarting(true);
    try {
      const created = await startGeneration(
        { placeId: place.id, surface, tile: { catalogId: catalogTileId, width: tile.width, height: tile.height } },
        controller.signal,
      );
      setStartedAt(Date.now());
      setNow(Date.now());
      setJob(created);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof GenerationRequestError ? err.message : "Couldn't start the generation.");
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setIsStarting(false);
    }
  };

  const handleOpen = () => {
    if (!job || !tile) return;
    startOpening(() => router.push(viewerHref({ place: job.placeId, tile, surface }, job.id)));
  };

  const elapsed = Math.max(0, Math.round((now - startedAt) / 1000));
  const result = job?.status === "succeeded" ? job.result : null;
  const canGenerate = place !== null && tile !== null && !isStarting && !running;

  return (
    <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="flex items-center gap-1.5 text-xs tracking-wider text-stone-500 uppercase">
        <Sparkles className="size-3.5" aria-hidden="true" />
        AI room · beta
      </p>
      <p className="mt-2 text-sm text-stone-600">
        Generate a wide-angle photo of a new {place ? place.name.toLowerCase() : "room"}. It isn&apos;t a true 360°
        panorama. This usually takes under a minute.
      </p>

      <div aria-live="polite" className="mt-4 space-y-3 text-sm">
        {running && (
          <p className="flex items-center gap-2 text-stone-600">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {job?.status === "pending" ? "Queued…" : "Generating the room…"}
            <span className="tabular-nums text-stone-400">{elapsed}s</span>
          </p>
        )}
        {job?.status === "failed" && job.error && (
          <p role="alert" className="flex items-start gap-2 text-red-700">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {job.error.message}
          </p>
        )}
        {error && !(job?.status === "failed") && (
          <p role="alert" className="flex items-start gap-2 text-red-700">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        {result && (
          <>
            <p className="text-stone-600">
              Room ready
              {result.width && result.height ? (
                <span className="tabular-nums text-stone-400"> · {result.width} × {result.height} px</span>
              ) : null}
              . It&apos;s a wide-angle photo wrapped around the viewer, so expect a seam and stretching; your
              tile is not drawn on it.
            </p>
            <button
              type="button"
              onClick={handleOpen}
              disabled={isOpening || !tile}
              className={`${BUTTON} border-transparent bg-accent text-white hover:bg-accent-hover`}
            >
              <Rotate3d className={`size-4 ${isOpening ? "animate-spin" : ""}`} aria-hidden="true" />
              {isOpening ? "Opening viewer…" : "Open AI room in viewer"}
            </button>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={!canGenerate}
        className={`${BUTTON} mt-4 border-stone-300 text-ink hover:bg-stone-50`}
      >
        {isStarting ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="size-4" aria-hidden="true" />
        )}
        {job && !running ? "Generate another room" : "Generate AI room"}
      </button>
    </div>
  );
}
