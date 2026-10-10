import type { PlaceId, TileSurface } from "@/types/tile";

/**
 * JSON envelope returned by every Route Handler under `src/app/api/`.
 * Shared with client code, so it must stay free of server-only imports.
 */
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: ApiError;
}

export interface ApiError {
  /** Stable, machine-readable reason. Safe to branch on in client code. */
  code: ApiErrorCode;
  /** Human-readable explanation. Never contains secrets or raw database errors. */
  message: string;
}

export type ApiErrorCode =
  | "CONFIG_INVALID"
  | "DATABASE_UNREACHABLE"
  | "DATABASE_AUTH_FAILED"
  | "DATABASE_SCHEMA_MISSING"
  | "DATABASE_PERMISSION_DENIED"
  | "DATABASE_QUERY_FAILED"
  | "DATABASE_UNEXPECTED_RESPONSE"
  | "INVALID_REQUEST"
  | "LENGTH_REQUIRED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "NOT_FOUND"
  | "STORAGE_NOT_CONFIGURED"
  | "STORAGE_UNAVAILABLE"
  | "STORAGE_FAILED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface HealthData {
  status: "ok";
  checks: { config: "ok" };
  timestamp: string;
}

export interface DatabaseHealthData {
  status: "ok";
  database: "reachable";
  /** Active room types visible to the publishable key; 6 once the catalog seed is applied. */
  roomTypes: number;
  latencyMs: number;
  timestamp: string;
}

/**
 * Supabase Storage buckets (created by supabase/migrations/…_storage.sql).
 * Only `tile-images` is public; everything users upload stays private.
 */
export type StorageBucket = "tile-images" | "tile-uploads" | "room-images" | "generated-previews";

/** `kind` form field of POST /api/uploads: room photo or user-uploaded tile image. */
export type UploadKind = "room" | "tile";

export type ImageContentType = "image/jpeg" | "image/png" | "image/webp";

export interface StoredImageData {
  bucket: StorageBucket;
  /** Object path inside the bucket; keep this (not the URL) in the database. */
  path: string;
  visibility: "public" | "private";
  /** Public URL, or a signed URL for private buckets. */
  url: string;
  /** When a signed URL stops working; `null` for public URLs. */
  expiresAt: string | null;
}

export interface UploadedImageData extends Omit<StoredImageData, "url" | "expiresAt"> {
  /** Detected from the file's bytes, not the client's declared type. */
  contentType: ImageContentType;
  size: number;
  /** `null` if the upload succeeded but signing failed; retry with GET /api/images. */
  url: string | null;
  expiresAt: string | null;
}

export interface StorageHealthData {
  status: "ok";
  buckets: Record<StorageBucket, "ok">;
  timestamp: string;
}

/**
 * Lifecycle of a `preview_jobs` row: `pending` (created) → `processing`
 * (claimed by whoever generates it) → `succeeded` or `failed`.
 */
export type GenerationStatus = "pending" | "processing" | "succeeded" | "failed";

/** Why a generation failed. Stored in `preview_jobs.error_code`; safe to branch on. */
export type GenerationErrorCode =
  | "PROVIDER_AUTH_FAILED"
  | "PROVIDER_MODEL_UNAVAILABLE"
  | "PROVIDER_QUOTA_EXCEEDED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_REJECTED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_INVALID_RESPONSE"
  | "STORAGE_FAILED"
  | "TIMED_OUT"
  | "INTERNAL_ERROR";

/** Body of `POST /api/generations`. Only these fields are read; the prompt is built on the server. */
export interface GenerationRequestBody {
  placeId: PlaceId;
  surface: TileSurface;
  tile: {
    /** `tile_designs.id` for catalog tiles; `null` for uploaded tiles. */
    catalogId: string | null;
    /** Millimetres. */
    width: number;
    height: number;
  };
}

/** A generated panorama in the private `generated-previews` bucket. */
export interface GenerationResult extends Omit<StoredImageData, "url" | "expiresAt"> {
  contentType: ImageContentType;
  /** Pixel size read from the stored file, not from the request. */
  width: number | null;
  height: number | null;
  size: number;
  /** Signed URL; `null` if signing failed (retry the GET). */
  url: string | null;
  expiresAt: string | null;
}

/** Returned by `POST /api/generations` and `GET /api/generations/[id]`. */
export interface GenerationJobData {
  id: string;
  status: GenerationStatus;
  placeId: PlaceId;
  surface: TileSurface;
  tile: GenerationRequestBody["tile"];
  /** Image model the job was (or will be) generated with. */
  model: string | null;
  /** Set when `status` is `failed`. */
  error: { code: GenerationErrorCode; message: string } | null;
  /** Set when `status` is `succeeded`. */
  result: GenerationResult | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
