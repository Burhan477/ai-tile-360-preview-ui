import "server-only";

import { isPlaceId } from "@/constants/places";
import { MAX_TILE_DIMENSION_MM } from "@/constants/tiles";
import { classifyDatabaseError, type DatabaseError } from "@/lib/server/database";
import { BUCKET_FILE_SIZE_LIMIT_BYTES, getGeminiEnv, getGenerationLimitsEnv, ServerConfigError } from "@/lib/server/env";
import { GenerationError, generateImage, PROVIDER_TIMEOUT_MS } from "@/lib/server/gemini";
import { detectImageType, getImageUrl, newObjectPath, readImageDimensions } from "@/lib/server/storage";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { SURFACE_LABELS } from "@/lib/tile";
import type {
  ApiErrorCode,
  GenerationErrorCode,
  GenerationJobData,
  GenerationRequestBody,
  GenerationStatus,
  ImageContentType,
} from "@/types/api";
import type { PlaceId, TileSurface } from "@/types/tile";

const LOG = "generation";
const BUCKET = "generated-previews";
const PROVIDER = "gemini";

/**
 * A job still pending or processing after this long was abandoned (the
 * function running it hit `maxDuration` or crashed) and is marked failed.
 * Covers the route's 300 s `maxDuration` with margin.
 */
const STALE_AFTER_MS = Math.max(PROVIDER_TIMEOUT_MS, 300_000) + 60_000;

/** `tile_designs.id` format (see the catalog migration). */
const TILE_DESIGN_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Thrown by the service for request-level failures; routes turn it into an API error. */
export class GenerationServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GenerationServiceError";
  }
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

export function isGenerationId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Validates an untrusted JSON body. Unknown fields are ignored; nothing in it reaches the prompt as text. */
export function parseGenerationRequest(body: unknown): { data: GenerationRequestBody } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Send a JSON object." };
  const { placeId, surface, tile } = body as Record<string, unknown>;

  if (!isPlaceId(placeId)) return { error: '"placeId" must be a known place id.' };
  if (typeof surface !== "string" || !Object.hasOwn(SURFACE_LABELS, surface)) {
    return { error: '"surface" must be "floor", "wall" or "both".' };
  }
  if (typeof tile !== "object" || tile === null) return { error: '"tile" must be an object.' };

  const { catalogId, width, height } = tile as Record<string, unknown>;
  if (catalogId !== null && !(typeof catalogId === "string" && catalogId.length <= 64 && TILE_DESIGN_ID.test(catalogId))) {
    return { error: '"tile.catalogId" must be a catalog tile id or null.' };
  }
  const isDimension = (n: unknown): n is number =>
    typeof n === "number" && Number.isFinite(n) && n > 0 && n <= MAX_TILE_DIMENSION_MM;
  if (!isDimension(width) || !isDimension(height)) {
    return { error: `"tile.width" and "tile.height" must be millimetres between 0 and ${MAX_TILE_DIMENSION_MM}.` };
  }

  return {
    data: {
      placeId,
      surface: surface as TileSurface,
      // Same precision as the numeric(6, 1) columns.
      tile: { catalogId, width: Math.round(width * 10) / 10, height: Math.round(height * 10) / 10 },
    },
  };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

/** What each place contains. Furniture stays at the edges so floor and walls remain visible. */
const ROOM_CONTENTS: Record<PlaceId, string> = {
  hall: "entrance hall with a front door, a slim console table against one wall and a coat rail",
  "living-room": "living room with a sofa and armchair against the walls, a low coffee table and a large window",
  bedroom: "bedroom with a double bed against one wall, two bedside tables and a built-in wardrobe",
  bathroom: "bathroom with a walk-in shower behind a clear glass screen, a vanity basin with a mirror and a toilet",
  kitchen: "kitchen with fitted cabinets along the walls, a worktop with a sink and a window",
  "dining-room": "dining room with a dining table and six chairs, a sideboard and a pendant light",
};

const PLAIN_FLOOR =
  "a plain, continuous, matte light-grey floor with no tiles, planks, pattern, grout lines or rugs, clearly visible all around the camera";
const PLAIN_WALLS =
  "plain, smooth, matte off-white painted walls with no tiles, panelling, wallpaper or pattern";

/**
 * Builds the prompt from validated enums only. The surface that will carry
 * the tile is kept plain and neutral: the real tile is drawn later by the
 * viewer, never invented by the image model.
 *
 * It asks for an ordinary wide-angle photo, not a 360° panorama: Gemini
 * image models output at most 21:9 and do not produce an equirectangular
 * projection or edges that wrap seamlessly.
 */
export function buildRoomPrompt(placeId: PlaceId, surface: TileSurface): string {
  const floor = surface === "wall" ? "a neutral light-grey matte floor" : PLAIN_FLOOR;
  const walls = surface === "floor" ? "matte off-white painted walls" : PLAIN_WALLS;
  return [
    `A photorealistic, ultra-wide-angle interior photograph of an empty, modern, tidy ${ROOM_CONTENTS[placeId]}.`,
    "Camera: standing eye height (1.6 m) near one wall, looking across the room with a perfectly level horizon " +
      "and vertical lines kept straight, showing the floor in the lower part of the image and the opposite walls.",
    `Floor: ${floor}.`,
    `Walls: ${walls}.`,
    "Lighting: soft natural daylight, realistic soft shadows, neutral white balance.",
    "No people, no text, no logos, no watermark, no frame, no vignette.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

const JOB_COLUMNS =
  "id, room_type_id, surface, tile_design_id, tile_width_mm, tile_height_mm, status, model, error_code, error_message, " +
  "created_at, updated_at, started_at, completed_at, " +
  "generated_images (storage_bucket, storage_path, mime_type, pixel_width, pixel_height, byte_size)";

interface JobRow {
  id: string;
  room_type_id: string;
  surface: TileSurface;
  tile_design_id: string | null;
  tile_width_mm: number | string;
  tile_height_mm: number | string;
  status: GenerationStatus;
  model: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  generated_images: {
    storage_bucket: string;
    storage_path: string;
    mime_type: ImageContentType;
    pixel_width: number | null;
    pixel_height: number | null;
    byte_size: number | null;
  }[];
}

function jobs() {
  return getSupabaseAdmin().from("preview_jobs");
}

/** PostgREST error → client-safe service error, pointing at the right migration. */
function databaseFailure(status: number, error: DatabaseError): GenerationServiceError {
  // Missing table, or a column only the M5-A migration adds.
  if (error.code === "PGRST205" || error.code === "42P01" || error.code === "PGRST204" || error.code === "42703") {
    console.error(`[${LOG}] Supabase query failed (HTTP ${status}):`, error.code, error.message);
    return new GenerationServiceError(
      503,
      "DATABASE_SCHEMA_MISSING",
      "Generation tables are not set up. Run migrations 20261009000002 and 20261009000004.",
    );
  }
  const failure = classifyDatabaseError(LOG, status, error);
  return new GenerationServiceError(failure.status, failure.code, failure.message);
}

/**
 * Fails jobs whose runner can no longer finish them, so they neither spin in
 * the UI forever nor count against the active-job limit.
 */
async function expireStaleJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const { error, status } = await jobs()
    .update({
      status: "failed",
      error_code: "TIMED_OUT" satisfies GenerationErrorCode,
      error_message: "Generation did not finish in time. Please try again.",
      completed_at: new Date().toISOString(),
    })
    .in("status", ["pending", "processing"])
    .lt("created_at", cutoff);
  if (error) throw databaseFailure(status, error);
}

/**
 * Records a pending job after checking config and the spend limits. Does not
 * generate anything; call `processGenerationJob` (now: after the response;
 * later: from a worker).
 */
export async function createGenerationJob(request: GenerationRequestBody): Promise<GenerationJobData> {
  // Fail on missing Gemini config before writing anything.
  const { imageModel } = getGeminiEnv();
  const limits = getGenerationLimitsEnv();

  await expireStaleJobs();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [activeResult, todayResult] = await Promise.all([
    jobs().select("id", { count: "exact" }).in("status", ["pending", "processing"]).limit(1),
    jobs().select("id", { count: "exact" }).gte("created_at", dayAgo).limit(1),
  ]);
  for (const result of [activeResult, todayResult]) {
    if (result.error) throw databaseFailure(result.status, result.error);
  }
  const active = activeResult.count ?? 0;
  const today = todayResult.count ?? 0;
  if (active >= limits.maxActive) {
    throw new GenerationServiceError(429, "RATE_LIMITED", "Other rooms are being generated right now. Please try again in a minute.");
  }
  if (today >= limits.dailyLimit) {
    throw new GenerationServiceError(429, "RATE_LIMITED", "The daily generation limit has been reached. Please try again tomorrow.");
  }

  const { data, error, status } = await jobs()
    .insert({
      room_type_id: request.placeId,
      surface: request.surface,
      tile_design_id: request.tile.catalogId,
      tile_width_mm: request.tile.width,
      tile_height_mm: request.tile.height,
      status: "pending" satisfies GenerationStatus,
      provider: PROVIDER,
      model: imageModel,
      prompt: buildRoomPrompt(request.placeId, request.surface),
    })
    .select(JOB_COLUMNS)
    .single()
    .overrideTypes<JobRow, { merge: false }>();
  if (error) {
    // Foreign key: the place or catalog tile is not in the database.
    if (error.code === "23503") {
      throw new GenerationServiceError(400, "INVALID_REQUEST", "Unknown place or catalog tile.");
    }
    throw databaseFailure(status, error);
  }
  return toJobData(data, null);
}

/**
 * Runs one pending job to completion: claims it, generates the room image,
 * stores it and records the result. Never throws; every failure ends up on
 * the job row. Safe to call more than once: only the first claim proceeds.
 */
export async function processGenerationJob(id: string): Promise<void> {
  const { data: claimed, error: claimError } = await jobs()
    .update({ status: "processing" satisfies GenerationStatus, started_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, model, prompt")
    .maybeSingle<{ id: string; model: string | null; prompt: string | null }>();
  if (claimError) {
    console.error(`[${LOG}] Claiming job ${id} failed:`, claimError.code, claimError.message);
    return;
  }
  if (!claimed) return; // Already claimed, finished or expired.

  const started = performance.now();
  let uploadedPath: string | null = null;
  try {
    if (!claimed.model || !claimed.prompt) {
      throw new GenerationError("INTERNAL_ERROR", "The job is missing its model or prompt.");
    }
    const bytes = await generateImage(getGeminiEnv(), claimed.model, claimed.prompt);

    const image = detectImageType(bytes);
    if (!image) {
      throw new GenerationError("PROVIDER_INVALID_RESPONSE", "The image service returned an unreadable image.");
    }
    if (bytes.byteLength > BUCKET_FILE_SIZE_LIMIT_BYTES) {
      throw new GenerationError("STORAGE_FAILED", "The generated image is larger than the storage limit.");
    }
    const dimensions = readImageDimensions(bytes, image.type);

    const path = newObjectPath(image.extension);
    const { error: uploadError } = await getSupabaseAdmin()
      .storage.from(BUCKET)
      .upload(path, bytes, { contentType: image.type, cacheControl: "3600", upsert: false });
    if (uploadError) {
      console.error(`[${LOG}] Upload for job ${id} failed:`, uploadError.message);
      throw new GenerationError("STORAGE_FAILED", "The generated image could not be stored.");
    }
    uploadedPath = path;

    const { error: imageError } = await getSupabaseAdmin().from("generated_images").insert({
      preview_job_id: id,
      storage_bucket: BUCKET,
      storage_path: path,
      mime_type: image.type,
      pixel_width: dimensions?.width ?? null,
      pixel_height: dimensions?.height ?? null,
      byte_size: bytes.byteLength,
    });
    if (imageError) {
      console.error(`[${LOG}] Recording the image for job ${id} failed:`, imageError.code, imageError.message);
      throw new GenerationError("STORAGE_FAILED", "The generated image could not be recorded.");
    }

    await finishJob(id, { status: "succeeded", error_code: null, error_message: null });
    console.info(
      `[${LOG}] Job ${id} succeeded in ${Math.round(performance.now() - started)} ms ` +
        `(${dimensions ? `${dimensions.width}x${dimensions.height}` : "unknown size"}, ${bytes.byteLength} bytes).`,
    );
  } catch (err) {
    const failure =
      err instanceof GenerationError
        ? err
        : err instanceof ServerConfigError
          ? new GenerationError("INTERNAL_ERROR", "Image generation is not configured on the server.")
          : new GenerationError("INTERNAL_ERROR", "Image generation failed.");
    if (!(err instanceof GenerationError)) console.error(`[${LOG}] Job ${id} failed unexpectedly:`, err);

    // Don't leave an orphaned object behind when the row could not be written.
    if (uploadedPath) {
      const { error } = await getSupabaseAdmin().storage.from(BUCKET).remove([uploadedPath]);
      if (error) console.error(`[${LOG}] Removing orphaned ${uploadedPath} failed:`, error.message);
    }
    await finishJob(id, { status: "failed", error_code: failure.code, error_message: failure.safeMessage });
  }
}

async function finishJob(
  id: string,
  fields: { status: GenerationStatus; error_code: GenerationErrorCode | null; error_message: string | null },
): Promise<void> {
  const { error } = await jobs()
    .update({ ...fields, completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "processing");
  if (error) console.error(`[${LOG}] Updating job ${id} to ${fields.status} failed:`, error.code, error.message);
}

/** A job with a fresh signed URL for its image, or `null` when no job has this id. */
export async function getGenerationJob(id: string): Promise<GenerationJobData | null> {
  await expireStaleJobs();
  const { data, error, status } = await jobs()
    .select(JOB_COLUMNS)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<JobRow | null, { merge: false }>();
  if (error) throw databaseFailure(status, error);
  if (!data) return null;

  const image = data.status === "succeeded" ? data.generated_images[0] : undefined;
  if (!image) return toJobData(data, null);

  const signed = await getImageUrl(BUCKET, image.storage_path);
  if (signed.error) console.error(`[${LOG}] Signing ${image.storage_path} failed:`, signed.error.message);
  return toJobData(data, signed.data);
}

function toJobData(row: JobRow, signed: { url: string; expiresAt: string | null } | null): GenerationJobData {
  const image = row.status === "succeeded" ? row.generated_images[0] : undefined;
  return {
    id: row.id,
    status: row.status,
    placeId: row.room_type_id as PlaceId,
    surface: row.surface,
    tile: {
      catalogId: row.tile_design_id,
      width: Number(row.tile_width_mm),
      height: Number(row.tile_height_mm),
    },
    model: row.model,
    error:
      row.status === "failed"
        ? {
            code: (row.error_code ?? "INTERNAL_ERROR") as GenerationErrorCode,
            message: row.error_message ?? "Image generation failed.",
          }
        : null,
    result: image
      ? {
          bucket: BUCKET,
          path: image.storage_path,
          visibility: "private",
          contentType: image.mime_type,
          width: image.pixel_width,
          height: image.pixel_height,
          size: image.byte_size ?? 0,
          url: signed?.url ?? null,
          expiresAt: signed?.expiresAt ?? null,
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}
